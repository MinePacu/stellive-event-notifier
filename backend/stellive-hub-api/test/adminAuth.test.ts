import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import {
  adminSessionCookieName,
  authenticateAdminSessionCookie,
  authenticateBearerToken,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  getConfiguredSecretState,
  shouldEnableAdminConsole
} from "../src/admin/adminAuth.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub"
};

describe("admin console environment", () => {
  it("keeps the admin console disabled by default", () => {
    const env = loadEnv(baseEnv);

    expect(env.ADMIN_CONSOLE_ENABLED).toBe(false);
    expect(shouldEnableAdminConsole(env)).toBe(false);
  });

  it("does not enable the admin console without an admin token", () => {
    const env = loadEnv({ ...baseEnv, ADMIN_CONSOLE_ENABLED: "true" });

    expect(shouldEnableAdminConsole(env)).toBe(false);
  });

  it("does not enable the admin console with blank or whitespace-only tokens", () => {
    const blankEnv = loadEnv({ ...baseEnv, ADMIN_CONSOLE_ENABLED: "true", ADMIN_CONSOLE_TOKEN: "" });
    const whitespaceEnv = loadEnv({ ...baseEnv, ADMIN_CONSOLE_ENABLED: "true", ADMIN_CONSOLE_TOKEN: "   " });

    expect(shouldEnableAdminConsole(blankEnv)).toBe(false);
    expect(shouldEnableAdminConsole(whitespaceEnv)).toBe(false);
  });

  it("does not enable the admin console with placeholder tokens", () => {
    const env = loadEnv({
      ...baseEnv,
      ADMIN_CONSOLE_ENABLED: "true",
      ADMIN_CONSOLE_TOKEN: "replace_with_admin_console_token"
    });
    const genericPlaceholderEnv = loadEnv({
      ...baseEnv,
      ADMIN_CONSOLE_ENABLED: "true",
      ADMIN_CONSOLE_TOKEN: "replace_with_internal_api_token"
    });

    expect(shouldEnableAdminConsole(env)).toBe(false);
    expect(shouldEnableAdminConsole(genericPlaceholderEnv)).toBe(false);
  });

  it("enables the admin console when the flag and token are configured", () => {
    const env = loadEnv({
      ...baseEnv,
      ADMIN_CONSOLE_ENABLED: "true",
      ADMIN_CONSOLE_TOKEN: "admin-token"
    });

    expect(shouldEnableAdminConsole(env)).toBe(true);
  });

  it("reports secret readiness without exposing values", () => {
    const state = getConfiguredSecretState({
      INTERNAL_API_TOKEN: "internal-token",
      ADMIN_CONSOLE_TOKEN: undefined,
      FCM_PRIVATE_KEY: "firebase-private-key",
      YOUTUBE_WEBSUB_VERIFY_TOKEN: "",
      CHZZK_CLIENT_SECRET: "replace_with_chzzk_client_secret"
    });

    expect(state).toEqual({
      INTERNAL_API_TOKEN: "configured",
      ADMIN_CONSOLE_TOKEN: "missing",
      FCM_PRIVATE_KEY: "configured",
      YOUTUBE_WEBSUB_VERIFY_TOKEN: "missing",
      CHZZK_CLIENT_SECRET: "missing"
    });
  });

  it("reports verify_required placeholder secrets as missing", () => {
    expect(getConfiguredSecretState({ CHZZK_CLIENT_ID: "verify_required" })).toEqual({
      CHZZK_CLIENT_ID: "missing"
    });
  });
});

describe("bearer token authentication", () => {
  it("accepts the expected bearer token", () => {
    expect(authenticateBearerToken("Bearer internal-token", "internal-token")).toEqual({ ok: true });
  });

  it("accepts case-insensitive bearer schemes with extra spaces", () => {
    expect(authenticateBearerToken("bearer   internal-token", "internal-token")).toEqual({ ok: true });
    expect(authenticateBearerToken("BEARER internal-token", "internal-token")).toEqual({ ok: true });
  });

  it("rejects missing tokens", () => {
    expect(authenticateBearerToken(undefined, "internal-token")).toEqual({
      ok: false,
      reason: "missing_authorization"
    });
  });

  it("rejects malformed authorization headers", () => {
    expect(authenticateBearerToken("Basic abc", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_authorization_scheme"
    });
    expect(authenticateBearerToken("Bearer", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_authorization_scheme"
    });
    expect(authenticateBearerToken("Bearer    ", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_authorization_scheme"
    });
    expect(authenticateBearerToken("Bearer internal-token extra", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_authorization_scheme"
    });
  });

  it("rejects invalid bearer tokens", () => {
    expect(authenticateBearerToken("Bearer wrong-token", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_token"
    });
    expect(authenticateBearerToken("Bearer different-length-token", "internal-token")).toEqual({
      ok: false,
      reason: "invalid_token"
    });
  });

  it("rejects requests when the expected token is not configured", () => {
    expect(authenticateBearerToken("Bearer internal-token", undefined)).toEqual({
      ok: false,
      reason: "token_not_configured"
    });
    expect(authenticateBearerToken("Bearer internal-token", "")).toEqual({
      ok: false,
      reason: "token_not_configured"
    });
    expect(authenticateBearerToken("Bearer internal-token", "   ")).toEqual({
      ok: false,
      reason: "token_not_configured"
    });
    expect(authenticateBearerToken("Bearer replace_with_internal_api_token", "replace_with_internal_api_token")).toEqual({
      ok: false,
      reason: "token_not_configured"
    });
  });
});

describe("admin session cookies", () => {
  const now = new Date("2026-06-07T13:00:00.000Z");
  const later = new Date("2026-06-07T14:00:00.000Z");

  it("creates a signed HttpOnly admin session cookie without exposing the token", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: false
    });

    expect(cookie?.name).toBe(adminSessionCookieName);
    expect(cookie?.value).not.toContain("admin-token");
    expect(cookie?.header).toContain(`${adminSessionCookieName}=`);
    expect(cookie?.header).toContain("HttpOnly");
    expect(cookie?.header).toContain("SameSite=Strict");
    expect(cookie?.header).toContain("Path=/");
    expect(cookie?.header).toContain("Max-Age=28800");
    expect(cookie?.header).not.toContain("Secure");
  });

  it("adds Secure when requested", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: true
    });

    expect(cookie?.header).toContain("Secure");
  });

  it("accepts a fresh signed admin session cookie", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: false
    });

    expect(
      authenticateAdminSessionCookie(`${adminSessionCookieName}=${cookie?.value}`, "admin-token", later)
    ).toEqual({ ok: true });
  });

  it("rejects missing, malformed, expired, and wrong-token session cookies", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: false
    });
    const expiredAt = new Date("2026-06-07T21:00:01.000Z");

    expect(authenticateAdminSessionCookie(undefined, "admin-token", later)).toEqual({
      ok: false,
      reason: "missing_authorization"
    });
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=bad`, "admin-token", later)).toEqual({
      ok: false,
      reason: "invalid_token"
    });
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=${cookie?.value}`, "wrong-token", later)).toEqual({
      ok: false,
      reason: "invalid_token"
    });
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=${cookie?.value}`, "admin-token", expiredAt)).toEqual({
      ok: false,
      reason: "invalid_token"
    });
  });

  it("does not create or accept cookies when the admin token is not effectively configured", () => {
    expect(createAdminSessionCookie({ adminToken: "replace_with_admin_console_token", now, secure: false })).toBeUndefined();
    expect(createAdminSessionCookie({ adminToken: "", now, secure: false })).toBeUndefined();
    expect(createAdminSessionCookie({ adminToken: "   ", now, secure: false })).toBeUndefined();
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=anything`, "verify_required", later)).toEqual({
      ok: false,
      reason: "token_not_configured"
    });
  });

  it("creates a clearing Set-Cookie header for logout", () => {
    expect(clearAdminSessionCookie(false)).toContain(`${adminSessionCookieName}=`);
    expect(clearAdminSessionCookie(false)).toContain("Max-Age=0");
    expect(clearAdminSessionCookie(false)).toContain("HttpOnly");
    expect(clearAdminSessionCookie(false)).toContain("SameSite=Strict");
    expect(clearAdminSessionCookie(false)).not.toContain("Secure");
    expect(clearAdminSessionCookie(true)).toContain("Secure");
  });
});
