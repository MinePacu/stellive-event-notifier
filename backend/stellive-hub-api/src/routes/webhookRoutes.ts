import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";
import { parseYoutubeAtomFeed } from "../adapters/youtube/youtubeAtomParser.js";
import type { SongIngestionResult } from "../songs/songIngestionService.js";

interface YoutubeWebhookSubscriptionPort {
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
}

interface YoutubeWebhookSongIngestionPort {
  ingestYoutubeUpload(candidate: {
    videoId: string;
    channelId: string;
    title: string;
    sourceUrl: string;
    publishedAt: string;
    updatedAt: string;
  }): Promise<SongIngestionResult>;
}

export interface WebhookRouteOptions {
  env: AppEnv;
  subscriptions: YoutubeWebhookSubscriptionPort;
  songIngestion: YoutubeWebhookSongIngestionPort;
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

    const now = options.now?.() ?? new Date();
    await options.subscriptions.upsertSubscription({
      source: "youtube",
      targetId: channelId,
      callbackUrl: options.env.YOUTUBE_WEBSUB_CALLBACK_URL ?? "",
      topicUrl,
      status: "active",
      leaseExpiresAt: leaseExpiresAt(now, readHubParam(query["hub.lease_seconds"])),
      lastVerifiedAt: now,
      lastError: null,
    });

    reply.header("content-type", "text/plain; charset=utf-8");
    return reply.send(challenge);
  });

  app.post("/v1/webhooks/youtube", async (request, reply) => {
    if (!options.env.YOUTUBE_WEBSUB_ENABLED) {
      return reply.code(503).send({ error: "youtube_websub_disabled" });
    }

    const body = typeof request.body === "string" ? request.body : "";
    const parsed = parseYoutubeAtomFeed(body);
    if (!parsed.ok) {
      return reply.code(400).send({ error: parsed.error });
    }

    let ingested = 0;
    let skipped = 0;
    for (const entry of parsed.entries) {
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
