import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import type { AdapterHealthSource } from "../src/admin/adminTypes.js";
import { PlatformApiStateRepository } from "../src/repositories/platformApiStateRepository.js";

type FakeStateRecord = {
  source: AdapterHealthSource;
  key: string;
  value: Prisma.JsonValue;
  status: string;
  updatedAt: Date;
};

describe("PlatformApiStateRepository", () => {
  it("stores and reads CHZZK token state by source and key", async () => {
    const records = new Map<string, FakeStateRecord>();
    const repository = new PlatformApiStateRepository({
      platformApiState: {
        upsert: async ({ where, create, update }) => {
          const key = `${where.source_key.source}:${where.source_key.key}`;
          const existing = records.get(key);
          const record = {
            source: where.source_key.source as AdapterHealthSource,
            key: where.source_key.key,
            value: (existing ? update.value : create.value) as Prisma.JsonValue,
            status: existing ? update.status : create.status,
            updatedAt: new Date("2026-06-11T00:00:00.000Z")
          };
          records.set(key, record);
          return record;
        },
        findUnique: async ({ where }) => records.get(`${where.source_key.source}:${where.source_key.key}`) ?? null,
        findMany: async () => []
      }
    });

    await repository.upsertState("chzzk", "oauth.accessToken", { token: "access-token" }, "enabled");
    await repository.upsertState("chzzk", "oauth.refreshToken", { token: "refresh-token" }, "enabled");
    await repository.upsertState("chzzk", "oauth.expiresAt", { value: "2026-06-11T01:00:00.000Z" }, "enabled");
    await repository.upsertState("chzzk", "oauth.scope", { value: "live" }, "enabled");
    await repository.upsertState("chzzk", "oauth.tokenType", { value: "Bearer" }, "enabled");
    await repository.upsertState("chzzk", "oauth.lastRefreshedAt", { value: "2026-06-11T00:00:00.000Z" }, "enabled");

    await expect(repository.getState("chzzk", "oauth.accessToken")).resolves.toEqual({
      source: "chzzk",
      key: "oauth.accessToken",
      value: { token: "access-token" },
      status: "enabled",
      updatedAt: new Date("2026-06-11T00:00:00.000Z")
    });
    await expect(repository.getState("chzzk", "oauth.refreshToken")).resolves.toMatchObject({
      key: "oauth.refreshToken",
      value: { token: "refresh-token" }
    });
  });

  it("stores and returns the latest CHZZK adapter health", async () => {
    const records = new Map<string, FakeStateRecord>();
    const repository = new PlatformApiStateRepository({
      platformApiState: {
        upsert: async ({ where, create, update }) => {
          const key = `${where.source_key.source}:${where.source_key.key}`;
          const existing = records.get(key);
          const record = {
            source: where.source_key.source as AdapterHealthSource,
            key: where.source_key.key,
            value: (existing ? update.value : create.value) as Prisma.JsonValue,
            status: existing ? update.status : create.status,
            updatedAt: new Date("2026-06-11T00:10:00.000Z")
          };
          records.set(key, record);
          return record;
        },
        findUnique: async ({ where }) => records.get(`${where.source_key.source}:${where.source_key.key}`) ?? null,
        findMany: async ({ where }) =>
          Array.from(records.values()).filter((record) => record.key === where.key && where.source.in.includes(record.source))
      }
    });

    await repository.upsertAdapterHealth("chzzk", {
      source: "chzzk",
      status: "verify_required",
      reason: "chzzk_allowed_api_not_confirmed",
      lastCheckedAt: "2026-06-11T00:10:00.000Z"
    });

    await expect(repository.getLatestAdapterHealth("chzzk")).resolves.toEqual({
      source: "chzzk",
      status: "verify_required",
      reason: "chzzk_allowed_api_not_confirmed",
      lastCheckedAt: "2026-06-11T00:10:00.000Z"
    });
  });
});
