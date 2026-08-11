import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

const authHeaders = { authorization: "Bearer internal-test-token" };

const testEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_CLIENT_ID: "client-id",
  CHZZK_CLIENT_SECRET: "client-secret",
  CHZZK_REDIRECT_URI: "http://localhost:4000/v1/auth/chzzk/callback",
  CHZZK_AUTH_STATE_SECRET: "local-state-secret",
  CHZZK_OAUTH_ENABLED: "true"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function fakeAdapterHealth(hasToken: boolean) {
  return {
    getState: vi.fn(async (_source: string, key: string) => {
      if (!hasToken || key !== "oauth.accessToken") return null;
      return {
        source: "chzzk",
        key,
        value: "access-token" as Prisma.JsonValue,
        status: "enabled",
        updatedAt: new Date("2026-06-14T00:00:00.000Z")
      };
    }),
    upsertState: vi.fn(),
    upsertAdapterHealth: vi.fn(),
    listAdapterHealth: vi.fn(async () => [])
  };
}

function fakeLiveStatusRepository() {
  const writes: unknown[] = [];
  return {
    writes,
    getByMemberId: vi.fn(async () => null),
    upsertLiveStatus: vi.fn(async (input: unknown) => {
      writes.push(input);
      return input as never;
    }),
    listDiagnostics: vi.fn(async () => [])
  };
}

describe("CHZZK live API wiring", () => {
  it("keeps scheduler disabled while CHZZK live polling flag is off", async () => {
    const app = await buildApp({
      env: { ...testEnv, CHZZK_LIVE_POLLING_ENABLED: "false" },
      useProcessEnv: false
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status",
      headers: authHeaders
    });

    await app.close();
    expect(response.json()).toEqual({
      status: "disabled",
      reason: "chzzk_live_polling_disabled"
    });
  });

  it("reports verify_required when OAuth token state is missing", async () => {
    const app = await buildApp({
      env: { ...testEnv, CHZZK_LIVE_POLLING_ENABLED: "true" },
      useProcessEnv: false,
      internalRoutes: {
        dependencies: {
          adapterHealth: fakeAdapterHealth(false)
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status",
      headers: authHeaders
    });

    await app.close();
    expect(response.json()).toEqual({
      status: "verify_required",
      reason: "chzzk_oauth_token_missing"
    });
  });

  it("polls CHZZK and writes normalized live status through default app wiring", async () => {
    const liveStatus = fakeLiveStatusRepository();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        content: {
          channelId: "chzzk-channel-id",
          status: "CLOSE",
          liveTitle: "Offline"
        }
      })
    );
    const app = await buildApp({
      env: { ...testEnv, CHZZK_LIVE_POLLING_ENABLED: "true" },
      useProcessEnv: false,
      chzzkLiveApiFetch: fetchMock,
      chzzkObservationWriter: {
        observe: vi.fn(async (input) => {
          liveStatus.writes.push(input.status);
          return { eventCreated: false };
        })
      },
      internalRoutes: {
        dependencies: {
          adapterHealth: fakeAdapterHealth(true),
          liveStatus
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status",
      headers: authHeaders
    });

    await app.close();
    expect(response.json()).toMatchObject({ status: "ok" });
    expect(fetchMock).toHaveBeenCalled();
    expect(liveStatus.writes.length).toBeGreaterThan(0);
    const requestedUrls = (fetchMock.mock.calls as unknown[][]).map(([url]) => String(url));
    expect(requestedUrls.join("\n")).not.toContain("official");
  });
});
