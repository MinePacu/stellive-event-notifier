import { describe, expect, it, vi } from "vitest";
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

function parseRequestBody(body: BodyInit | null | undefined): Record<string, unknown> {
  expect(typeof body).toBe("string");
  return JSON.parse(body as string) as Record<string, unknown>;
}
