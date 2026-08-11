import { describe, expect, it } from "vitest";
import type { ChzzkNormalizedLiveStatus } from "../src/adapters/chzzk/chzzkApiClient.js";
import ChzzkEventIngestor, { type ChzzkObservationInput } from "../src/events/chzzkEventIngestor.js";
import type { LiveStatusRecord, LiveStatusWriteInput } from "../src/repositories/liveStatusRepository.js";
import type {
  EventPersistenceScope,
  EventPersistenceUnitOfWork
} from "../src/storage/eventPersistenceUnitOfWork.js";
import type { Member, PlatformEvent } from "../src/types.js";

interface MemoryJob {
  eventId: string;
  priority: number;
  status: "queued" | "completed" | "failed";
  attempts: number;
}

interface MemoryState {
  liveStatus: LiveStatusRecord | null;
  events: Map<string, PlatformEvent>;
  jobs: Map<string, MemoryJob>;
}

type FailurePoint = "live-status" | "event" | "job";

class MemoryEventPersistenceUnitOfWork implements EventPersistenceUnitOfWork {
  readonly state: MemoryState;
  failAt?: FailurePoint;
  private tail: Promise<void> = Promise.resolve();

  constructor(initialLiveStatus: LiveStatusRecord | null = offlineLiveStatus()) {
    this.state = {
      liveStatus: initialLiveStatus,
      events: new Map(),
      jobs: new Map()
    };
  }

  async runInTransaction<T>(operation: (scope: EventPersistenceScope) => Promise<T>): Promise<T> {
    const run = async () => {
      const draft = cloneState(this.state);
      const result = await operation(this.scope(draft));
      this.state.liveStatus = draft.liveStatus;
      this.state.events = draft.events;
      this.state.jobs = draft.jobs;
      return result;
    };
    const result = this.tail.then(run, run);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  private scope(draft: MemoryState): EventPersistenceScope {
    return {
      liveStatuses: {
        getByMemberId: async () => draft.liveStatus,
        upsertLiveStatus: async (input: LiveStatusWriteInput) => {
          if (this.failAt === "live-status") throw new Error("live_status_write_failed");
          draft.liveStatus = toLiveStatusRecord(input);
          return draft.liveStatus;
        }
      },
      platformEvents: {
        createIfNotExists: async (event: PlatformEvent) => {
          if (this.failAt === "event") throw new Error("platform_event_write_failed");
          const existing = [...draft.events.values()].find(
            (candidate) => candidate.id === event.id || candidate.dedupeKey === event.dedupeKey
          );
          if (existing) return { created: false, eventId: existing.id };
          draft.events.set(event.id, event);
          return { created: true, eventId: event.id };
        }
      },
      notificationJobs: {
        enqueue: async (input: { eventId: string; priority: number }) => {
          if (this.failAt === "job") throw new Error("notification_job_write_failed");
          if (draft.jobs.has(input.eventId)) return { created: false };
          draft.jobs.set(input.eventId, {
            ...input,
            status: "queued",
            attempts: 0
          });
          return { created: true };
        }
      }
    } as never;
  }
}

describe("ChzzkEventIngestor atomic observations", () => {
  it.each<FailurePoint>(["live-status", "event", "job"])(
    "rolls back live status, event, and job when the %s write fails",
    async (failAt) => {
      const unitOfWork = new MemoryEventPersistenceUnitOfWork();
      const before = cloneState(unitOfWork.state);
      unitOfWork.failAt = failAt;
      const ingestor = new ChzzkEventIngestor(unitOfWork);

      await expect(ingestor.observe(observation())).rejects.toThrow();

      expect(unitOfWork.state).toEqual(before);
    }
  );

  it("heals a duplicate event that is missing its notification job", async () => {
    const unitOfWork = new MemoryEventPersistenceUnitOfWork();
    const ingestor = new ChzzkEventIngestor(unitOfWork);
    const first = await ingestor.observe(observation());
    const [eventId] = unitOfWork.state.events.keys();
    unitOfWork.state.jobs.clear();
    unitOfWork.state.liveStatus = offlineLiveStatus();

    const healed = await ingestor.observe(observation());

    expect(first.eventCreated).toBe(true);
    expect(healed.eventCreated).toBe(false);
    expect(unitOfWork.state.events.size).toBe(1);
    expect(unitOfWork.state.jobs.get(eventId)).toMatchObject({ status: "queued", attempts: 0 });
  });

  it.each(["completed", "failed"] as const)(
    "does not reset an existing %s job while healing a duplicate event",
    async (status) => {
      const unitOfWork = new MemoryEventPersistenceUnitOfWork();
      const ingestor = new ChzzkEventIngestor(unitOfWork);
      await ingestor.observe(observation());
      const [eventId] = unitOfWork.state.events.keys();
      unitOfWork.state.jobs.set(eventId, { eventId, priority: 1, status, attempts: 4 });
      unitOfWork.state.liveStatus = offlineLiveStatus();

      await expect(ingestor.observe(observation())).resolves.toEqual({ eventCreated: false });

      expect(unitOfWork.state.jobs.get(eventId)).toEqual({ eventId, priority: 1, status, attempts: 4 });
    }
  );

  it("serializes concurrent observations so exactly one reports a new event", async () => {
    const unitOfWork = new MemoryEventPersistenceUnitOfWork();
    const ingestor = new ChzzkEventIngestor(unitOfWork);

    const results = await Promise.all([
      ingestor.observe(observation()),
      ingestor.observe(observation())
    ]);

    expect(results.map((result) => result.eventCreated).sort()).toEqual([false, true]);
    expect(unitOfWork.state.events.size).toBe(1);
    expect(unitOfWork.state.jobs.size).toBe(1);
    expect(unitOfWork.state.liveStatus?.isLive).toBe(true);
  });
});

function observation(): ChzzkObservationInput {
  return {
    member: liveMember,
    status: liveStatus(),
    observedAt: new Date("2026-06-11T03:05:00.000Z"),
    isSupportedEvent: () => true
  };
}

const liveMember: Member = {
  id: "ayatsuno-yuni",
  koreanName: "유니",
  englishName: "Yuni",
  generationId: "gen1",
  generationName: "1기생",
  unitName: "1기생",
  catalogRole: "member",
  activeStatus: "active",
  roleLabel: "member",
  isPerson: true,
  avatar: { preferredSource: "placeholder", licenseStatus: "unknown" },
  platforms: { chzzkChannelId: "chzzk-channel-id", externalUrls: {} },
  supportedEventTypes: ["chzzk_live_started", "chzzk_live_ended"]
};

function liveStatus(): ChzzkNormalizedLiveStatus {
  return {
    channelId: "chzzk-channel-id",
    isLive: true,
    title: "Live",
    openDate: "2026-06-11T03:00:00.000Z",
    platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
    sourceVerificationState: "verified"
  };
}

function offlineLiveStatus(): LiveStatusRecord {
  return {
    memberId: liveMember.id,
    generationId: liveMember.generationId,
    isLive: false,
    title: null,
    liveCategory: null,
    thumbnailUrl: null,
    viewerCount: null,
    startedAt: null,
    platformUrl: null,
    lastCheckedAt: new Date("2026-06-11T02:59:00.000Z"),
    sourceVerificationState: "verified",
    lastTransitionAt: null
  };
}

function toLiveStatusRecord(input: LiveStatusWriteInput): LiveStatusRecord {
  return {
    memberId: input.memberId,
    generationId: input.generationId,
    isLive: input.isLive,
    title: input.title ?? null,
    liveCategory: input.liveCategory ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    viewerCount: input.viewerCount ?? null,
    startedAt: input.startedAt ?? null,
    platformUrl: input.platformUrl ?? null,
    lastCheckedAt: input.lastCheckedAt ?? new Date(),
    sourceVerificationState: input.sourceVerificationState,
    lastTransitionAt: input.lastTransitionAt ?? null
  };
}

function cloneState(state: MemoryState): MemoryState {
  return {
    liveStatus: state.liveStatus ? { ...state.liveStatus } : null,
    events: new Map(state.events),
    jobs: new Map([...state.jobs].map(([key, value]) => [key, { ...value }]))
  };
}
