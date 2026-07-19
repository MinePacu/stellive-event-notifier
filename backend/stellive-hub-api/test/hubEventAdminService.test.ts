import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";
import {
  HubEventAdminService,
  HubEventAdminValidationException
} from "../src/hub-events/hubEventAdminService.js";
import type { AdminHubEvent } from "../src/hub-events/hubEventAdminTypes.js";
import type { AdminHubEventWriteInput, HubEventAuditLogInput } from "../src/hub-events/hubEventRepository.js";

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
    announcedAt: "2026-06-12T00:00:00.000Z",
    notificationEligible: true,
    publicationState: "draft",
    revision: 1,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides
  } as AdminHubEvent;
}

function normalizeAdminEvent(event: AdminHubEvent): AdminHubEvent {
  const normalized = { ...event } as AdminHubEvent & {
    announcedAt?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  };
  if (normalized.announcedAt === null) delete normalized.announcedAt;
  if (normalized.startsAt === null) delete normalized.startsAt;
  if (normalized.endsAt === null) delete normalized.endsAt;
  return normalized;
}

function createFakeRepository(seed: AdminHubEvent = adminEvent()) {
  const audits: HubEventAuditLogInput[] = [];
  const calls: string[] = [];
  let current = seed;

  return {
    audits,
    calls,
    repository: {
      async createDraft(input: AdminHubEventWriteInput) {
        calls.push("createDraft");
        current = adminEvent({ ...input, publicationState: "draft", revision: 1, createdBy: input.actorId, updatedBy: input.actorId });
        return current;
      },
    async update(id: string, input: AdminHubEventWriteInput) {
      calls.push(`update:${id}`);
      const projected = input.scheduleItems?.find((item) => item.isPrimary && !item.cancelledAt);
      current = normalizeAdminEvent(
        adminEvent({
          ...current,
          ...input,
          ...(input.scheduleItems !== undefined ? {
            startsAt: projected?.startsAt ?? null,
            endsAt: projected?.endsAt ?? null
          } : {}),
          revision: current.revision + 1,
          updatedBy: input.actorId
        })
      );
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
        calls.push(`setPublicationState:${input.publicationState}`);
        current = adminEvent({
          ...current,
          publicationState: input.publicationState,
          publishedAt: input.publishedAt?.toISOString() ?? current.publishedAt,
          cancelledAt: input.cancelledAt?.toISOString() ?? current.cancelledAt,
          deactivatedAt: input.deactivatedAt?.toISOString() ?? current.deactivatedAt,
          revision: current.revision + 1,
          updatedBy: input.actorId
        });
        return current;
      },
      async softDelete(input: { id: string; actorId?: string; deletedAt: Date }) {
        calls.push("softDelete");
        current = adminEvent({
          ...current,
          publicationState: "deleted",
          deletedAt: input.deletedAt.toISOString(),
          revision: current.revision + 1,
          updatedBy: input.actorId
        });
        return current;
      },
      async hardDeleteScheduleItem(_id: string, scheduleItemId: string, input: AdminHubEventWriteInput) {
        calls.push(`hardDeleteScheduleItem:${scheduleItemId}`);
        current = normalizeAdminEvent(adminEvent({
          ...current,
          ...input,
          scheduleItems: input.scheduleItems,
          revision: current.revision + 1,
          updatedBy: input.actorId
        }));
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

function createService(repository: ReturnType<typeof createFakeRepository>["repository"]) {
  return new HubEventAdminService({
    catalog: new CatalogService(),
    repository,
    platformEvents: {
      async createIfNotExists() {
        return { created: false };
      }
    },
    notificationJobs: {
      async enqueue() {
        return undefined;
      }
    },
    now: () => new Date("2026-06-12T12:00:00.000Z")
  });
}

describe("HubEventAdminService", () => {
  it("creates validated drafts and writes create audit logs", async () => {
    const fake = createFakeRepository();
    const service = createService(fake.repository);

    const created = await service.createDraft(
      {
        id: "event-1",
        category: "online_goods",
        participationMode: "online",
        status: "announced",
        title: "Official Goods",
        generationId: "official",
        sourceUrl: "https://example.com/source",
        sourceLabel: "Stellive Official",
        sourceType: "official",
        notificationEligible: true
      },
      { actorId: "admin", reason: "initial registration" }
    );

    expect(created.publicationState).toBe("draft");
    expect(fake.audits).toEqual([
      expect.objectContaining({
        hubEventId: "event-1",
        action: "create",
        actorId: "admin",
        reason: "initial registration",
        before: null,
        after: expect.objectContaining({ id: "event-1" })
      })
    ]);
  });

  it("rejects invalid publish input with structured validation errors", async () => {
    const fake = createFakeRepository(adminEvent({ announcedAt: undefined, startsAt: undefined, endsAt: undefined }));
    const service = createService(fake.repository);

    await expect(service.publish("event-1", { actorId: "admin" })).rejects.toMatchObject({
      errors: [
        {
          field: "dateWindow",
          reason: "date_window_required"
        }
      ]
    });
  });

  it("publishes valid drafts and writes publish audit logs", async () => {
    const fake = createFakeRepository();
    const service = createService(fake.repository);

    const published = await service.publish("event-1", { actorId: "admin", reason: "ready" });

    expect(published.publicationState).toBe("published");
    expect(published.publishedAt).toBe("2026-06-12T12:00:00.000Z");
    expect(fake.audits.at(-1)).toEqual(
      expect.objectContaining({
        action: "publish",
        actorId: "admin",
        reason: "ready"
      })
    );
  });

  it("clears endsAt when an update explicitly sends null", async () => {
    const fake = createFakeRepository(
      adminEvent({
        status: "upcoming",
        startsAt: "2026-07-11T09:00:00.000Z",
        endsAt: "2026-07-11T14:00:00.000Z",
        publicationState: "published",
        publishedAt: "2026-06-12T12:00:00.000Z"
      })
    );
    const service = createService(fake.repository);

    const updated = await service.update("event-1", { endsAt: null }, { actorId: "admin" });

    expect(updated.endsAt).toBeUndefined();
  });

  it("includes schedule changes in update audit snapshots", async () => {
    const fake = createFakeRepository();
    const service = createService(fake.repository);
    const scheduleItems: NonNullable<AdminHubEventWriteInput["scheduleItems"]> = [{
      id: "release",
      kind: "release",
      label: "앨범 발매",
      startsAt: "2026-07-11T09:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul",
      notificationEligible: true,
      isPrimary: true,
      sortOrder: 0
    }];

    await service.update(
      "event-1",
      { scheduleMode: "timeline", scheduleItems },
      { actorId: "admin", reason: "timeline added" }
    );

    expect(fake.audits.at(-1)).toMatchObject({
      action: "update",
      reason: "timeline added",
      before: expect.not.objectContaining({ scheduleItems }),
      after: expect.objectContaining({ scheduleMode: "timeline", scheduleItems })
    });
  });

  it("does not restore a cleared endsAt during publish", async () => {
    const fake = createFakeRepository(
      adminEvent({
        status: "upcoming",
        startsAt: "2026-07-11T09:00:00.000Z",
        endsAt: "2026-07-11T14:00:00.000Z"
      })
    );
    const service = createService(fake.repository);

    await service.update("event-1", { endsAt: null }, { actorId: "admin" });
    const published = await service.publish("event-1", { actorId: "admin", reason: "ready" });

    expect(published.endsAt).toBeUndefined();
  });

  it("rejects clearing all date fields from a published event that needs a date window", async () => {
    const fake = createFakeRepository(
      adminEvent({
        status: "upcoming",
        startsAt: "2026-07-11T09:00:00.000Z",
        endsAt: "2026-07-11T14:00:00.000Z",
        publicationState: "published",
        publishedAt: "2026-06-12T12:00:00.000Z"
      })
    );
    const service = createService(fake.repository);

    await expect(
      service.update(
        "event-1",
        {
          announcedAt: null,
          startsAt: null,
          endsAt: null
        },
        { actorId: "admin" }
      )
    ).rejects.toMatchObject({
      errors: [{ field: "dateWindow", reason: "date_window_required" }]
    });
  });

  it("rejects updates to deleted events", async () => {
    const fake = createFakeRepository(adminEvent({ publicationState: "deleted", deletedAt: "2026-06-12T00:00:00.000Z" }));
    const service = createService(fake.repository);

    await expect(service.update("event-1", { title: "Nope" }, { actorId: "admin" })).rejects.toThrow("hub_event_deleted");
  });

  it("cancels, deactivates, and soft deletes through repository state transitions", async () => {
    const fake = createFakeRepository(adminEvent({ publicationState: "published" }));
    const service = createService(fake.repository);

    const cancelled = await service.cancel("event-1", { actorId: "admin" });
    const deactivated = await service.deactivate("event-1", { actorId: "admin" });
    const deleted = await service.delete("event-1", { actorId: "admin" });

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toBe("2026-06-12T12:00:00.000Z");
    expect(deactivated.publicationState).toBe("inactive");
    expect(deactivated.deactivatedAt).toBe("2026-06-12T12:00:00.000Z");
    expect(deleted.publicationState).toBe("deleted");
    expect(deleted.deletedAt).toBe("2026-06-12T12:00:00.000Z");
    expect(fake.audits.map((audit) => audit.action)).toEqual(["cancel", "deactivate", "delete"]);
  });

  it("exposes validate results without writing repository state", () => {
    const fake = createFakeRepository();
    const service = createService(fake.repository);

    const result = service.validate(
      {
        sourceUrl: "https://www.youtube.com/live/live-video-id",
        sourceLabel: "Stellive Official",
        sourceType: "official",
        category: "online_goods",
        participationMode: "online",
        status: "announced",
        title: "Live",
        generationId: "official",
        announcedAt: "2026-06-12T00:00:00.000Z"
      },
      "publish"
    );

    expect(result.valid).toBe(false);
    expect(fake.calls).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: "sourceUrl",
        reason: "official_youtube_live_excluded"
      })
    );
  });

  it("exports a typed validation exception for admin routes", () => {
    const exception = new HubEventAdminValidationException([{ field: "title", reason: "source_required", message: "bad" }]);

    expect(exception.message).toBe("hub_event_validation_failed");
    expect(exception.statusCode).toBe(400);
  });

  it("creates a first schedule item as primary and derives single-window mode", async () => {
    const fake = createFakeRepository(adminEvent({ scheduleItems: [], scheduleMode: "timeline" }));
    const service = createService(fake.repository);

    const updated = await service.createScheduleItem("event-1", {
      expectedRevision: 1,
      kind: "main_window",
      label: "판매 기간",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul"
    }, { actorId: "admin" });

    expect(updated.scheduleMode).toBe("single_window");
    expect(updated.scheduleItems?.[0]).toMatchObject({ isPrimary: true, kind: "main_window" });
    expect(fake.audits.at(-1)?.action).toBe("schedule_create");
  });

  it("rejects stale schedule revisions before writing", async () => {
    const fake = createFakeRepository(adminEvent({ revision: 3 }));
    const service = createService(fake.repository);

    await expect(service.createScheduleItem("event-1", {
      expectedRevision: 2,
      kind: "custom",
      label: "추가 일정",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul"
    })).rejects.toMatchObject({
      message: "hub_event_revision_conflict",
      expectedRevision: 2,
      currentRevision: 3
    });
    expect(fake.calls).toEqual([]);
  });

  it("hard deletes a safe draft schedule item and distinguishes the result", async () => {
    const scheduleItems: NonNullable<AdminHubEventWriteInput["scheduleItems"]> = [{
      id: "draft-item",
      kind: "main_window",
      label: "초안 일정",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul",
      isPrimary: true,
      sortOrder: 0
    }];
    const fake = createFakeRepository(adminEvent({ scheduleMode: "single_window", scheduleItems }));
    const service = createService(fake.repository);

    const result = await service.deleteScheduleItem("event-1", "draft-item", 1, { actorId: "admin" });

    expect(result.deletion).toBe("hard_deleted");
    expect(result.event.scheduleItems).toEqual([]);
    expect(fake.audits.at(-1)?.action).toBe("schedule_delete");
  });

  it("promotes a replacement primary in the same schedule update", async () => {
    const scheduleItems: NonNullable<AdminHubEventWriteInput["scheduleItems"]> = [
      {
        id: "primary",
        kind: "main_window",
        label: "행사 기간",
        startsAt: "2026-07-20T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        isPrimary: true,
        sortOrder: 0
      },
      {
        id: "replacement",
        kind: "sales_open",
        label: "판매 시작",
        startsAt: "2026-07-21T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        isPrimary: false,
        sortOrder: 1
      }
    ];
    const fake = createFakeRepository(adminEvent({ scheduleMode: "timeline", scheduleItems }));
    const service = createService(fake.repository);

    const updated = await service.updateScheduleItem("event-1", "replacement", {
      expectedRevision: 1,
      isPrimary: true
    });

    expect(updated.scheduleItems?.find((item) => item.id === "primary")?.isPrimary).toBe(false);
    expect(updated.scheduleItems?.find((item) => item.id === "replacement")?.isPrimary).toBe(true);
  });

  it("keeps timeline parent dates projected from the primary schedule", async () => {
    const scheduleItems: NonNullable<AdminHubEventWriteInput["scheduleItems"]> = [
      {
        id: "primary",
        kind: "main_window",
        label: "대표 일정",
        startsAt: "2026-07-20T01:00:00.000Z",
        endsAt: "2026-07-21T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        isPrimary: true,
        sortOrder: 0
      },
      {
        id: "later",
        kind: "deadline",
        label: "마감",
        startsAt: "2026-08-01T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        sortOrder: 1
      }
    ];
    const fake = createFakeRepository(adminEvent({ scheduleMode: "timeline", scheduleItems }));
    const service = createService(fake.repository);

    const updated = await service.update("event-1", {
      startsAt: "2026-09-01T01:00:00.000Z",
      endsAt: "2026-09-02T01:00:00.000Z"
    });

    expect(updated.startsAt).toBe("2026-07-20T01:00:00.000Z");
    expect(updated.endsAt).toBe("2026-07-21T01:00:00.000Z");
  });
});
