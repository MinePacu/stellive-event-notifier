import { describe, expect, it, vi } from "vitest";
import PlatformEventRepository from "../src/repositories/platformEventRepository.js";
import DeviceRepository from "../src/repositories/deviceRepository.js";
import { DeliveryAttemptRepository } from "../src/repositories/deliveryAttemptRepository.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";
import { NotificationJobRepository } from "../src/jobs/notificationJobRepository.js";
import { PlatformApiStateRepository } from "../src/repositories/platformApiStateRepository.js";
import { ExternalApiCallLogRepository } from "../src/repositories/externalApiCallLogRepository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prismaSchema = readFileSync(resolve(__dirname, "../prisma/schema.prisma"), "utf8");
const scheduleTitleMigration = readFileSync(
  resolve(__dirname, "../prisma/migrations/20260719150000_add_hub_event_schedule_title/migration.sql"),
  "utf8"
);
const hubEventLinksMigration = readFileSync(
  resolve(__dirname, "../prisma/migrations/20260719180000_add_hub_event_links_and_primary_uniqueness/migration.sql"),
  "utf8"
);
const hubEventTagsMigration = readFileSync(
  resolve(__dirname, "../prisma/migrations/20260726000000_add_hub_event_tags/migration.sql"),
  "utf8"
);

describe("Prisma hub event admin schema", () => {
  it("stores HubEvent tags as a non-null empty-array default", () => {
    expect(prismaSchema).toContain("tags                  String[] @default([])");
    expect(hubEventTagsMigration).toContain('ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]');
  });
  it("defines publication state, revision, soft-delete timestamps, and audit logs", () => {
    expect(prismaSchema).toContain("id                    String   @id @default(cuid(2))");
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

  it("adds nullable schedule titles and backfills them from labels", () => {
    expect(prismaSchema).toContain("title                String?");
    expect(scheduleTitleMigration).toContain('ADD COLUMN "title" TEXT');
    expect(scheduleTitleMigration).toContain('SET "title" = "label"');
    expect(scheduleTitleMigration).not.toContain("DROP COLUMN");
    expect(scheduleTitleMigration).not.toContain("NOT NULL");
  });

  it("deduplicates active primaries and adds link ownership constraints and backfills", () => {
    expect(hubEventLinksMigration).toContain('ROW_NUMBER() OVER');
    expect(hubEventLinksMigration).toContain('ORDER BY "sortOrder" ASC, "startsAt" ASC, "createdAt" ASC, "id" ASC');
    expect(hubEventLinksMigration).toContain('CREATE UNIQUE INDEX "HubEventScheduleItem_one_active_primary"');
    expect(hubEventLinksMigration).toContain('WHERE "isPrimary" = TRUE AND "cancelledAt" IS NULL');
    expect(hubEventLinksMigration).toContain('CONSTRAINT "HubEventExternalLink_exactly_one_owner" CHECK');
    expect(hubEventLinksMigration).toContain('CREATE UNIQUE INDEX "HubEventExternalLink_hubEventId_url_key"');
    expect(hubEventLinksMigration).toContain('CREATE UNIQUE INDEX "HubEventExternalLink_scheduleItemId_url_key"');
    expect(hubEventLinksMigration).toContain('legacy_parent_purchase_');
    expect(hubEventLinksMigration).toContain('legacy_schedule_action_');
    expect(prismaSchema).toContain('model HubEventExternalLink');
  });
});

describe("ExternalApiCallLogRepository", () => {
  it("records only sanitized URL metadata for outbound API calls", async () => {
    const calls: unknown[] = [];
    const repository = new ExternalApiCallLogRepository({
      externalApiCallLog: {
        create: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      }
    });

    await repository.record({
      source: "youtube",
      operation: "youtube.videos.list",
      method: "get",
      url: "https://www.googleapis.com/youtube/v3/videos?key=test-key&id=video-1",
      statusCode: 200,
      resultStatus: "ok",
      quotaUnits: 1,
      requestedAt: new Date("2026-07-02T00:00:00.000Z"),
      completedAt: new Date("2026-07-02T00:00:00.120Z")
    });

    expect(calls).toEqual([
      {
        data: expect.objectContaining({
          source: "youtube",
          operation: "youtube.videos.list",
          method: "GET",
          host: "www.googleapis.com",
          path: "/youtube/v3/videos",
          resultStatus: "ok",
          quotaUnits: 1
        })
      }
    ]);
    expect(JSON.stringify(calls)).not.toContain("test-key");
    expect(JSON.stringify(calls)).not.toContain("video-1");
  });

  it("summarizes daily KST buckets by result and source", async () => {
    let sql = "";
    const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
      sql = Array.from(strings).join("?");
      return [
      {
        date: "2026-07-05",
        source: "chzzk",
        total: 1n,
        ok: 1n,
        failed: 0n,
        rateLimited: 0n,
        quotaExceeded: 0n,
        quotaUnits: 0n
      }
      ];
    });
    const findMany = vi.fn(() => { throw new Error("findMany must not be used for daily aggregation"); });
    const repository = new ExternalApiCallLogRepository({
      externalApiCallLog: { findMany },
      $queryRaw: queryRaw
    } as never);

    const trend = await repository.summarizeDaily({ days: 2, now: new Date("2026-07-05T07:30:00.000Z") });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
    // Production stores UTC values in a timestamp without time zone column.
    expect(sql).toContain("(\"requestedAt\" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul'");
    expect(sql).not.toContain("to_char(\"requestedAt\" AT TIME ZONE 'Asia/Seoul'");
    expect(sql).not.toContain("timezone('Asia/Seoul', \"requestedAt\")");
    expect(trend.items).toEqual([
      expect.objectContaining({ date: "2026-07-04", total: 0, bySource: {} }),
      expect.objectContaining({ date: "2026-07-05", total: 1, ok: 1, bySource: { chzzk: 1 } })
    ]);
    expect(trend.totals).toMatchObject({ total: 1, ok: 1, failed: 0, rateLimited: 0, quotaUnits: 0, bySource: { chzzk: 1 } });
  });

  it("limits recent external API calls to the retention window and filters", async () => {
    const calls: unknown[] = [];
    const repository = new ExternalApiCallLogRepository({
      externalApiCallLog: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [
            {
              id: "api-1",
              source: "youtube",
              operation: "youtube.videos.list",
              method: "GET",
              host: "www.googleapis.com",
              path: "/youtube/v3/videos",
              statusCode: 403,
              resultStatus: "quota_exceeded",
              durationMs: 20,
              quotaUnits: 1,
              rateLimited: false,
              errorCode: "403",
              errorReason: "quota",
              requestedAt: new Date("2026-07-02T00:00:00.000Z"),
              completedAt: null
            }
          ];
        }
      }
    });

    const result = await repository.listRecent({
      limit: 5,
      source: "youtube",
      resultStatus: "quota_exceeded",
      now: new Date("2026-07-02T01:00:00.000Z")
    });

    expect(calls).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({
          source: "youtube",
          resultStatus: "quota_exceeded",
          requestedAt: {
            gte: new Date("2026-06-01T01:00:00.000Z"),
            lte: new Date("2026-07-02T01:00:00.000Z")
          }
        }),
        orderBy: { requestedAt: "desc" },
        take: 5
      })
    ]);
    expect(result.items[0]).toMatchObject({
      id: "api-1",
      host: "www.googleapis.com",
      path: "/youtube/v3/videos",
      resultStatus: "quota_exceeded",
      requestedAt: "2026-07-02T00:00:00.000Z"
    });
  });

  it("prunes external API call logs older than the retention period", async () => {
    const calls: unknown[] = [];
    const repository = new ExternalApiCallLogRepository({
      externalApiCallLog: {
        deleteMany: async (args: unknown) => {
          calls.push(args);
          return { count: 2 };
        }
      }
    });

    await expect(repository.pruneOlderThan({ days: 31, now: new Date("2026-07-02T01:00:00.000Z") })).resolves.toEqual({ deleted: 2 });
    expect(calls).toEqual([
      {
        where: { requestedAt: { lt: new Date("2026-06-01T01:00:00.000Z") } }
      }
    ]);
  });
});

describe("Prisma external API call log schema", () => {
  it("defines retention-friendly external API observability indexes", () => {
    expect(prismaSchema).toContain("model ExternalApiCallLog");
    expect(prismaSchema).toContain("source       String");
    expect(prismaSchema).toContain("operation    String");
    expect(prismaSchema).toContain("resultStatus String");
    expect(prismaSchema).toContain("quotaUnits   Int      @default(0)");
    expect(prismaSchema).toContain("@@index([requestedAt])");
    expect(prismaSchema).toContain("@@index([source, requestedAt])");
    expect(prismaSchema).toContain("@@index([operation, requestedAt])");
    expect(prismaSchema).toContain("@@index([resultStatus, requestedAt])");
  });
});

describe("PlatformEventRepository", () => {
  it("loads a normalized platform event by id", async () => {
    const prisma = {
      platformEvent: {
        async create() {
          return {};
        },
        async findUnique(args: { where: { id: string } }) {
          expect(args.where.id).toBe("event-1");
          return {
            id: "event-1",
            source: "hub_event",
            type: "event_cancelled",
            memberId: "stellive-official",
            generationId: "official",
            title: "공식 굿즈 취소",
            body: "일정이 취소됐습니다.",
            platformUrl: "https://example.com/source",
            appDeepLink: "stellivehub://hub-events/event-1",
            occurredAt: new Date("2026-06-12T00:00:00.000Z"),
            receivedAt: new Date("2026-06-12T00:00:01.000Z"),
            dedupeKey: "hub_event:event-1:event_cancelled:2026-06-12T00:00:00.000Z",
            realtimeEligible: false,
            deliveryMode: "standard",
            metadata: { hubEventId: "event-1" }
          };
        }
      }
    };
    const repository = new PlatformEventRepository(prisma);

    const event = await repository.findById("event-1");

    expect(event).toEqual({
      id: "event-1",
      source: "hub_event",
      type: "event_cancelled",
      memberId: "stellive-official",
      generationId: "official",
      title: "공식 굿즈 취소",
      body: "일정이 취소됐습니다.",
      platformUrl: "https://example.com/source",
      appDeepLink: "stellivehub://hub-events/event-1",
      occurredAt: "2026-06-12T00:00:00.000Z",
      receivedAt: "2026-06-12T00:00:01.000Z",
      dedupeKey: "hub_event:event-1:event_cancelled:2026-06-12T00:00:00.000Z",
      rawPayload: { hubEventId: "event-1" },
      realtimeEligible: false,
      deliveryMode: "standard"
    });
  });

  it("returns undefined when a platform event does not exist", async () => {
    const repository = new PlatformEventRepository({
      platformEvent: {
        async create() {
          return {};
        },
        async findUnique() {
          return null;
        }
      }
    });

    await expect(repository.findById("missing-event")).resolves.toBeUndefined();
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
      source: "youtube",
      key: "websub",
      value: { enabled: true },
      status: "enabled"
    });

    expect(calls).toEqual([
      {
        where: { source_key: { source: "youtube", key: "websub" } },
        create: {
          source: "youtube",
          key: "websub",
          value: { enabled: true },
          status: "enabled"
        },
        update: {
          value: { enabled: true },
          status: "enabled"
        }
      }
    ]);
  });
});

describe("DeviceRepository push targets", () => {
  it("lists active devices with push tokens and derives push provider from platform", async () => {
    const repository = new DeviceRepository({
      device: {
        async findMany(args: unknown) {
          expect(args).toEqual({
            where: {
              tokenStatus: "active",
              deviceToken: { not: null }
            },
            orderBy: { id: "asc" },
            take: 501,
            select: {
              id: true,
              platform: true,
              deviceToken: true,
              tokenStatus: true,
              timezone: true,
              locale: true,
              appVersion: true
            }
          });
          return [
            {
              id: "android-device",
              platform: "android",
              deviceToken: "android-token",
              tokenStatus: "active",
              timezone: "Asia/Seoul",
              locale: "ko-KR",
              appVersion: "1.0.0"
            },
            {
              id: "ios-device",
              platform: "ios",
              deviceToken: "ios-token",
              tokenStatus: "active",
              timezone: "Asia/Seoul",
              locale: "ko-KR",
              appVersion: "1.0.0"
            }
          ];
        }
      }
    });

    await expect(repository.listPushTargets()).resolves.toEqual([
      {
        deviceId: "android-device",
        platform: "android",
        pushProvider: "fcm",
        pushToken: "android-token",
        tokenStatus: "active",
        timezone: "Asia/Seoul",
        locale: "ko-KR",
        appVersion: "1.0.0"
      },
      {
        deviceId: "ios-device",
        platform: "ios",
        pushProvider: "apns_via_fcm",
        pushToken: "ios-token",
        tokenStatus: "active",
        timezone: "Asia/Seoul",
        locale: "ko-KR",
        appVersion: "1.0.0"
      }
    ]);
  });

  it("marks push tokens invalid without storing provider response bodies", async () => {
    const calls: unknown[] = [];
    const repository = new DeviceRepository({
      device: {
        async update(args: unknown) {
          calls.push(args);
          return {};
        }
      }
    });

    await repository.markTokenInvalid("device-1", "messaging/registration-token-not-registered");

    expect(calls).toEqual([
      {
        where: { id: "device-1" },
        data: {
          tokenStatus: "invalid",
          lastSeenAt: expect.any(Date)
        }
      }
    ]);
  });
});

describe("DeliveryAttemptRepository worker writes", () => {
  it("creates delivery attempts with normalized worker fields", async () => {
    const calls: unknown[] = [];
    const attemptedAt = new Date("2026-06-12T00:00:00.000Z");
    const deliveredAt = new Date("2026-06-12T00:00:01.000Z");
    const repository = new DeliveryAttemptRepository({
      deliveryAttempt: {
        async create(args: unknown) {
          calls.push(args);
          return {};
        }
      }
    });

    await repository.create({
      eventId: "event-1",
      deviceId: "device-1",
      attemptedAt,
      deliveredAt,
      status: "sent",
      reason: "allowed",
      source: "hub_event",
      eventType: "event_cancelled",
      generationId: "official",
      memberId: "stellive-official",
      deliveryMode: "realtime_best_effort",
      deliveryLevel: "immediate_push",
      pushPriority: "high",
      providerMessageId: "provider-message-1",
      providerErrorCode: undefined,
      retryCount: 1
    });

    expect(calls).toEqual([
      {
        data: {
          eventId: "event-1",
          deviceId: "device-1",
          attemptedAt,
          deliveredAt,
          status: "sent",
          reason: "allowed",
          tapActionUsed: "open_app",
          title: "",
          body: "",
          source: "hub_event",
          eventType: "event_cancelled",
          generationId: "official",
          memberId: "stellive-official",
          deliveryMode: "realtime_best_effort",
          deliveryLevel: "immediate_push",
          pushPriority: "high",
          providerMessageId: "provider-message-1",
          providerErrorCode: undefined,
          retryCount: 1,
          expiresAt: undefined
        }
      }
    ]);
  });

  it("lists distinct sent device ids for an event and candidate device set", async () => {
    const findMany = vi.fn(async () => [
      { deviceId: "device-1" },
      { deviceId: "device-1" },
      { deviceId: "device-3" },
      { deviceId: null }
    ]);
    const repository = new DeliveryAttemptRepository({
      deliveryAttempt: { findMany }
    } as never);

    const result = await repository.listSentDeviceIds({
      eventId: "event-1",
      deviceIds: ["device-1", "device-2", "device-3"]
    });

    expect(result).toEqual(new Set(["device-1", "device-3"]));
    expect(findMany).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        status: "sent",
        deviceId: { in: ["device-1", "device-2", "device-3"] }
      },
      select: { deviceId: true },
      distinct: ["deviceId"]
    });
  });

  it("does not query sent attempts when the candidate device set is empty", async () => {
    const findMany = vi.fn();
    const repository = new DeliveryAttemptRepository({
      deliveryAttempt: { findMany }
    } as never);

    await expect(repository.listSentDeviceIds({ eventId: "event-1", deviceIds: [] })).resolves.toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("counts sent attempts per device within an inclusive rolling window", async () => {
    const since = new Date("2026-06-12T00:00:00.000Z");
    const until = new Date("2026-06-12T00:01:00.000Z");
    const findMany = vi.fn(async () => [
      { deviceId: "device-1" },
      { deviceId: "device-1" },
      { deviceId: "device-2" },
      { deviceId: null }
    ]);
    const repository = new DeliveryAttemptRepository({
      deliveryAttempt: { findMany }
    } as never);

    const result = await repository.countSentByDeviceInWindow({
      deviceIds: ["device-1", "device-2", "device-3"],
      since,
      until
    });

    expect(result).toEqual(new Map([
      ["device-1", 2],
      ["device-2", 1]
    ]));
    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: "sent",
        deviceId: { in: ["device-1", "device-2", "device-3"] },
        attemptedAt: {
          gte: since,
          lte: until
        }
      },
      select: { deviceId: true }
    });
  });

  it("does not query rolling sent counts when the candidate device set is empty", async () => {
    const findMany = vi.fn();
    const repository = new DeliveryAttemptRepository({
      deliveryAttempt: { findMany }
    } as never);

    await expect(
      repository.countSentByDeviceInWindow({
        deviceIds: [],
        since: new Date("2026-06-12T00:00:00.000Z"),
        until: new Date("2026-06-12T00:01:00.000Z")
      })
    ).resolves.toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("summarizes daily delivery attempts in KST buckets with empty days", async () => {
    let sql = "";
    const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
      sql = Array.from(strings).join("?");
      return [
        { date: "2026-07-05", sent: 1n, queued: 0n, skipped: 0n, failed: 0n, total: 1n }
      ];
    });
    const findMany = vi.fn(() => { throw new Error("findMany must not be used for daily aggregation"); });
    const now = new Date("2026-07-05T07:30:00.000Z");
    const repository = new DeliveryAttemptRepository({
      deliveryAttempt: { findMany },
      $queryRaw: queryRaw
    } as never);

    const summary = await repository.summarizeDailyBuckets({ days: 2, now, timezone: "Asia/Seoul" });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
    // Production stores UTC values in a timestamp without time zone column.
    expect(sql).toContain("(\"attemptedAt\" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul'");
    expect(sql).not.toContain("to_char(\"attemptedAt\" AT TIME ZONE 'Asia/Seoul'");
    expect(sql).not.toContain("timezone('Asia/Seoul', \"attemptedAt\")");
    expect(summary).toEqual({
      timezone: "Asia/Seoul",
      days: 2,
      generatedAt: now.toISOString(),
      items: [
        { date: "2026-07-04", sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 },
        { date: "2026-07-05", sent: 1, queued: 0, skipped: 0, failed: 0, total: 1 }
      ],
      totals: { sent: 1, queued: 0, skipped: 0, failed: 0, total: 1 }
    });
  });

  it("returns zero-filled daily delivery trend when no records exist", async () => {
    const now = new Date("2026-07-02T03:00:00.000Z");
    const repository = new DeliveryAttemptRepository({
      deliveryAttempt: {},
      $queryRaw: vi.fn(async () => [])
    } as never);

    const summary = await repository.summarizeDailyBuckets({ days: 2, now, timezone: "Asia/Seoul" });

    expect(summary.items).toEqual([
      { date: "2026-07-01", sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 },
      { date: "2026-07-02", sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 }
    ]);
    expect(summary.totals).toEqual({ sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 });
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

describe("NotificationJobRepository worker operations", () => {
  const lockedAt = new Date("2026-06-12T00:00:00.000Z");
  const runAfter = new Date("2026-06-11T23:59:00.000Z");

  it("claims ready queued jobs in priority order", async () => {
    const calls: unknown[] = [];
    const prisma = {
      notificationJob: {
        async findMany(args: unknown) {
          calls.push({ method: "findMany", args });
          return [
            {
              id: "job-1",
              eventId: "event-1",
              priority: 1,
              status: "queued",
              runAfter,
              lockedAt: null,
              attempts: 0,
              lastError: null,
              createdAt: runAfter,
              updatedAt: runAfter
            }
          ];
        },
        async updateMany(args: unknown) {
          calls.push({ method: "updateMany", args });
          return { count: 1 };
        }
      }
    };
    const repository = new NotificationJobRepository(prisma);

    const jobs = await repository.claimReady({ limit: 10, lockedBy: "worker-1", now: lockedAt });

    expect(jobs).toEqual([
      {
        id: "job-1",
        eventId: "event-1",
        priority: 1,
        attempts: 0,
        runAfter,
        lockedAt,
        lockedBy: "worker-1"
      }
    ]);
    expect(calls).toEqual([
      {
        method: "findMany",
        args: {
          where: { status: "queued", runAfter: { lte: lockedAt } },
          orderBy: [{ priority: "asc" }, { runAfter: "asc" }, { createdAt: "asc" }],
          take: 10
        }
      },
      {
        method: "updateMany",
        args: {
          where: { id: { in: ["job-1"] }, status: "queued" },
          data: { status: "locked", lockedAt, lockedBy: "worker-1" }
        }
      }
    ]);
  });

  it("does not return jobs that another worker claimed first", async () => {
    const repository = new NotificationJobRepository({
      notificationJob: {
        async findMany() {
          return [
            {
              id: "job-1",
              eventId: "event-1",
              priority: 1,
              status: "queued",
              runAfter,
              lockedAt: null,
              attempts: 0,
              lastError: null,
              createdAt: runAfter,
              updatedAt: runAfter
            }
          ];
        },
        async updateMany() {
          return { count: 0 };
        }
      }
    });

    const jobs = await repository.claimReady({ limit: 10, lockedBy: "worker-1", now: lockedAt });

    expect(jobs).toEqual([]);
  });

  it("completes locked jobs", async () => {
    const calls: unknown[] = [];
    const repository = new NotificationJobRepository({
      notificationJob: {
        async update(args: unknown) {
          calls.push(args);
          return {};
        }
      }
    });

    await repository.complete("job-1");

    expect(calls).toEqual([
      {
        where: { id: "job-1" },
        data: { status: "completed", lockedAt: null, lockedBy: null }
      }
    ]);
  });

  it("requeues transient failures with retry time", async () => {
    const calls: unknown[] = [];
    const retryAt = new Date("2026-06-12T00:01:00.000Z");
    const repository = new NotificationJobRepository({
      notificationJob: {
        async update(args: unknown) {
          calls.push(args);
          return {};
        }
      }
    });

    await repository.fail({
      jobId: "job-1",
      attempts: 0,
      reason: "transient_push_failure",
      retryAt,
      terminal: false
    });

    expect(calls).toEqual([
      {
        where: { id: "job-1" },
        data: {
          status: "queued",
          lockedAt: null,
          lockedBy: null,
          attempts: { increment: 1 },
          lastError: "transient_push_failure",
          runAfter: retryAt
        }
      }
    ]);
  });

  it("marks terminal failures as failed", async () => {
    const calls: unknown[] = [];
    const repository = new NotificationJobRepository({
      notificationJob: {
        async update(args: unknown) {
          calls.push(args);
          return {};
        }
      }
    });

    await repository.fail({
      jobId: "job-1",
      attempts: 4,
      reason: "max_attempts_exceeded",
      terminal: true
    });

    expect(calls).toEqual([
      {
        where: { id: "job-1" },
        data: {
          status: "failed",
          lockedAt: null,
          lockedBy: null,
          attempts: { increment: 1 },
          lastError: "max_attempts_exceeded"
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

  it("uses the same album containment filter for public and admin repository lists", async () => {
    const calls: Array<{ where: Record<string, unknown> }> = [];
    const repository = new HubEventRepository({
      hubEvent: { findMany: async (args: { where: Record<string, unknown> }) => { calls.push(args); return []; } }
    });

    await repository.listPublished({ tag: "album" });
    await repository.listAdmin({ tag: "album" });

    expect(calls.map((call) => call.where.tags)).toEqual([{ has: "album" }, { has: "album" }]);
  });

  it("returns admin list pagination cursors while preserving cursor skip", async () => {
    const calls: unknown[] = [];
    const repository = new HubEventRepository({
      hubEvent: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [
            { ...record, id: "event-2" },
            { ...record, id: "event-3" },
            { ...record, id: "event-4" }
          ];
        }
      }
    });

    const result = await repository.listAdmin({ limit: 2, cursor: "event-1" });

    expect(calls).toEqual([
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 3,
        cursor: { id: "event-1" },
        skip: 1
      })
    ]);
    expect(result.items.map((item) => item.id)).toEqual(["event-2", "event-3"]);
    expect(result.nextCursor).toBe("event-4");
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
        },
        include: {
          links: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          scheduleItems: {
            include: { links: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
            orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }, { id: "asc" }]
          }
        }
      }
    ]);
  });

  it("returns label as the public title when a legacy schedule record has no title", async () => {
    const repository = new HubEventRepository({
      hubEvent: {
        async findFirst() {
          return {
            ...record,
            publicationState: "published",
            scheduleItems: [{
              id: "legacy-schedule",
              hubEventId: record.id,
              kind: "custom",
              title: null,
              label: "레거시 라벨",
              description: null,
              startsAt: now,
              endsAt: null,
              timePrecision: "datetime",
              timezone: "Asia/Seoul",
              actionUrl: null,
              sourceUrl: null,
              sourceLabel: null,
              notificationEligible: true,
              isPrimary: true,
              sortOrder: 0,
              cancelledAt: null,
              createdAt: now,
              updatedAt: now
            }]
          };
        }
      }
    });

    const event = await repository.getPublishedById(record.id);
    expect(event?.scheduleItems?.[0]).toMatchObject({
      title: "레거시 라벨",
      label: "레거시 라벨"
    });
    expect(event?.scheduleItems?.[0]).not.toHaveProperty("description");
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
    expect((calls[0] as { data: Record<string, unknown> }).data).not.toHaveProperty("id");
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

  it("updates parent and schedule items in one transaction and soft-cancels removed items", async () => {
    const calls: string[] = [];
    const scheduleWrites: unknown[] = [];
    const client = {
      hubEvent: {
        async update(args: { data: unknown }) {
          calls.push("parent:update");
          return { ...record, ...(args.data as object), scheduleMode: "timeline", scheduleItems: [] };
        },
        async findFirst() {
          calls.push("parent:read");
          return { ...record, scheduleMode: "timeline", scheduleItems: [] };
        }
      },
      hubEventScheduleItem: {
        async findMany() {
          calls.push("schedule:list");
          return [{ id: "keep" }, { id: "remove" }];
        },
        async update(args: unknown) {
          calls.push("schedule:update");
          scheduleWrites.push(args);
          return args;
        },
        async create(args: unknown) {
          calls.push("schedule:create");
          scheduleWrites.push(args);
          return { id: "created" };
        },
        async updateMany(args: unknown) {
          calls.push("schedule:cancel");
          scheduleWrites.push(args);
          return { count: 1 };
        }
      }
    };
    const transaction = async <T>(run: (transaction: typeof client) => Promise<T>) => {
        calls.push("transaction:start");
        const result = await run(client);
        calls.push("transaction:end");
        return result;
    };
    const repository = new HubEventRepository({
      ...client,
      $transaction: transaction as never
    } as never);

    await repository.update("event-1", {
      scheduleMode: "timeline",
      scheduleItems: [
        {
          id: "keep",
          kind: "sales_open",
          label: "예약 판매 시작",
          description: "   ",
          startsAt: "2026-06-13T00:00:00.000Z",
          timePrecision: "datetime",
          timezone: "Asia/Seoul",
          notificationEligible: true,
          isPrimary: true,
          sortOrder: 0
        },
        {
          kind: "release",
          label: "앨범 발매",
          startsAt: "2026-06-20T00:00:00.000Z",
          timePrecision: "datetime",
          timezone: "Asia/Seoul",
          notificationEligible: true,
          isPrimary: false,
          sortOrder: 1
        }
      ],
      actorId: "admin-2"
    });

    expect(calls).toEqual([
      "transaction:start",
      "parent:update",
      "schedule:list",
      "schedule:cancel",
      "schedule:update",
      "schedule:create",
      "schedule:cancel",
      "parent:read",
      "transaction:end"
    ]);
    expect(scheduleWrites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        where: { id: { in: ["remove"] }, hubEventId: "event-1", cancelledAt: null },
        data: { cancelledAt: expect.any(Date) }
      })
    ]));
    expect(scheduleWrites[0]).toEqual({
      where: { hubEventId: "event-1", isPrimary: true, cancelledAt: null },
      data: { isPrimary: false }
    });
    expect(scheduleWrites[1]).toEqual(expect.objectContaining({
      data: expect.objectContaining({ title: "예약 판매 시작", label: "예약 판매 시작", description: null })
    }));
  });

  it("synchronizes parent links by owner without accepting foreign link ids", async () => {
    const writes: unknown[] = [];
    const linkRecord = {
      id: "link-1",
      hubEventId: "event-1",
      scheduleItemId: null,
      kind: "purchase",
      label: null,
      url: "https://example.com/old",
      sortOrder: 0,
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
      updatedAt: new Date("2026-06-12T00:00:00.000Z")
    };
    const client = {
      hubEvent: {
        async update() { return { ...record, links: [linkRecord] }; },
        async findFirst() { return { ...record, links: [linkRecord] }; }
      },
      hubEventExternalLink: {
        async findMany() { return [linkRecord]; },
        async update(args: unknown) { writes.push({ method: "update", args }); return linkRecord; },
        async create(args: unknown) { writes.push({ method: "create", args }); return { ...linkRecord, id: "link-2" }; },
        async deleteMany(args: unknown) { writes.push({ method: "deleteMany", args }); return { count: 0 }; }
      }
    };
    const repository = new HubEventRepository(client as never);

    await repository.update("event-1", {
      links: [
        { id: "link-1", kind: "purchase", url: "https://example.com/new", sortOrder: 0 },
        { kind: "ticket", url: "https://example.com/ticket", sortOrder: 1 }
      ]
    });

    expect(writes).toEqual([
      expect.objectContaining({ method: "update", args: expect.objectContaining({ where: { id: "link-1" } }) }),
      expect.objectContaining({ method: "create", args: expect.objectContaining({
        data: expect.objectContaining({ hubEventId: "event-1", scheduleItemId: null, kind: "ticket" })
      }) })
    ]);

    await expect(repository.update("event-1", {
      links: [{ id: "foreign-link", kind: "source", url: "https://example.com/source", sortOrder: 0 }]
    })).rejects.toThrow("hub_event_link_not_found");
  });

  it("passes explicit null dates through update writes", async () => {
    const calls: unknown[] = [];
    const repository = new HubEventRepository({
      hubEvent: {
        update: async (args: unknown) => {
          calls.push(args);
          return record;
        }
      }
    });

    await repository.update("event-1", {
      endsAt: null,
      actorId: "admin-2"
    });

    expect(calls).toEqual([
      expect.objectContaining({
        where: { id: "event-1" },
        data: expect.objectContaining({
          endsAt: null,
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
