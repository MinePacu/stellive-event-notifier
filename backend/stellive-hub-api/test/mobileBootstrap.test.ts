import { describe, expect, it, vi } from "vitest";
import BootstrapService from "../src/mobile/bootstrapService.js";
import { buildApp } from "../src/app.js";
import { mobileApiContractVersion } from "../../../shared/schemas/mobileApi.js";
import type {
  BootstrapResponse,
  RegisterDeviceRequest,
  UpdateDeviceTokenRequest,
  UpdatePreferencesRequest,
} from "../../../shared/schemas/mobileApi.js";

describe("mobile API contract", () => {
  it("exposes a versioned shared mobile API contract", () => {
    expect(mobileApiContractVersion).toBe("mobile-api-v1");
  });

  it("models the mobile bootstrap snapshot without raw provider payloads", () => {
    const response = {
      config: {
        unofficialProject: true,
        catalogVersion: "seed-2026-06-01",
        officialYoutubeLiveExcluded: true,
        hubCalendarEnabled: true,
        foregroundRealtimeEnabled: false,
      },
      device: {
        deviceId: "device-1",
        registered: true,
        tokenStatus: "active",
      },
      catalog: {
        generations: [],
        members: [],
      },
      preferences: [],
      liveStatus: [],
      hubEventsSummary: {
        openCount: 0,
        upcomingCount: 0,
        closingSoonCount: 0,
        preview: [],
      },
      serverTime: "2026-06-11T00:00:00.000Z",
    } satisfies BootstrapResponse;

    expect(response.config.officialYoutubeLiveExcluded).toBe(true);
    expect(JSON.stringify(response)).not.toContain("rawPayload");
    expect(JSON.stringify(response)).not.toContain("providerResponse");
  });

  it("models device registration, token update, and preference update requests", () => {
    const registration = {
      platform: "android",
      appVersion: "0.1.0",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      installationId: "install-1",
    } satisfies RegisterDeviceRequest;

    const tokenUpdate = {
      deviceId: "device-1",
      platform: "android",
      provider: "fcm",
      token: "runtime-token",
      appVersion: "0.1.0",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
    } satisfies UpdateDeviceTokenRequest;

    const preferences = {
      deviceId: "device-1",
      preferences: [],
      clientUpdatedAt: "2026-06-11T00:00:00.000Z",
    } satisfies UpdatePreferencesRequest;

    expect(registration.platform).toBe("android");
    expect(tokenUpdate.provider).toBe("fcm");
    expect(preferences.preferences).toEqual([]);
  });
});

describe("mobile bootstrap routes", () => {
  const routeEnv = {
    DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  };

  it("returns the bootstrap snapshot from the injected bootstrap service", async () => {
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          bootstrap: {
            getBootstrap: async () => ({
              config: {
                unofficialProject: true,
                catalogVersion: "route-service",
                officialYoutubeLiveExcluded: true,
                hubCalendarEnabled: true,
                foregroundRealtimeEnabled: false,
              },
              device: {
                deviceId: "device-1",
                registered: true,
                tokenStatus: "active",
              },
              catalog: {
                generations: [],
                members: [],
              },
              preferences: [],
              liveStatus: [],
              hubEventsSummary: {
                openCount: 0,
                upcomingCount: 0,
                closingSoonCount: 0,
                preview: [],
              },
              serverTime: "2026-06-11T03:00:00.000Z",
            }),
          },
        },
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/bootstrap?deviceId=device-1&platform=android&appVersion=0.1.0",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      config: {
        catalogVersion: "route-service",
      },
      device: {
        deviceId: "device-1",
        tokenStatus: "active",
      },
      serverTime: "2026-06-11T03:00:00.000Z",
    });
  });

  it("builds a repository-backed bootstrap service with mobile-safe live status", async () => {
    const app = await buildApp({
      env: { ...routeEnv, HUB_EVENTS_STORAGE_MODE: "prisma" },
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          devices: {
            getDevice: async () => ({ deviceId: "device-1", tokenStatus: "active" as const })
          },
          preferences: {
            listForDevice: async () => []
          },
          liveStatus: {
            listDiagnostics: async () => [
              {
                memberId: "ayatsuno-yuni",
                generationId: "gen1",
                isLive: true,
                title: "Live title",
                liveCategory: "Just Chatting",
                viewerCount: 123,
                startedAt: "2026-06-11T03:00:00.000Z",
                platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
                lastCheckedAt: "2026-06-11T03:01:00.000Z",
                sourceVerificationState: "verified" as const
              }
            ]
          },
          hubEvents: {
            list: async () => ({ items: [], total: 0 }),
            getById: async () => undefined,
            summary: async () => ({ openCount: 0, upcomingCount: 0, closingSoonCount: 0, preview: [] })
          }
        }
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/bootstrap?deviceId=device-1&platform=android&appVersion=0.1.0"
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      device: {
        deviceId: "device-1",
        tokenStatus: "active"
      },
      liveStatus: [
        {
          memberId: "ayatsuno-yuni",
          generationId: "gen1",
          isLive: true,
          title: "Live title",
          liveCategory: "Just Chatting",
          viewerCount: 123,
          startedAt: "2026-06-11T03:00:00.000Z",
          platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
          lastCheckedAt: "2026-06-11T03:01:00.000Z",
          sourceVerificationState: "verified"
        }
      ]
    });
    expect(JSON.stringify(response.json())).not.toContain("accessToken");
    expect(JSON.stringify(response.json())).not.toContain("raw");
  });
});

describe("BootstrapService", () => {
  it("caches only shared bootstrap data and refreshes it after TTL expiry", async () => {
    let now = new Date("2026-07-04T00:00:00.000Z");
    let requestVersion = 0;
    const getGenerations = vi.fn(() => []);
    const getMembers = vi.fn(() => []);
    const getDevice = vi.fn(async () => ({
      deviceId: "device-1",
      tokenStatus: requestVersion === 0 ? "active" : "invalid",
    }));
    const listForDevice = vi.fn(async () => requestVersion === 0 ? [] : [{
      deviceId: "device-1",
      scope: "global" as const,
      enabled: false,
      explicitOverride: true,
      tapAction: "open_app" as const,
      deliveryMode: "standard" as const,
      updatedAt: now.toISOString(),
    }]);
    const listDiagnostics = vi.fn(async () => []);
    const hydrateMembers = vi.fn(async (members) => members);
    const summary = vi.fn(async () => ({
      openCount: 0,
      upcomingCount: 0,
      closingSoonCount: 0,
      preview: [],
    }));
    const service = new BootstrapService({
      catalog: { getGenerations, getMembers },
      devices: { getDevice },
      preferences: { listForDevice },
      liveStatus: { listDiagnostics },
      memberProfileImages: { hydrateMembers },
      hubEvents: { summary },
      clock: () => now,
      cacheTtlSeconds: { catalog: 1, liveStatus: 1, hubEventsSummary: 1 },
    });

    const first = await service.getBootstrap({ deviceId: "device-1" });
    requestVersion = 1;
    now = new Date("2026-07-04T00:00:00.500Z");
    const second = await service.getBootstrap({ deviceId: "device-1" });

    expect(first.device?.tokenStatus).toBe("active");
    expect(second.device?.tokenStatus).toBe("invalid");
    expect(second.preferences).toHaveLength(1);
    expect(second.serverTime).toBe("2026-07-04T00:00:00.500Z");
    expect(getDevice).toHaveBeenCalledTimes(2);
    expect(listForDevice).toHaveBeenCalledTimes(2);
    expect(getGenerations).toHaveBeenCalledTimes(1);
    expect(getMembers).toHaveBeenCalledTimes(1);
    expect(hydrateMembers).toHaveBeenCalledTimes(1);
    expect(listDiagnostics).toHaveBeenCalledTimes(1);
    expect(summary).toHaveBeenCalledTimes(1);

    now = new Date("2026-07-04T00:00:01.000Z");
    await service.getBootstrap({ deviceId: "device-1" });

    expect(getGenerations).toHaveBeenCalledTimes(2);
    expect(getMembers).toHaveBeenCalledTimes(2);
    expect(hydrateMembers).toHaveBeenCalledTimes(2);
    expect(listDiagnostics).toHaveBeenCalledTimes(2);
    expect(summary).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent shared bootstrap cache misses", async () => {
    let resolveLiveStatus!: (value: []) => void;
    const listDiagnostics = vi.fn(() => new Promise<[]>((resolve) => {
      resolveLiveStatus = resolve;
    }));
    const hydrateMembers = vi.fn(async (members) => members);
    const summary = vi.fn(async () => ({
      openCount: 0,
      upcomingCount: 0,
      closingSoonCount: 0,
      preview: [],
    }));
    const service = new BootstrapService({
      catalog: { getGenerations: () => [], getMembers: () => [] },
      devices: { getDevice: async () => undefined },
      preferences: { listForDevice: async () => [] },
      liveStatus: { listDiagnostics },
      memberProfileImages: { hydrateMembers },
      hubEvents: { summary },
    });

    const requests = [
      service.getBootstrap({}),
      service.getBootstrap({}),
      service.getBootstrap({}),
    ];
    await Promise.resolve();
    resolveLiveStatus([]);
    await Promise.all(requests);

    expect(listDiagnostics).toHaveBeenCalledTimes(1);
    expect(hydrateMembers).toHaveBeenCalledTimes(1);
    expect(summary).toHaveBeenCalledTimes(1);
  });

  it("assembles a policy-safe server bootstrap snapshot", async () => {
    const service = new BootstrapService({
      catalog: {
        getGenerations: () => [
      {
        id: "gen1",
        displayName: "1기생",
        unitName: "1기생",
        sortOrder: 1,
        type: "generation",
        notificationDefaultEnabled: true,
      },
      {
        id: "official",
        displayName: "기타",
        unitName: "기타",
        sortOrder: 99,
        type: "official",
        notificationDefaultEnabled: true,
      },
        ],
        getMembers: () => [
          {
            id: "ayatsuno-yuni",
            koreanName: "아야츠노 유니",
            englishName: "Ayatsuno Yuni",
            generationId: "gen1",
            generationName: "1기생",
            unitName: "1기생",
            catalogRole: "member",
            activeStatus: "active",
            isPerson: true,
            avatar: { preferredSource: "placeholder", licenseStatus: "unknown" },
            platforms: {
            externalUrls: {},
          },
            supportedEventTypes: ["chzzk_live_started"],
          },
          {
            id: "former-member",
            koreanName: "Former",
            englishName: "Former",
            generationId: "gen1",
            generationName: "1기생",
            unitName: "1기생",
            catalogRole: "member",
            activeStatus: "former",
            isPerson: true,
            avatar: { preferredSource: "placeholder", licenseStatus: "unknown" },
            platforms: {
            externalUrls: {},
          },
            supportedEventTypes: [],
          },
        ],
      },
      devices: {
        getDevice: async () => ({ deviceId: "device-1", tokenStatus: "active" }),
      },
      preferences: {
        listForDevice: async () => [
          {
            deviceId: "device-1",
            scope: "global",
            enabled: true,
            explicitOverride: true,
            tapAction: "open_app",
            deliveryMode: "standard",
            updatedAt: "2026-06-11T00:00:00.000Z",
          },
        ],
      },
      liveStatus: {
        listDiagnostics: async () => [
          {
            memberId: "ayatsuno-yuni",
            generationId: "gen1",
            platform: "chzzk",
            isLive: true,
            title: "Live",
            liveCategory: "Just Chatting",
            viewerCount: 100,
            startedAt: "2026-06-11T00:00:00.000Z",
            platformUrl: "https://chzzk.naver.com/live/channel",
            lastCheckedAt: "2026-06-11T00:01:00.000Z",
            sourceVerificationState: "verified",
          },
          {
            memberId: "sakihane-huya",
            generationId: "gen1",
            platform: "chzzk",
            isLive: true,
            title: undefined,
            liveCategory: "Talk",
            viewerCount: 50,
            startedAt: "2026-06-11T00:30:00.000Z",
            platformUrl: "https://chzzk.naver.com/live/unverified-channel",
            lastCheckedAt: "2026-06-11T00:31:00.000Z",
            sourceVerificationState: "verify_required",
          },
          {
            memberId: "shirayuki-hina",
            generationId: "gen2",
            platform: "chzzk",
            isLive: false,
            title: undefined,
            viewerCount: undefined,
            startedAt: undefined,
            lastCheckedAt: "2026-06-11T00:32:00.000Z",
            sourceVerificationState: "verified",
          },
        ],
      },
      hubEvents: {
        summary: () => ({
        openCount: 1,
        upcomingCount: 2,
        closingSoonCount: 3,
        preview: [],
        }),
      },
      clock: () => new Date("2026-06-11T03:00:00.000Z"),
    });

    const bootstrap = await service.getBootstrap({ deviceId: "device-1" });

    expect(bootstrap.config).toMatchObject({
      unofficialProject: true,
      officialYoutubeLiveExcluded: true,
      hubCalendarEnabled: true,
      foregroundRealtimeEnabled: false,
    });
    expect(bootstrap.device).toEqual({
      deviceId: "device-1",
      registered: true,
      tokenStatus: "active",
    });
    expect(bootstrap.catalog.members.map((member) => member.id)).toEqual([
      "ayatsuno-yuni",
    ]);
    expect(bootstrap.preferences).toHaveLength(1);
    expect(bootstrap.liveStatus).toHaveLength(3);
    expect(bootstrap.liveStatus[0]).toMatchObject({
      memberId: "ayatsuno-yuni",
      generationId: "gen1",
      platform: "chzzk",
      isLive: true,
      title: "Live",
      liveCategory: "Just Chatting",
      viewerCount: 100,
      startedAt: "2026-06-11T00:00:00.000Z",
      platformUrl: "https://chzzk.naver.com/live/channel",
      lastCheckedAt: "2026-06-11T00:01:00.000Z",
    });
    expect(bootstrap.liveStatus[1]).toEqual({
      memberId: "sakihane-huya",
      generationId: "gen1",
      platform: "chzzk",
      isLive: false,
      title: undefined,
      liveCategory: undefined,
      viewerCount: undefined,
      startedAt: undefined,
      platformUrl: "https://chzzk.naver.com/live/unverified-channel",
      lastCheckedAt: "2026-06-11T00:31:00.000Z",
      sourceVerificationState: "verify_required",
    });
    expect(bootstrap.liveStatus[2]).toMatchObject({
      memberId: "shirayuki-hina",
      isLive: false,
      sourceVerificationState: "verified",
    });
    expect(bootstrap.hubEventsSummary.openCount).toBe(1);
    expect(bootstrap.serverTime).toBe("2026-06-11T03:00:00.000Z");
    expect(JSON.stringify(bootstrap)).not.toContain("rawPayload");
    expect(JSON.stringify(bootstrap)).not.toContain("deviceToken");
  });
});
