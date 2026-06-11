import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { LiveStatusRepository } from "../src/repositories/liveStatusRepository.js";

describe("live status route", () => {
  it("returns a startedAt timestamp for current CHZZK live entries", async () => {
    const app = await buildApp();

    const response = await app.inject({ method: "GET", url: "/v1/live-status" });

    await app.close();
    expect(response.statusCode).toBe(200);
    const statuses = response.json();
    const live = statuses.find((status: { memberId: string }) => status.memberId === "ayatsuno-yuni");
    expect(live).toMatchObject({ isLive: true, platform: "chzzk" });
    expect(live.startedAt).toBe("2026-06-02T09:00:00.000Z");
  });

  it("returns repository-backed live status rows without raw provider payloads", async () => {
    const app = await buildApp({
      appRoutes: {
        dependencies: {
          liveStatus: {
            listDiagnostics: async () => [
              {
                memberId: "ayatsuno-yuni",
                generationId: "gen1",
                isLive: true,
                title: "Persisted live title",
                viewerCount: 321,
                startedAt: "2026-06-11T03:00:00.000Z",
                platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
                lastCheckedAt: "2026-06-11T03:01:00.000Z",
                sourceVerificationState: "verified"
              }
            ]
          }
        }
      }
    });

    const response = await app.inject({ method: "GET", url: "/v1/live-status" });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        memberId: "ayatsuno-yuni",
        generationId: "gen1",
        platform: "chzzk",
        isLive: true,
        title: "Persisted live title",
        viewerCount: 321,
        startedAt: "2026-06-11T03:00:00.000Z",
        platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
        lastCheckedAt: "2026-06-11T03:01:00.000Z",
        sourceVerificationState: "verified"
      }
    ]);
    expect(response.body).not.toContain("rawPayload");
  });
});

describe("LiveStatusRepository", () => {
  it("upserts and reads live status for transition checks", async () => {
    const records = new Map<string, any>();
    const repository = new LiveStatusRepository({
      liveStatus: {
        upsert: async ({ where, create, update }) => {
          const record = records.has(where.memberId) ? { ...records.get(where.memberId), ...update } : create;
          records.set(where.memberId, record);
          return record;
        },
        findUnique: async ({ where }) => records.get(where.memberId) ?? null,
        findMany: async () => []
      }
    });

    await repository.upsertLiveStatus({
      memberId: "ayatsuno-yuni",
      generationId: "gen1",
      isLive: true,
      title: "Live title",
      viewerCount: 123,
      startedAt: new Date("2026-06-11T03:00:00.000Z"),
      platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
      sourceVerificationState: "verified",
      lastCheckedAt: new Date("2026-06-11T03:01:00.000Z"),
      lastTransitionAt: new Date("2026-06-11T03:00:00.000Z")
    });

    await expect(repository.getByMemberId("ayatsuno-yuni")).resolves.toMatchObject({
      memberId: "ayatsuno-yuni",
      generationId: "gen1",
      isLive: true,
      title: "Live title",
      viewerCount: 123,
      startedAt: new Date("2026-06-11T03:00:00.000Z"),
      platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
      sourceVerificationState: "verified",
      lastTransitionAt: new Date("2026-06-11T03:00:00.000Z")
    });
  });

  it("keeps diagnostics normalized without raw provider payloads", async () => {
    const repository = new LiveStatusRepository({
      liveStatus: {
        upsert: async () => {
          throw new Error("not_used");
        },
        findUnique: async () => null,
        findMany: async () => [
          {
            memberId: "ayatsuno-yuni",
            generationId: "gen1",
            isLive: true,
            title: "Live title",
            viewerCount: 123,
            startedAt: new Date("2026-06-11T03:00:00.000Z"),
            platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
            lastCheckedAt: new Date("2026-06-11T03:01:00.000Z"),
            sourceVerificationState: "verified"
          }
        ]
      }
    });

    const diagnostics = await repository.listDiagnostics();

    expect(diagnostics[0]).toEqual({
      memberId: "ayatsuno-yuni",
      generationId: "gen1",
      isLive: true,
      title: "Live title",
      viewerCount: 123,
      startedAt: "2026-06-11T03:00:00.000Z",
      platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
      lastCheckedAt: "2026-06-11T03:01:00.000Z",
      sourceVerificationState: "verified"
    });
    expect(JSON.stringify(diagnostics)).not.toContain("raw");
  });
});
