import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";
import { NotificationJobRepository } from "../src/jobs/notificationJobRepository.js";
import { PlatformApiStateRepository } from "../src/repositories/platformApiStateRepository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prismaSchema = readFileSync(resolve(__dirname, "../prisma/schema.prisma"), "utf8");

describe("Prisma hub event admin schema", () => {
  it("defines publication state, revision, soft-delete timestamps, and audit logs", () => {
    expect(prismaSchema).toContain("publicationState");
    expect(prismaSchema).toContain("publishedAt");
    expect(prismaSchema).toContain("cancelledAt");
    expect(prismaSchema).toContain("deactivatedAt");
    expect(prismaSchema).toContain("deletedAt");
    expect(prismaSchema).toContain("revision");
    expect(prismaSchema).toContain("@@index([publicationState, deletedAt])");
    expect(prismaSchema).toContain("model HubEventAuditLog");
    expect(prismaSchema).toContain("@@index([hubEventId, createdAt])");
    expect(prismaSchema).toContain("@@index([action, createdAt])");
  });
});

describe("PlatformApiStateRepository", () => {
  it("upserts API state by source and key", async () => {
    const calls: unknown[] = [];
    const prisma = {
      platformApiState: {
        upsert: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      }
    };

    const repository = new PlatformApiStateRepository(prisma);

    await repository.upsert({
      source: "x",
      key: "integration",
      value: { costPolicy: "no_paid_api" },
      status: "disabled"
    });

    expect(calls).toEqual([
      {
        where: { source_key: { source: "x", key: "integration" } },
        create: {
          source: "x",
          key: "integration",
          value: { costPolicy: "no_paid_api" },
          status: "disabled"
        },
        update: {
          value: { costPolicy: "no_paid_api" },
          status: "disabled"
        }
      }
    ]);
  });
});

describe("NotificationJobRepository", () => {
  it("enqueues notification jobs with queued status", async () => {
    const calls: unknown[] = [];
    const prisma = {
      notificationJob: {
        create: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      }
    };

    const repository = new NotificationJobRepository(prisma);

    await repository.enqueue({ eventId: "event-1", priority: 3 });

    expect(calls).toEqual([
      {
        data: {
          eventId: "event-1",
          priority: 3,
          status: "queued"
        }
      }
    ]);
  });
});

describe("HubEventRepository", () => {
  const now = new Date("2026-06-12T00:00:00.000Z");
  const record = {
    id: "event-1",
    category: "online_goods",
    participationMode: "online",
    status: "announced",
    title: "Official Goods",
    summary: null,
    memberId: null,
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "Stellive Official",
    sourceType: "official",
    announcedAt: null,
    startsAt: null,
    endsAt: null,
    purchaseUrl: null,
    ticketUrl: null,
    venueName: null,
    venueAddress: null,
    notificationEligible: true,
    publicationState: "draft",
    publishedAt: null,
    cancelledAt: null,
    deactivatedAt: null,
    deletedAt: null,
    revision: 1,
    createdBy: "admin",
    updatedBy: "admin",
    createdAt: now,
    updatedAt: now
  };

  it("lists only published non-deleted hub events for public reads", async () => {
    const calls: unknown[] = [];
    const repository = new HubEventRepository({
      hubEvent: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [];
        }
      }
    });

    await repository.listPublished({ generationId: "official", limit: 5 });

    expect(calls).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({
          publicationState: "published",
          deletedAt: null,
          generationId: "official"
        }),
        take: 5
      })
    ]);
  });

  it("gets only published non-deleted hub event details", async () => {
    const calls: unknown[] = [];
    const repository = new HubEventRepository({
      hubEvent: {
        findFirst: async (args: unknown) => {
          calls.push(args);
          return null;
        }
      }
    });

    await repository.getPublishedById("event-1");

    expect(calls).toEqual([
      {
        where: {
          id: "event-1",
          publicationState: "published",
          deletedAt: null
        }
      }
    ]);
  });

  it("creates drafts with draft publication state and revision one", async () => {
    const calls: unknown[] = [];
    const repository = new HubEventRepository({
      hubEvent: {
        create: async (args: { data: unknown }) => {
          calls.push(args);
          return { ...record, ...(args.data as object) };
        }
      }
    });

    const created = await repository.createDraft({
      id: "event-1",
      category: "online_goods",
      participationMode: "online",
      status: "announced",
      title: "Official Goods",
      generationId: "official",
      sourceUrl: "https://example.com/source",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      notificationEligible: true,
      actorId: "admin"
    });

    expect(calls).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          publicationState: "draft",
          revision: 1,
          createdBy: "admin",
          updatedBy: "admin"
        })
      })
    ]);
    expect(created.createdAt).toBe("2026-06-12T00:00:00.000Z");
    expect(created.publicationState).toBe("draft");
  });

  it("increments revision on update", async () => {
    const calls: unknown[] = [];
    const repository = new HubEventRepository({
      hubEvent: {
        update: async (args: { data: unknown }) => {
          calls.push(args);
          return { ...record, ...(args.data as object), revision: 2 };
        }
      }
    });

    await repository.update("event-1", { title: "Updated Goods", actorId: "admin-2" });

    expect(calls).toEqual([
      expect.objectContaining({
        where: { id: "event-1" },
        data: expect.objectContaining({
          title: "Updated Goods",
          updatedBy: "admin-2",
          revision: { increment: 1 }
        })
      })
    ]);
  });

  it("writes append-only audit log entries", async () => {
    const calls: unknown[] = [];
    const repository = new HubEventRepository({
      hubEventAuditLog: {
        create: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      }
    });

    await repository.writeAuditLog({
      hubEventId: "event-1",
      action: "create",
      actorId: "admin",
      reason: "initial registration",
      before: null,
      after: { id: "event-1" }
    });

    expect(calls).toEqual([
      {
        data: {
          hubEventId: "event-1",
          action: "create",
          actorId: "admin",
          reason: "initial registration",
          before: null,
          after: { id: "event-1" }
        }
      }
    ]);
  });
});
