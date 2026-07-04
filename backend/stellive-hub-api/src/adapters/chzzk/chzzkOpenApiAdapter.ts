import type { CatalogService } from "../../catalog/catalog.js";
import { shouldDropEventBeforeStorage } from "../../events/eventGuards.js";
import type { LiveStatusRepository, LiveStatusWriteInput } from "../../repositories/liveStatusRepository.js";
import type { Member, PlatformEvent } from "../../types.js";
import type { ChzzkApiClient, ChzzkNormalizedLiveStatus } from "./chzzkApiClient.js";

export interface ChzzkLiveAdapterCounts {
  checked: number;
  updated: number;
  eventsCreated: number;
  skipped: number;
  verifyRequired: number;
  pagesFetched?: number;
  limited?: boolean;
  pendingUnverified?: number;
}

export interface ChzzkLiveAdapterOptions {
  catalog: Pick<CatalogService, "getMembers" | "isSupportedEventForMember">;
  apiClient: Pick<ChzzkApiClient, "getLiveStatus"> | Pick<ChzzkApiClient, "getLiveStatuses">;
  liveStatusRepository: Pick<LiveStatusRepository, "getByMemberId" | "upsertLiveStatus">;
  ingestEvent: (event: PlatformEvent) => Promise<unknown>;
  clock?: () => Date;
}

const allowedCatalogRoles = new Set(["member", "representative"]);

function normalizeRuntimeImageUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.startsWith("https://") ? url : undefined;
}

function hasChzzkChannel(member: Member): member is Member & { platforms: { chzzkChannelId: string } } {
  return typeof member.platforms.chzzkChannelId === "string" && member.platforms.chzzkChannelId.length > 0;
}

function isPollableMember(member: Member): boolean {
  return (
    (member.activeStatus as string) !== "former" &&
    allowedCatalogRoles.has(member.catalogRole) &&
    hasChzzkChannel(member)
  );
}

function bucketTimestamp(now: Date): string {
  const bucket = new Date(now);
  bucket.setSeconds(0, 0);
  return bucket.toISOString();
}

function parseChzzkOpenDate(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasTimezone ? normalized : `${normalized}+09:00`);
}

function startedAtFrom(status: ChzzkNormalizedLiveStatus): Date | undefined {
  return status.openDate ? parseChzzkOpenDate(status.openDate) : undefined;
}

function toLiveStatusInput(
  member: Member,
  status: ChzzkNormalizedLiveStatus,
  now: Date,
  previous:
    | {
        isLive: boolean;
        startedAt?: Date | null;
        lastTransitionAt?: Date | null;
      }
    | null
): LiveStatusWriteInput {
  const providerStartedAt = startedAtFrom(status);
  const transitioned = previous !== null && previous.isLive !== status.isLive;
  const lastTransitionAt = transitioned ? now : (previous?.lastTransitionAt ?? undefined);
  const startedAt = status.isLive
    ? (providerStartedAt ?? previous?.startedAt ?? lastTransitionAt ?? now)
    : undefined;

  return {
    memberId: member.id,
    generationId: member.generationId,
    isLive: status.isLive,
    title: status.title,
    thumbnailUrl: normalizeRuntimeImageUrl(status.channelImageUrl),
    viewerCount: status.viewerCount,
    startedAt,
    platformUrl: status.platformUrl,
    sourceVerificationState: status.sourceVerificationState,
    lastCheckedAt: now,
    lastTransitionAt
  };
}

function toEvent(
  member: Member,
  status: ChzzkNormalizedLiveStatus,
  type: "chzzk_live_started" | "chzzk_live_ended",
  now: Date
): PlatformEvent {
  const observedKey = status.openDate ?? bucketTimestamp(now);

  return {
    id: `chzzk-${type}-${member.id}-${observedKey}`,
    source: "chzzk",
    type,
    memberId: member.id,
    generationId: member.generationId,
    title: type === "chzzk_live_started" ? status.title ?? "CHZZK live started" : "CHZZK live ended",
    body: type === "chzzk_live_started" ? "CHZZK live status changed to live." : "CHZZK live status changed to offline.",
    platformUrl: status.platformUrl,
    appDeepLink: `stellivehub://members/${member.id}`,
    occurredAt: status.openDate ?? now.toISOString(),
    receivedAt: now.toISOString(),
    dedupeKey: `chzzk:${type}:${status.channelId}:${observedKey}`,
    realtimeEligible: type === "chzzk_live_started",
    deliveryMode: type === "chzzk_live_started" ? "realtime_best_effort" : "standard"
  };
}

export class ChzzkOpenApiAdapter {
  constructor(private readonly options: ChzzkLiveAdapterOptions) {}

  async pollLiveStatuses(): Promise<ChzzkLiveAdapterCounts> {
    const counts: ChzzkLiveAdapterCounts = {
      checked: 0,
      updated: 0,
      eventsCreated: 0,
      skipped: 0,
      verifyRequired: 0
    };
    const targets: Array<{ member: Member; channelId: string }> = [];

    for (const member of this.options.catalog.getMembers()) {
      if (!isPollableMember(member)) {
        counts.skipped += 1;
        continue;
      }

      const channelId = member.platforms.chzzkChannelId;
      if (!channelId) {
        counts.skipped += 1;
        continue;
      }
      targets.push({ member, channelId });
    }

    const channelIds = targets.map((target) => target.channelId);
    const apiClient = this.options.apiClient;
    let statuses: Map<string, ChzzkNormalizedLiveStatus>;
    if ("getLiveStatuses" in apiClient) {
      const batch = await apiClient.getLiveStatuses(channelIds);
      statuses = batch;
      if (batch.diagnostics) {
        counts.pagesFetched = batch.diagnostics.pagesFetched;
        counts.limited = batch.diagnostics.limited;
        counts.pendingUnverified = batch.diagnostics.pendingUnverified;
      }
    } else {
      statuses = new Map(await Promise.all(channelIds.map(async (channelId) => [
        channelId,
        await apiClient.getLiveStatus(channelId)
      ] as const)));
    }

    for (const { member, channelId } of targets) {
      const previous = await this.options.liveStatusRepository.getByMemberId(member.id);
      const now = this.options.clock?.() ?? new Date();
      const status = statuses.get(channelId) ?? {
        channelId,
        isLive: false,
        platformUrl: `https://chzzk.naver.com/live/${channelId}`,
        sourceVerificationState: "verify_required" as const
      };
      const effectiveStatus = status.sourceVerificationState === "verify_required" && previous
        ? { ...status, isLive: previous.isLive }
        : status;

      counts.checked += 1;
      if (status.sourceVerificationState === "verify_required") counts.verifyRequired += 1;

      await this.options.liveStatusRepository.upsertLiveStatus(toLiveStatusInput(member, effectiveStatus, now, previous));
      counts.updated += 1;

      const eventType = status.sourceVerificationState !== "verified"
        ? undefined
        : previous?.isLive === false && status.isLive
          ? "chzzk_live_started"
          : previous?.isLive === true && !status.isLive
            ? "chzzk_live_ended"
            : undefined;

      if (!eventType) continue;
      if (!this.options.catalog.isSupportedEventForMember(member.id, eventType)) continue;

      const event = toEvent(member, status, eventType, now);
      if (shouldDropEventBeforeStorage(event)) continue;

      await this.options.ingestEvent(event);
      counts.eventsCreated += 1;
    }

    return counts;
  }
}

export default ChzzkOpenApiAdapter;
