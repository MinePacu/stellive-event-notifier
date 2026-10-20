import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const maxStateAgeMs = 10 * 60 * 1000;
const maxClockSkewMs = 60 * 1000;

export type ChzzkOAuthStateVerification =
  | { ok: true; nonce: string }
  | { ok: false; reason: "malformed" | "expired" | "future" | "invalid_signature" };

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createChzzkOAuthState(secret: string, now = new Date()): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const payload = JSON.stringify({
    nonce,
    issuedAt: now.toISOString()
  });
  const encodedPayload = base64UrlEncode(payload);
  return { state: base64UrlEncode(`${encodedPayload}.${sign(secret, encodedPayload)}`), nonce };
}

export function verifyChzzkOAuthState(secret: string, state: string, now = new Date()): ChzzkOAuthStateVerification {
  let decoded: string;
  try {
    decoded = base64UrlDecode(state).toString("utf8");
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const [encodedPayload, signature, ...extra] = decoded.split(".");
  if (!encodedPayload || !signature || extra.length > 0) return { ok: false, reason: "malformed" };

  const expected = sign(secret, encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: "invalid_signature" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as { nonce?: unknown; issuedAt?: string };
    const issuedAt = payload.issuedAt ? Date.parse(payload.issuedAt) : Number.NaN;
    if (!Number.isFinite(issuedAt)) return { ok: false, reason: "malformed" };
    if (typeof payload.nonce !== "string" || payload.nonce.length === 0) return { ok: false, reason: "malformed" };
    if (issuedAt - now.getTime() > maxClockSkewMs) return { ok: false, reason: "future" };
    if (now.getTime() - issuedAt > maxStateAgeMs) return { ok: false, reason: "expired" };
    return { ok: true, nonce: payload.nonce };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
