import { describe, expect, it } from "vitest";
import NotificationWorker from "../src/jobs/notificationWorker.js";
import type { ClaimedNotificationJob } from "../src/jobs/notificationJobRepository.js";
import type { PushTargetDevice } from "../src/push/pushSender.js";
import type { ResolvedNotificationPreference, UserNotificationPreference } from "../src/types.js";
import { CatalogService } from "../src/catalog/catalog.js";
import { HubEventAdminService } from "../src/hub-events/hubEventAdminService.js";
import type { AdminHubEvent } from "../src/hub-events/hubEventAdminTypes.js";
import { buildHubEventNotificationCandidates } from "../src/hub-events/hubEventNotificationFactory.js";
import type { AdminHubEventWriteInput, HubEventAuditLogInput } from "../src/hub-events/hubEventRepository.js";
import type { PlatformEvent } from "../src/types.js";

type AdminHubEventOverrides = Partial<Omit<AdminHubEvent, "announcedAt" | "startsAt" | "endsAt" | "scheduleItems">> & {
  announcedAt?: string | Date | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  scheduleItems?: AdminHubEventWriteInput["scheduleItems"];
};

function adminEvent(overrides: AdminHubEventOverrides = {}): AdminHubEvent {
  return {
    id: "event-1",
    category: "online_goods",
    participationMode: "online",
    status: "announced",
    title: "Official Goods",
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "Stellive Official",
    sourceType: "official",
    startsAt: "2026-06-12T00:00:00.000Z",
    scheduleMode: "timeline",
    scheduleItems: [{
      id: "schedule-sales-open",
      kind: "sales_open",
      label: "예약 판매 시작",
      startsAt: "2026-06-13T00:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul",
      notificationEligible: true,
      isPrimary: true,
      sortOrder: 0
    }],
    notificationEligible: true,
    publicationState: "draft",
    revision: 1,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...overrides
  } as AdminHubEvent;
}

function createRepository(seed: AdminHubEvent) {
  let current = seed;
  const audits: HubEventAuditLogInput[] = [];

  return {
    audits,
    repository: {
      async createDraft(input: AdminHubEventWriteInput) {
        current = adminEvent({ ...input, publicationState: "draft", revision: 1 });
        return current;
      },
      async update(_id: string, input: AdminHubEventWriteInput) {
        current = adminEvent({ ...current, ...input, revision: current.revision + 1 });
        return current;
      },
      async setPublicationState(input: {
        id: string;
        publicationState: AdminHubEvent["publicationState"];
        actorId?: string;
        publishedAt?: Date;
        cancelledAt?: Date;
        deactivatedAt?: Date;
      }) {
        current = adminEvent({
          ...current,
          publicationState: input.publicationState,
          publishedAt: input.publishedAt?.toISOString(),
          cancelledAt: input.cancelledAt?.toISOString(),
          deactivatedAt: input.deactivatedAt?.toISOString(),
          revision: current.revision + 1
        });
        return current;
      },
      async softDelete() {
        current = adminEvent({ ...current, publicationState: "deleted", deletedAt: "2026-06-12T12:00:00.000Z" });
        return current;
      },
      async getAdminById() {
        return current;
      },
      async listAdmin() {
        return { items: [current] };
      },
      async listAuditLog() {
        return [];
      },
      async writeAuditLog(input: HubEventAuditLogInput) {
        audits.push(input);
      }
    }
  };
}

describe("hub event notification candidates", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  it("suppresses draft creation and notification-ineligible events", () => {
    expect(buildHubEventNotificationCandidates({ action: "create", after: adminEvent(), now })).toEqual([]);
    expect(
      buildHubEventNotificationCandidates({
        action: "publish",
        after: adminEvent({ notificationEligible: false, publicationState: "published" }),
        now
      })
    ).toEqual([]);
  });

  it("builds standard non-realtime publish and cancel candidates", () => {
    const published = adminEvent({ publicationState: "published", revision: 2 });
    const publishCandidates = buildHubEventNotificationCandidates({
      action: "publish",
      before: adminEvent(),
      after: published,
      now
    });

    expect(publishCandidates.map((event) => event.type)).toEqual(["event_announced", "event_sales_open"]);
    expect(publishCandidates[0]).toMatchObject({
      source: "hub_event",
      deliveryMode: "standard",
      realtimeEligible: false,
      dedupeKey: "hub_event:event-1:event_announced:2"
    });
    expect(publishCandidates[1]).toMatchObject({
      type: "event_sales_open",
      dedupeKey: "hub_event:event-1:schedule:schedule-sales-open:event_sales_open:2026-06-13T00:00:00.000Z:r2",
      appDeepLink: "stellivehub://hub-events/event-1?scheduleItemId=schedule-sales-open"
    });

    const cancelCandidates = buildHubEventNotificationCandidates({
      action: "cancel",
      before: published,
      after: adminEvent({ ...published, status: "cancelled", cancelledAt: now.toISOString() }),
      now
    });

    expect(cancelCandidates).toHaveLength(1);
    expect(cancelCandidates[0]).toMatchObject({
      type: "event_cancelled",
      dedupeKey: "hub_event:event-1:event_cancelled:2026-06-12T12:00:00.000Z"
    });
  });

  it("does not backfill past or cancelled schedule notifications and maps milestone kinds", () => {
    const candidates = buildHubEventNotificationCandidates({
      action: "publish",
      after: adminEvent({
        scheduleItems: [
          adminEvent().scheduleItems![0],
          { ...adminEvent().scheduleItems![0], id: "past", startsAt: "2026-06-11T00:00:00.000Z" },
          { ...adminEvent().scheduleItems![0], id: "cancelled", startsAt: "2026-06-14T00:00:00.000Z", cancelledAt: now.toISOString() },
          { ...adminEvent().scheduleItems![0], id: "release", kind: "release", startsAt: "2026-06-15T00:00:00.000Z" }
        ]
      }),
      now
    });

    expect(candidates.map((event) => event.type)).toEqual(["event_announced", "event_sales_open", "event_milestone_due"]);
    expect(new Set(candidates.map((event) => event.dedupeKey)).size).toBe(candidates.length);
  });

  it.each(["official_runtime_url", "third_party_allowed"] as const)(
    "maps an allowed %s HubEvent image to PlatformEvent.thumbnailUrl",
    (policyState) => {
      const [candidate] = buildHubEventNotificationCandidates({
        action: "publish",
        after: adminEvent({
          image: {
            policyState,
            url: "https://example.com/event.jpg"
          }
        }),
        now
      });

      expect(candidate.thumbnailUrl).toBe("https://example.com/event.jpg");
    }
  );

  it.each(["verify_required", "blocked", "none"] as const)(
    "omits a %s HubEvent image from PlatformEvent.thumbnailUrl",
    (policyState) => {
      const [candidate] = buildHubEventNotificationCandidates({
        action: "publish",
        after: adminEvent({
          image: {
            policyState,
            url: "https://example.com/event.jpg"
          }
        }),
        now
      });

      expect(candidate.thumbnailUrl).toBeUndefined();
    }
  );

  it.each([
    "http://example.com/event.jpg",
    "not-a-url",
    "https://example.com/event.jpg?access_token=redacted"
  ])("omits unsafe HubEvent image URL %s from PlatformEvent.thumbnailUrl", (url) => {
    const [candidate] = buildHubEventNotificationCandidates({
      action: "publish",
      after: adminEvent({
        image: {
          policyState: "official_runtime_url",
          url
        }
      }),
      now
    });

    expect(candidate.thumbnailUrl).toBeUndefined();
  });

  it("stores created platform events and enqueues notification jobs from admin publish", async () => {
    const fake = createRepository(adminEvent());
    const platformEvents: PlatformEvent[] = [];
    const jobs: Array<{ eventId: string; priority: number; runAfter?: Date }> = [];
    const service = new HubEventAdminService({
      catalog: new CatalogService(),
      repository: fake.repository,
      platformEvents: {
        async createIfNotExists(event) {
          platformEvents.push(event);
          return { created: true };
        }
      },
      notificationJobs: {
        async enqueue(input) {
          jobs.push(input);
        }
      },
      now: () => now
    });

    await service.publish("event-1", { actorId: "admin" });

    expect(platformEvents.map((event) => event.type)).toEqual(["event_announced", "event_sales_open"]);
    expect(jobs[0]).toEqual({ eventId: platformEvents[0].id, priority: 5 });
    expect(jobs[1]).toEqual({ eventId: platformEvents[1].id, priority: 5, runAfter: new Date("2026-06-13T00:00:00.000Z") });
    expect(platformEvents.every((event) => event.rawPayload && typeof event.rawPayload === "object")).toBe(true);
  });
});

describe("HubEvent notification job delivery flow", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  function allowedResolution(eventId: string, deviceId: string): ResolvedNotificationPreference {
    return {
      eventId,
      deviceId,
      shouldNotify: true,
      reason: "allowed",
      matchedRules: ["global:on"],
      tapAction: "open_app",
      deliveryMode: "standard",
      pushPriority: "normal",
      foregroundStreamEligible: false
    };
  }

  function blockedResolution(eventId: string, deviceId: string): ResolvedNotificationPreference {
    return {
      ...allowedResolution(eventId, deviceId),
      shouldNotify: false,
      reason: "global_off",
      matchedRules: ["global:off"]
    };
  }

  it("drains admin-created HubEvent jobs through preference-gated delivery attempts", async () => {
    const fake = createRepository(adminEvent());
    const platformEvents: PlatformEvent[] = [];
    const jobs: Array<{ eventId: string; priority: number; runAfter?: Date }> = [];
    const service = new HubEventAdminService({
      catalog: new CatalogService(),
      repository: fake.repository,
      platformEvents: {
        async createIfNotExists(event) {
          platformEvents.push(event);
          return { created: true };
        }
      },
      notificationJobs: {
        async enqueue(input) {
          jobs.push(input);
        }
      },
      now: () => now
    });

    await service.publish("event-1", { actorId: "admin" });

    const eventById = new Map(platformEvents.map((event) => [event.id, event]));
    const claimedJobs: ClaimedNotificationJob[] = jobs.map((job, index) => ({
      id: `job-${index + 1}`,
      eventId: job.eventId,
      priority: job.priority,
      attempts: 0,
      runAfter: now,
      lockedAt: now,
      lockedBy: "test-worker"
    }));
    const attempts: unknown[] = [];
    const sent: unknown[] = [];
    const completed: string[] = [];
    const devices: PushTargetDevice[] = [
      {
        deviceId: "allowed-device",
        platform: "android",
        pushProvider: "fcm",
        pushToken: "allowed-token",
        tokenStatus: "active",
        timezone: "Asia/Seoul"
      },
      {
        deviceId: "global-off-device",
        platform: "ios",
        pushProvider: "apns_via_fcm",
        pushToken: "blocked-token",
        tokenStatus: "active",
        timezone: "Asia/Seoul"
      }
    ];

    const worker = new NotificationWorker({
      notificationJobs: {
        async claimReady() {
          return claimedJobs;
        },
        async complete(jobId) {
          completed.push(jobId);
        },
        async fail(input) {
          throw new Error(`unexpected fail ${JSON.stringify(input)}`);
        }
      },
      platformEvents: {
        async findById(eventId) {
          return eventById.get(eventId);
        }
      },
      devices: {
        async listPushTargets() {
          return devices;
        },
        async markTokenInvalid() {
          throw new Error("unexpected token invalidation");
        }
      },
      preferences: {
        async listForDevices() {
          return [] as UserNotificationPreference[];
        }
      },
      deliveryAttempts: {
        async create(input) {
          attempts.push(input);
        }
      },
      preferenceResolution: {
        resolve(event, deviceId) {
          return deviceId === "global-off-device"
            ? blockedResolution(event.id, deviceId)
            : allowedResolution(event.id, deviceId);
        }
      },
      pushSender: {
        async sendToDevice(input) {
          sent.push(input);
          return { status: "sent", providerMessageId: "provider-message-1" };
        }
      },
      now: () => now
    });

    const result = await worker.drain({ limit: 10, lockedBy: "test-worker", now });

    expect(platformEvents.map((event) => event.type)).toEqual(["event_announced", "event_sales_open"]);
    expect(jobs[0]).toEqual({ eventId: platformEvents[0].id, priority: 5 });
    expect(jobs[1]).toEqual({ eventId: platformEvents[1].id, priority: 5, runAfter: new Date("2026-06-13T00:00:00.000Z") });
    expect(result).toMatchObject({
      claimed: 2,
      completed: 2,
      failed: 0,
      sent: 1,
      skipped: 3,
      queued: 0,
      status: "ok"
    });
    expect(completed).toEqual(["job-1", "job-2"]);
    expect(sent).toHaveLength(1);
    expect(attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: expect.stringContaining("event_announced"),
          deviceId: "allowed-device",
          status: "skipped",
          reason: "push_not_enqueued",
          deliveryLevel: "summary_push"
        }),
        expect.objectContaining({
          eventId: expect.stringContaining("event_sales_open"),
          deviceId: "allowed-device",
          status: "sent",
          deliveryLevel: "immediate_push",
          providerMessageId: "provider-message-1"
        }),
        expect.objectContaining({
          deviceId: "global-off-device",
          status: "skipped",
          reason: "global_off",
          deliveryLevel: "in_app_history_only"
        })
      ])
    );
  });
});
