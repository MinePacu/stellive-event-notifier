import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";
import { parseYoutubeAtomFeed } from "../adapters/youtube/youtubeAtomParser.js";
import type { SongIngestionResult } from "../songs/songIngestionService.js";

/**
 * Verifies a WebSub `X-Hub-Signature` header against the raw request body.
 * Header format is `<algorithm>=<hex digest>` (WebSub mandates sha1; some hubs emit sha256).
 * The HMAC is computed over the exact raw body bytes and compared in constant time.
 */
function verifyWebSubSignature(secret: string, rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const separatorIndex = signatureHeader.indexOf("=");
  if (separatorIndex <= 0) return false;

  const algorithm = signatureHeader.slice(0, separatorIndex).trim().toLowerCase();
  const providedHex = signatureHeader.slice(separatorIndex + 1).trim().toLowerCase();
  if (algorithm !== "sha1" && algorithm !== "sha256") return false;
  if (providedHex.length === 0 || providedHex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(providedHex)) return false;

  const expectedHex = createHmac(algorithm, secret).update(rawBody, "utf8").digest("hex");
  const providedBuffer = Buffer.from(providedHex, "hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export interface YoutubeWebhookSubscriptionPort {
  upsertSubscription(input: {
    source: string;
    targetId: string;
    callbackUrl: string;
    topicUrl: string;
    status: string;
    leaseExpiresAt?: Date | null;
    lastVerifiedAt?: Date | null;
    lastError?: string | null;
  }): Promise<void>;
  upsertVerifiedSubscription(input: {
    source: string;
    targetId: string;
    callbackUrl: string;
    topicUrl: string;
    status: string;
    leaseExpiresAt?: Date | null;
    lastVerifiedAt?: Date | null;
    lastError?: string | null;
  }, legacyTargetId?: string): Promise<void>;
}

export interface YoutubeWebhookSongIngestionPort {
  ingestYoutubeUpload(candidate: {
    videoId: string;
    channelId: string;
    title: string;
    sourceUrl: string;
    publishedAt: string;
    updatedAt: string;
  }): Promise<SongIngestionResult>;
}

export interface YoutubeWebhookUploadNotificationPort {
  handleYoutubeUpload(candidate: {
    videoId: string;
    channelId: string;
    title: string;
    sourceUrl: string;
    publishedAt: string;
    updatedAt: string;
  }): Promise<unknown>;
}

export interface YoutubeWebhookSubscriptionTargetResolver {
  resolve(channelId: string): { targetId: string; channelId: string; topicUrl: string } | undefined;
}

export interface WebhookRouteOptions {
  env: AppEnv;
  subscriptions: YoutubeWebhookSubscriptionPort;
  songIngestion: YoutubeWebhookSongIngestionPort;
  uploadNotification: YoutubeWebhookUploadNotificationPort;
  targetResolver: YoutubeWebhookSubscriptionTargetResolver;
  now?: () => Date;
}

function readHubParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function extractYoutubeChannelId(topicUrl: string): string | undefined {
  try {
    return new URL(topicUrl).searchParams.get("channel_id") ?? undefined;
  } catch {
    return undefined;
  }
}

function leaseExpiresAt(now: Date, leaseSeconds: string | undefined): Date | null {
  const parsed = Number(leaseSeconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(now.getTime() + parsed * 1000);
}

export async function registerWebhookRoutes(app: FastifyInstance, options: WebhookRouteOptions): Promise<void> {
  const textParser = (app as FastifyInstance & { hasContentTypeParser?: (contentType: string) => boolean }).hasContentTypeParser;
  if (!textParser || !textParser.call(app, "application/atom+xml")) {
    app.addContentTypeParser(["application/atom+xml", "text/xml", "application/xml"], { parseAs: "string" }, (_request, body, done) => {
      done(null, body);
    });
  }

  app.get("/v1/webhooks/youtube", async (request, reply) => {
    if (!options.env.YOUTUBE_WEBSUB_ENABLED) {
      return reply.code(503).send({ error: "youtube_websub_disabled" });
    }

    const query = request.query as Record<string, unknown>;
    const challenge = readHubParam(query["hub.challenge"]);
    const topicUrl = readHubParam(query["hub.topic"]);
    const verifyToken = readHubParam(query["hub.verify_token"]);

    if (!challenge || !topicUrl) {
      return reply.code(400).send({ error: "invalid_websub_verification_request" });
    }

    if (verifyToken !== options.env.YOUTUBE_WEBSUB_VERIFY_TOKEN) {
      return reply.code(401).send({ error: "invalid_websub_verify_token" });
    }

    const channelId = extractYoutubeChannelId(topicUrl);
    if (!channelId) {
      return reply.code(400).send({ error: "invalid_youtube_topic_url" });
    }

    const target = options.targetResolver.resolve(channelId);
    if (!target || target.topicUrl !== topicUrl) {
      return reply.code(404).send({ error: "youtube_subscription_target_unknown" });
    }

    const now = options.now?.() ?? new Date();
    await options.subscriptions.upsertVerifiedSubscription({
      source: "youtube",
      targetId: target.targetId,
      callbackUrl: options.env.YOUTUBE_WEBSUB_CALLBACK_URL ?? "",
      topicUrl,
      status: "active",
      leaseExpiresAt: leaseExpiresAt(now, readHubParam(query["hub.lease_seconds"])),
      lastVerifiedAt: now,
      lastError: null,
    }, channelId);

    reply.header("content-type", "text/plain; charset=utf-8");
    return reply.send(challenge);
  });

  app.post("/v1/webhooks/youtube", async (request, reply) => {
    if (!options.env.YOUTUBE_WEBSUB_ENABLED) {
      return reply.code(503).send({ error: "youtube_websub_disabled" });
    }

    const body = typeof request.body === "string" ? request.body : "";

    const secret = options.env.YOUTUBE_WEBSUB_SECRET;
    if (secret) {
      const signatureHeader = request.headers["x-hub-signature"];
      const headerValue = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      if (!verifyWebSubSignature(secret, body, headerValue)) {
        return reply.code(403).send({ error: "invalid_websub_signature" });
      }
    }

    const parsed = parseYoutubeAtomFeed(body);
    if (!parsed.ok) {
      return reply.code(400).send({ error: parsed.error });
    }

    let ingested = 0;
    let skipped = 0;
    for (const entry of parsed.entries) {
      await options.uploadNotification.handleYoutubeUpload(entry);
      const result = await options.songIngestion.ingestYoutubeUpload(entry);
      if (result.ingested) ingested += 1;
      else skipped += 1;
    }

    return reply.code(202).send({
      received: parsed.entries.length,
      ingested,
      skipped,
    });
  });
}

export default registerWebhookRoutes;
