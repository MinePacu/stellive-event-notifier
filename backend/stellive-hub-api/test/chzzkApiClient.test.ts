import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { ChzzkApiClient } from "../src/adapters/chzzk/chzzkApiClient.js";
import type { ChzzkTokenResponse } from "../src/adapters/chzzk/chzzkAuthClient.js";
import { ChzzkAuthClient, ChzzkTokenResponseError } from "../src/adapters/chzzk/chzzkAuthClient.js";

const authConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:4000/v1/auth/chzzk/callback"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("ChzzkAuthClient", () => {
  it("builds authorization URL without exposing client secret", () => {
    const client = new ChzzkAuthClient(authConfig);
    const url = new URL(client.buildAuthorizeUrl({ state: "signed-state" }));

    expect(url.origin + url.pathname).toBe("https://chzzk.naver.com/account-interlock");
    expect(url.searchParams.get("clientId")).toBe("client-id");
    expect(url.searchParams.get("redirectUri")).toBe(authConfig.redirectUri);
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.toString()).not.toContain("client-secret");
  });

  it("adds configured OAuth scopes to the authorization URL", () => {
    const client = new ChzzkAuthClient({ ...authConfig, scopes: "user:read channel:read live:read" });
    const url = new URL(client.buildAuthorizeUrl({ state: "signed-state" }));

    expect(url.searchParams.get("scope")).toBe("user:read channel:read live:read");
  });

  it("exchanges an authorization code server-side", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresIn: "86400",
        scope: "live"
      })
    );
    const client = new ChzzkAuthClient(authConfig, { fetch: fetchMock });

    await expect(client.exchangeCodeForToken({ code: "auth-code", state: "signed-state" })).resolves.toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenType: "Bearer",
      expiresIn: 86400,
      scope: "live"
    });

    const body = parseRequestBody(fetchMock.mock.calls[0][1].body);
    expect(body.grantType).toBe("authorization_code");
    expect(body.code).toBe("auth-code");
    expect(body.clientId).toBe(authConfig.clientId);
    expect(body.clientSecret).toBe(authConfig.clientSecret);
    expect(body.redirectUri).toBe(authConfig.redirectUri);
  });

  it("accepts CHZZK token responses wrapped in content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 200,
        message: "OK",
        content: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          tokenType: "Bearer",
          expiresIn: "86400",
          scope: "live"
        }
      })
    );
    const client = new ChzzkAuthClient(authConfig, { fetch: fetchMock });

    await expect(client.exchangeCodeForToken({ code: "auth-code", state: "signed-state" })).resolves.toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenType: "Bearer",
      expiresIn: 86400,
      scope: "live"
    });
  });

  it("refreshes access tokens server-side", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        tokenType: "Bearer",
        expiresIn: 3600
      })
    );
    const client = new ChzzkAuthClient(authConfig, { fetch: fetchMock });

    await expect(client.refreshAccessToken({ refreshToken: "refresh-token" })).resolves.toMatchObject({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token"
    });

    const body = parseRequestBody(fetchMock.mock.calls[0][1].body);
    expect(body.grantType).toBe("refresh_token");
    expect(body.refreshToken).toBe("refresh-token");
    expect(body.clientId).toBe(authConfig.clientId);
    expect(body.clientSecret).toBe(authConfig.clientSecret);
  });

  it("throws a typed error for malformed token responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ accessToken: "missing-fields" }));
    const client = new ChzzkAuthClient(authConfig, { fetch: fetchMock });

    await expect(client.exchangeCodeForToken({ code: "auth-code", state: "signed-state" })).rejects.toBeInstanceOf(
      ChzzkTokenResponseError
    );
  });
});

describe("ChzzkApiClient", () => {
  it("reads an access token, sends bearer auth, and maps live status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        content: {
          channelId: "chzzk-channel-id",
          status: "OPEN",
          liveTitle: "Live title",
          openDate: "2026-06-11T03:00:00.000Z",
          concurrentUserCount: 1234,
          liveUrl: "https://chzzk.naver.com/live/chzzk-channel-id"
        }
      })
    );
    const stateRepository = fakeStateRepository({ "oauth.accessToken": "access-token" });
    const client = new ChzzkApiClient(fakeAuthClient(), stateRepository, {}, { fetch: fetchMock });

    await expect(client.getLiveStatus("chzzk-channel-id")).resolves.toEqual({
      channelId: "chzzk-channel-id",
      isLive: true,
      title: "Live title",
      openDate: "2026-06-11T03:00:00.000Z",
      viewerCount: 1234,
      platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
      sourceVerificationState: "verified"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openapi.chzzk.naver.com/open/v1/lives/chzzk-channel-id",
      expect.objectContaining({
        headers: {
          authorization: "Bearer access-token"
        }
      })
    );
  });

  it("refreshes the access token once after 401 and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ content: { status: "OPEN", title: "After refresh" } }));
    const stateRepository = fakeStateRepository({
      "oauth.accessToken": "expired-access-token",
      "oauth.refreshToken": "refresh-token"
    });
    const authClient = fakeAuthClient({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: "live"
    });
    const client = new ChzzkApiClient(authClient, stateRepository, {}, { fetch: fetchMock });

    await expect(client.getLiveStatus("chzzk-channel-id")).resolves.toMatchObject({
      isLive: true,
      title: "After refresh",
      sourceVerificationState: "verified"
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://openapi.chzzk.naver.com/open/v1/lives/chzzk-channel-id",
      expect.objectContaining({
        headers: {
          authorization: "Bearer new-access-token"
        }
      })
    );
    expect(stateRepository.getWrittenState("oauth.accessToken")).toBe("new-access-token");
    expect(stateRepository.getWrittenState("oauth.refreshToken")).toBe("new-refresh-token");
    expect(stateRepository.getWrittenState("oauth.scope")).toBe("live");
  });

  it("writes rate limited health after 429", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "rate limited" }, 429));
    const stateRepository = fakeStateRepository({ "oauth.accessToken": "access-token" });
    const client = new ChzzkApiClient(fakeAuthClient(), stateRepository, {}, { fetch: fetchMock });

    await expect(client.getLiveStatus("chzzk-channel-id")).resolves.toMatchObject({
      channelId: "chzzk-channel-id",
      isLive: false,
      sourceVerificationState: "verify_required"
    });
    expect(stateRepository.health).toMatchObject({
      source: "chzzk",
      status: "rate_limited",
      reason: "chzzk_live_api_rate_limited"
    });
  });

  it("returns verify_required for unknown response shapes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ unexpected: true }));
    const stateRepository = fakeStateRepository({ "oauth.accessToken": "access-token" });
    const client = new ChzzkApiClient(fakeAuthClient(), stateRepository, {}, { fetch: fetchMock });

    await expect(client.getLiveStatus("chzzk-channel-id")).resolves.toMatchObject({
      channelId: "chzzk-channel-id",
      isLive: false,
      sourceVerificationState: "verify_required"
    });
  });
});

function fakeAuthClient(
  token: ChzzkTokenResponse = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenType: "Bearer",
    expiresIn: 3600
  }
) {
  return {
    refreshAccessToken: vi.fn().mockResolvedValue(token)
  };
}

function parseRequestBody(body: BodyInit): Record<string, string> {
  if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
  if (typeof body === "string") return JSON.parse(body);
  throw new Error("unsupported_request_body");
}

function fakeStateRepository(initialState: Record<string, unknown>) {
  const writtenState = new Map<string, unknown>();
  const repository = {
    health: undefined as unknown,
    getState: vi.fn(async (_source: string, key: string) => ({
      source: "chzzk",
      key,
      value: (writtenState.has(key) ? writtenState.get(key) : initialState[key]) as Prisma.JsonValue,
      status: "enabled",
      updatedAt: new Date("2026-06-11T00:00:00.000Z")
    })),
    upsertState: vi.fn(async (_source: string, key: string, value: Prisma.InputJsonValue) => {
      writtenState.set(key, value);
      return {};
    }),
    upsertAdapterHealth: vi.fn(async (_source: string, health: unknown) => {
      repository.health = health;
      return {};
    }),
    getWrittenState(key: string) {
      return writtenState.get(key);
    }
  };

  return repository;
}
