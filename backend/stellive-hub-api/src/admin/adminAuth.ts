import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AppEnv } from "../config/env.js";

export type AuthFailureReason =
  | "missing_authorization"
  | "invalid_authorization_scheme"
  | "invalid_token"
  | "token_not_configured";

export type AuthResult = { ok: true } | { ok: false; reason: AuthFailureReason };

export type SecretReadiness = "configured" | "missing";

const bearerAuthorizationPattern = /^Bearer +(\S+)$/i;
const placeholderSecretPattern = /^replace_with_[a-z0-9_]+$/i;
const verifyRequiredPlaceholder = "verify_required";

export const adminSessionCookieName = "stellive_admin_session";

const adminSessionVersion = "v1";
const adminSessionMaxAgeSeconds = 8 * 60 * 60;

export interface AdminSessionCookieOptions {
  adminToken: string | undefined;
  now?: Date;
  secure: boolean;
}

export interface CreatedAdminSessionCookie {
  name: typeof adminSessionCookieName;
  value: string;
  header: string;
}

export function shouldEnableAdminConsole(env: Pick<AppEnv, "ADMIN_CONSOLE_ENABLED" | "ADMIN_CONSOLE_TOKEN">): boolean {
  return env.ADMIN_CONSOLE_ENABLED && hasConfiguredSecret(env.ADMIN_CONSOLE_TOKEN);
}

export function createAdminSessionCookie(options: AdminSessionCookieOptions): CreatedAdminSessionCookie | undefined {
  const configuredAdminToken = normalizeConfiguredSecret(options.adminToken);
  if (!configuredAdminToken) return undefined;

  const issuedAtMs = (options.now ?? new Date()).getTime();
  const nonce = base64UrlEncode(randomBytes(24));
  const unsignedValue = `${adminSessionVersion}.${issuedAtMs}.${nonce}`;
  const signature = signAdminSessionValue(unsignedValue, configuredAdminToken);
  const value = `${unsignedValue}.${signature}`;

  return {
    name: adminSessionCookieName,
    value,
    header: serializeAdminSessionCookie(value, adminSessionMaxAgeSeconds, options.secure)
  };
}

export function authenticateAdminSessionCookie(
  cookieHeader: string | undefined,
  adminToken: string | undefined,
  now: Date = new Date()
): AuthResult {
  const configuredAdminToken = normalizeConfiguredSecret(adminToken);
  if (!configuredAdminToken) return { ok: false, reason: "token_not_configured" };
  if (!cookieHeader) return { ok: false, reason: "missing_authorization" };

  const sessionValue = readCookieValue(cookieHeader, adminSessionCookieName);
  if (!sessionValue) return { ok: false, reason: "missing_authorization" };

  const parts = sessionValue.split(".");
  if (parts.length !== 4) return { ok: false, reason: "invalid_token" };

  const [version, issuedAtRaw, nonce, suppliedSignature] = parts;
  if (version !== adminSessionVersion || !issuedAtRaw || !nonce || !suppliedSignature) {
    return { ok: false, reason: "invalid_token" };
  }

  const issuedAtMs = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAtMs)) return { ok: false, reason: "invalid_token" };
  if (issuedAtMs > now.getTime()) return { ok: false, reason: "invalid_token" };
  if (now.getTime() - issuedAtMs > adminSessionMaxAgeSeconds * 1000) {
    return { ok: false, reason: "invalid_token" };
  }

  const unsignedValue = `${version}.${issuedAtRaw}.${nonce}`;
  const expectedSignature = signAdminSessionValue(unsignedValue, configuredAdminToken);

  return timingSafeStringEqual(suppliedSignature, expectedSignature) ? { ok: true } : { ok: false, reason: "invalid_token" };
}

export function clearAdminSessionCookie(secure: boolean): string {
  return serializeAdminSessionCookie("", 0, secure);
}

export function authenticateBearerToken(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined
): AuthResult {
  const configuredExpectedToken = normalizeConfiguredSecret(expectedToken);
  if (!configuredExpectedToken) return { ok: false, reason: "token_not_configured" };
  if (!authorizationHeader) return { ok: false, reason: "missing_authorization" };

  const match = bearerAuthorizationPattern.exec(authorizationHeader);
  if (!match) {
    return { ok: false, reason: "invalid_authorization_scheme" };
  }

  return timingSafeTokenEqual(match[1], configuredExpectedToken) ? { ok: true } : { ok: false, reason: "invalid_token" };
}

export function getConfiguredSecretState(input: Record<string, string | undefined>): Record<string, SecretReadiness> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, hasConfiguredSecret(value) ? "configured" : "missing"])
  );
}

function hasConfiguredSecret(value: string | undefined): boolean {
  return normalizeConfiguredSecret(value) !== undefined;
}

function normalizeConfiguredSecret(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmedValue = value.trim();
  if (
    trimmedValue.length === 0 ||
    placeholderSecretPattern.test(trimmedValue) ||
    trimmedValue.toLowerCase() === verifyRequiredPlaceholder
  ) {
    return undefined;
  }

  return trimmedValue;
}

function serializeAdminSessionCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  const attributes = [
    `${adminSessionCookieName}=${value}`,
    "Path=/admin",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Strict"
  ];

  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function readCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const cookiePart of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");
    if (rawName === name) return rawValueParts.join("=");
  }

  return undefined;
}

function signAdminSessionValue(value: string, adminToken: string): string {
  return createHmac("sha256", adminToken).update(value).digest("base64url");
}

function base64UrlEncode(value: Buffer): string {
  return value.toString("base64url");
}

function timingSafeTokenEqual(actualToken: string, expectedToken: string): boolean {
  const actualDigest = sha256Digest(actualToken);
  const expectedDigest = sha256Digest(expectedToken);

  return timingSafeEqual(actualDigest, expectedDigest);
}

function timingSafeStringEqual(actual: string, expected: string): boolean {
  const actualDigest = sha256Digest(actual);
  const expectedDigest = sha256Digest(expected);

  return timingSafeEqual(actualDigest, expectedDigest);
}

function sha256Digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
