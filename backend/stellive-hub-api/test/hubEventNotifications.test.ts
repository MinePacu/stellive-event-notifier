import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";
import { HubEventAdminService } from "../src/hub-events/hubEventAdminService.js";
import type { AdminHubEvent } from "../src/hub-events/hubEventAdminTypes.js";
import { buildHubEventNotificationCandidates } from "../src/hub-events/hubEventNotificationFactory.js";
import type { AdminHubEventWriteInput, HubEventAuditLogInput } from "../src/hub-events/hubEventRepository.js";
import type { PlatformEvent } from "../src/types.js";

function adminEvent(overrides: Partial<AdminHubEvent> = {}): AdminHubEvent {
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
    notificationEligible: true,
    publicationState: "draft",
    revision: 1,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
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

  it("stores created platform events and enqueues notification jobs from admin publish", async () => {
    const fake = createRepository(adminEvent());
    const platformEvents: PlatformEvent[] = [];
    const jobs: Array<{ eventId: string; priority: number }> = [];
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
    expect(jobs).toEqual(platformEvents.map((event) => ({ eventId: event.id, priority: 5 })));
    expect(platformEvents.every((event) => event.rawPayload && typeof event.rawPayload === "object")).toBe(true);
  });
});
