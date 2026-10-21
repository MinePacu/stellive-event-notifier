import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const DEVICE_SECRET_HEADER = "x-device-secret";

export type DeviceSecretCheck = "ok" | "legacy" | "mismatch";

export class DeviceAuthFailedError extends Error {
  constructor() {
    super("device secret missing or mismatched");
    this.name = "DeviceAuthFailedError";
  }
}

// The secret is 256 random bits, so a plain SHA-256 is enough; a slow KDF would only add latency.
export function hashDeviceSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateDeviceSecret(): { secret: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  return { secret, hash: hashDeviceSecret(secret) };
}

// Rows without a hash predate device secrets and stay open until they claim one via /v1/devices/register.
export function checkDeviceSecret(secretHash: string | null | undefined, provided: unknown): DeviceSecretCheck {
  if (!secretHash) return "legacy";
  if (typeof provided !== "string") return "mismatch";
  const expected = Buffer.from(secretHash, "hex");
  const actual = createHash("sha256").update(provided).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? "ok" : "mismatch";
}
