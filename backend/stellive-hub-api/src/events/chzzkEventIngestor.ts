import type { ChzzkNormalizedLiveStatus } from "../adapters/chzzk/chzzkApiClient.js";
import type { LiveStatusRecord, LiveStatusWriteInput } from "../repositories/liveStatusRepository.js";
import {
  PrismaEventPersistenceUnitOfWork,
  type EventPersistenceScope,
  type EventPersistenceUnitOfWork
} from "../storage/eventPersistenceUnitOfWork.js";
import type { Member, PlatformEvent } from "../types.js";
import { shouldDropEventBeforeStorage } from "./eventGuards.js";

type ChzzkTransitionEventType = "chzzk_live_started" | "chzzk_live_ended";

export interface ChzzkObservationInput {
  member: Member;
  status: ChzzkNormalizedLiveStatus;
  observedAt: Date;
  isSupportedEvent: (eventType: ChzzkTransitionEventType) => boolean;
}

export interface ChzzkObservationResult {
  eventCreated: boolean;
}

export interface ChzzkObservationWriter {
  observe(input: ChzzkObservationInput): Promise<ChzzkObservationResult>;
}

function normalizeRuntimeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("https://") ? url : undefined;
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
  previous: LiveStatusRecord | null
): LiveStatusWriteInput {
  const providerStartedAt = startedAtFrom(status);
  const isVerified = status.sourceVerificationState === "verified";
  const isLive = isVerified && status.isLive;
  const transitioned = isVerified
    && previous?.sourceVerificationState === "verified"
    && previous.isLive !== isLive;
  const lastTransitionAt = transitioned ? now : (previous?.lastTransitionAt ?? undefined);
  const startedAt = isLive
    ? (providerStartedAt ?? previous?.startedAt ?? lastTransitionAt ?? now)
    : undefined;

  return {
    memberId: member.id,
    generationId: member.generationId,
    isLive,
    title: isVerified ? status.title : undefined,
    liveCategory: isVerified ? status.liveCategory : undefined,
    thumbnailUrl: normalizeRuntimeImageUrl(status.channelImageUrl),
    viewerCount: isVerified ? status.viewerCount : undefined,
    startedAt,
    platformUrl: status.platformUrl,
    sourceVerificationState: status.sourceVerificationState,
    lastCheckedAt: now,
    lastTransitionAt
  };
}

function transitionEventType(
  previous: LiveStatusRecord | null,
  status: ChzzkNormalizedLiveStatus
): ChzzkTransitionEventType | undefined {
  if (status.sourceVerificationState !== "verified" || previous?.sourceVerificationState !== "verified") {
    return undefined;
  }
  if (!previous.isLive && status.isLive) return "chzzk_live_started";
  if (previous.isLive && !status.isLive) return "chzzk_live_ended";
  return undefined;
}

function toEvent(
  member: Member,
  status: ChzzkNormalizedLiveStatus,
  type: ChzzkTransitionEventType,
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
    occurredAt: status.openDate ? parseChzzkOpenDate(status.openDate).toISOString() : now.toISOString(),
    receivedAt: now.toISOString(),
    dedupeKey: `chzzk:${type}:${status.channelId}:${observedKey}`,
    realtimeEligible: type === "chzzk_live_started",
    deliveryMode: type === "chzzk_live_started" ? "realtime_best_effort" : "standard"
  };
}

export default class ChzzkEventIngestor implements ChzzkObservationWriter {
  constructor(private readonly unitOfWork: EventPersistenceUnitOfWork = new PrismaEventPersistenceUnitOfWork()) {}

  async ingest(event: PlatformEvent): Promise<{ created: boolean }> {
    return this.unitOfWork.runInTransaction(async (scope) => this.persistEvent(scope, event));
  }

  async observe(input: ChzzkObservationInput): Promise<ChzzkObservationResult> {
    return this.unitOfWork.runInTransaction(async (scope) => {
      const previous = await scope.liveStatuses.getByMemberId(input.member.id);
      const eventType = transitionEventType(previous, input.status);
      await scope.liveStatuses.upsertLiveStatus(
        toLiveStatusInput(input.member, input.status, input.observedAt, previous)
      );

      if (!eventType || !input.isSupportedEvent(eventType)) return { eventCreated: false };
      const event = toEvent(input.member, input.status, eventType, input.observedAt);
      if (shouldDropEventBeforeStorage(event)) return { eventCreated: false };

      const result = await this.persistEvent(scope, event);
      return { eventCreated: result.created };
    });
  }

  private async persistEvent(
    scope: Pick<EventPersistenceScope, "platformEvents" | "notificationJobs">,
    event: PlatformEvent
  ): Promise<{ created: boolean }> {
    const result = await scope.platformEvents.createIfNotExists(event);
    await scope.notificationJobs.enqueue({
      eventId: result.eventId ?? event.id,
      priority: event.realtimeEligible ? 1 : 5
    });
    return { created: result.created };
  }
}
