import type { CatalogService } from "../../catalog/catalog.js";
import type { ChzzkObservationWriter } from "../../events/chzzkEventIngestor.js";
import type { Member } from "../../types.js";
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
  observationWriter: ChzzkObservationWriter;
  clock?: () => Date;
}

const allowedCatalogRoles = new Set(["member", "representative"]);

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
      const now = this.options.clock?.() ?? new Date();
      const status = statuses.get(channelId) ?? {
        channelId,
        isLive: false,
        platformUrl: `https://chzzk.naver.com/live/${channelId}`,
        sourceVerificationState: "verify_required" as const
      };
      counts.checked += 1;
      if (status.sourceVerificationState === "verify_required") counts.verifyRequired += 1;

      const result = await this.options.observationWriter.observe({
        member,
        status,
        observedAt: now,
        isSupportedEvent: (eventType) => this.options.catalog.isSupportedEventForMember(member.id, eventType)
      });
      counts.updated += 1;
      if (result.eventCreated) counts.eventsCreated += 1;
    }

    return counts;
  }
}

export default ChzzkOpenApiAdapter;
