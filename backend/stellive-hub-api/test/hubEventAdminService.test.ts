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
    tags: [],
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
  it("normalizes album tags and rejects malformed, unsupported, or excessive tag input", async () => {
    const fake = createFakeRepository();
    const service = createService(fake.repository);
    const created = await service.createDraft({ ...adminEvent(), tags: [" album ", "album"] as unknown as ["album"] });

    expect(created.tags).toEqual(["album"]);
    expect(fake.audits.at(-1)).toMatchObject({ after: expect.objectContaining({ tags: ["album"] }) });
    expect(service.validate({ ...adminEvent(), tags: "album" }, "draft").errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "tags", reason: "tags_not_array" })
    ]));
    expect(service.validate({ ...adminEvent(), tags: ["vinyl"] }, "draft").errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "tags.0", reason: "unsupported_tag" })
    ]));
  });

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
      after: expect.objectContaining({
        scheduleMode: "timeline",
        scheduleItems: [expect.objectContaining({
          ...scheduleItems[0],
          title: "앨범 발매",
          description: null
        })]
      })
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
      title: "판매 기간",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul"
    }, { actorId: "admin" });

    expect(updated.scheduleMode).toBe("single_window");
    expect(updated.scheduleItems?.[0]).toMatchObject({ isPrimary: true, kind: "main_window" });
    expect(fake.audits.at(-1)?.action).toBe("schedule_create");
  });

  it("requires a title for schedule-item creation while keeping legacy parent arrays compatible", async () => {
    const fake = createFakeRepository(adminEvent({ scheduleItems: [] }));
    const service = createService(fake.repository);

    await expect(service.createScheduleItem("event-1", {
      expectedRevision: 1,
      kind: "custom",
      label: "레거시 라벨",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul"
    })).rejects.toMatchObject({
      message: "hub_event_validation_failed",
      errors: [expect.objectContaining({ field: "title", reason: "schedule_item_required" })]
    });

    const updated = await service.update("event-1", {
      scheduleItems: [{
        kind: "custom",
        label: "레거시 라벨",
        description: "   ",
        startsAt: "2026-07-20T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        isPrimary: true
      }]
    });
    expect(updated.scheduleItems).toEqual([
      expect.objectContaining({ title: "레거시 라벨", label: "레거시 라벨", description: null })
    ]);
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

  it("rejects a primary update for a schedule item not owned by the event", async () => {
    const fake = createFakeRepository(adminEvent({
      scheduleItems: [{
        id: "owned",
        kind: "custom",
        title: "소유 일정",
        label: "소유 일정",
        startsAt: "2026-07-21T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        notificationEligible: true,
        isPrimary: true,
        sortOrder: 0
      }]
    }));

    await expect(createService(fake.repository).updateScheduleItem(
      "event-1",
      "foreign-schedule",
      { expectedRevision: 1, isPrimary: true }
    )).rejects.toThrow("hub_event_schedule_item_not_found");
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
    expect(updated.startsAt).toBe("2026-07-21T01:00:00.000Z");
    expect(fake.audits.at(-1)?.action).toBe("schedule_update");
  });

  it("rejects a cancelled schedule as primary and rejects duplicate primaries in bulk", async () => {
    const cancelled = {
      id: "cancelled",
      kind: "deadline" as const,
      label: "마감",
      startsAt: "2026-07-21T01:00:00.000Z",
      timePrecision: "datetime" as const,
      timezone: "Asia/Seoul",
      isPrimary: false,
      sortOrder: 1,
      cancelledAt: "2026-07-20T01:00:00.000Z"
    };
    const fake = createFakeRepository(adminEvent({ scheduleMode: "timeline", scheduleItems: [cancelled] }));
    const service = createService(fake.repository);

    await expect(service.updateScheduleItem("event-1", "cancelled", {
      expectedRevision: 1,
      isPrimary: true
    })).rejects.toMatchObject({
      message: "hub_event_validation_failed",
      errors: [expect.objectContaining({ field: "isPrimary", reason: "schedule_item_invalid" })]
    });

    await expect(service.update("event-1", {
      scheduleItems: [
        { ...cancelled, id: "first", cancelledAt: null, isPrimary: true },
        { ...cancelled, id: "second", cancelledAt: null, isPrimary: true }
      ]
    })).rejects.toMatchObject({
      message: "hub_event_validation_failed",
      errors: [expect.objectContaining({ field: "scheduleItems", reason: "schedule_primary_duplicate" })]
    });
  });

  it("validates parent and schedule links independently", () => {
    const fake = createFakeRepository();
    const service = createService(fake.repository);
    const result = service.validate({
      ...adminEvent(),
      links: [
        { kind: "custom", url: "https://example.com/a", sortOrder: 0 },
        { kind: "source", url: "https://example.com/a", sortOrder: 1 }
      ],
      scheduleMode: "timeline",
      scheduleItems: [{
        id: "schedule-1",
        kind: "custom",
        title: "일정",
        label: "일정",
        startsAt: "2026-07-21T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        notificationEligible: true,
        isPrimary: true,
        sortOrder: 0,
        links: [{ kind: "content", url: "http://example.com", sortOrder: -1 }]
      }]
    }, "draft");

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "links.0.label", reason: "link_label_required" }),
      expect.objectContaining({ field: "links.1.url", reason: "link_url_duplicate" }),
      expect.objectContaining({ field: "scheduleItems.0.links.0.url", reason: "url_not_https" }),
      expect.objectContaining({ field: "scheduleItems.0.links.0.sortOrder", reason: "link_sort_order_invalid" })
    ]));
  });

  it("enforces independent parent and schedule link count limits", () => {
    const service = createService(createFakeRepository().repository);
    const link = (index: number) => ({ kind: "content" as const, url: `https://example.com/${index}`, sortOrder: index });
    const result = service.validate({
      ...adminEvent(),
      links: Array.from({ length: 21 }, (_, index) => link(index)),
      scheduleItems: [{
        id: "schedule-1",
        kind: "custom",
        title: "일정",
        label: "일정",
        startsAt: "2026-07-21T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul",
        notificationEligible: true,
        isPrimary: true,
        sortOrder: 0,
        links: Array.from({ length: 11 }, (_, index) => link(index + 100))
      }]
    }, "draft");

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "links", reason: "links_too_many" }),
      expect.objectContaining({ field: "scheduleItems.0.links", reason: "links_too_many" })
    ]));
  });

  it("increments the parent revision and audits a title-only schedule update", async () => {
    const scheduleItems: NonNullable<AdminHubEventWriteInput["scheduleItems"]> = [{
      id: "title-item",
      kind: "custom",
      title: "기존 상세 제목",
      label: "짧은 라벨",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul",
      isPrimary: true,
      sortOrder: 0
    }];
    const fake = createFakeRepository(adminEvent({ scheduleMode: "single_window", scheduleItems }));
    const service = createService(fake.repository);

    const updated = await service.updateScheduleItem("event-1", "title-item", {
      expectedRevision: 1,
      title: "새 상세 제목"
    }, { actorId: "admin" });

    expect(updated.revision).toBe(2);
    expect(updated.scheduleItems?.[0]).toMatchObject({
      id: "title-item",
      title: "새 상세 제목",
      label: "짧은 라벨",
      startsAt: "2026-07-20T01:00:00.000Z"
    });
    expect(fake.audits.at(-1)).toMatchObject({
      action: "schedule_update",
      before: expect.objectContaining({ revision: 1 }),
      after: expect.objectContaining({ revision: 2 })
    });
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

  it("runs every Hub event and schedule mutation in exactly one unit of work", async () => {
    const primarySchedule = {
      id: "primary",
      kind: "main_window" as const,
      title: "대표 일정",
      label: "대표 일정",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime" as const,
      timezone: "Asia/Seoul",
      notificationEligible: true,
      isPrimary: true,
      sortOrder: 0
    };
    const secondarySchedule = {
      ...primarySchedule,
      id: "secondary",
      kind: "deadline" as const,
      title: "마감",
      label: "마감",
      startsAt: "2026-07-21T01:00:00.000Z",
      isPrimary: false,
      sortOrder: 1
    };
    const cases: Array<{
      name: string;
      seed?: AdminHubEvent;
      run: (service: HubEventAdminService) => Promise<unknown>;
    }> = [
      { name: "create", run: (service) => service.createDraft(adminEvent()) },
      { name: "update", run: (service) => service.update("event-1", { title: "Updated" }) },
      { name: "publish", run: (service) => service.publish("event-1") },
      {
        name: "cancel",
        seed: adminEvent({ publicationState: "published", publishedAt: "2026-06-12T00:00:00.000Z" }),
        run: (service) => service.cancel("event-1")
      },
      { name: "deactivate", run: (service) => service.deactivate("event-1") },
      { name: "delete", run: (service) => service.delete("event-1") },
      {
        name: "schedule create",
        seed: adminEvent({ scheduleItems: [] }),
        run: (service) => service.createScheduleItem("event-1", {
          expectedRevision: 1,
          kind: "custom",
          title: "추가 일정",
          startsAt: "2026-07-20T01:00:00.000Z",
          timePrecision: "datetime",
          timezone: "Asia/Seoul"
        })
      },
      {
        name: "schedule update",
        seed: adminEvent({ scheduleItems: [primarySchedule] }),
        run: (service) => service.updateScheduleItem("event-1", "primary", {
          expectedRevision: 1,
          title: "변경된 대표 일정"
        })
      },
      {
        name: "schedule delete",
        seed: adminEvent({ scheduleItems: [primarySchedule] }),
        run: (service) => service.deleteScheduleItem("event-1", "primary", 1)
      },
      {
        name: "schedule restore",
        seed: adminEvent({ scheduleItems: [{
          ...primarySchedule,
          isPrimary: false,
          cancelledAt: "2026-07-19T01:00:00.000Z"
        }] }),
        run: (service) => service.restoreScheduleItem("event-1", "primary", 1)
      },
      {
        name: "schedule reorder",
        seed: adminEvent({ scheduleMode: "timeline", scheduleItems: [primarySchedule, secondarySchedule] }),
        run: (service) => service.reorderScheduleItems("event-1", {
          expectedRevision: 1,
          scheduleItemIds: ["secondary", "primary"]
        })
      }
    ];

    for (const testCase of cases) {
      const fake = createFakeRepository(testCase.seed ?? adminEvent());
      let runs = 0;
      const platformEvents = { async createIfNotExists() { return { created: false }; } };
      const notificationJobs = { async enqueue() { return { created: false }; } };
      const service = new HubEventAdminService({
        catalog: new CatalogService(),
        repository: fake.repository,
        platformEvents,
        notificationJobs,
        unitOfWork: {
          async run(work) {
            runs += 1;
            return work({ hubEvents: fake.repository, platformEvents, notificationJobs });
          }
        },
        now: () => new Date("2026-06-12T12:00:00.000Z")
      });

      await testCase.run(service);
      expect(runs, testCase.name).toBe(1);
    }
  });
});
