import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { loadEnv } from "../src/config/env.js";
import { registerWebhookRoutes } from "../src/routes/webhookRoutes.js";

const routeEnv = loadEnv({
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub_test",
  YOUTUBE_WEBSUB_ENABLED: true,
  YOUTUBE_DATA_API_FALLBACK_ENABLED: false,
  YOUTUBE_WEBSUB_CALLBACK_URL: "https://example.com/v1/webhooks/youtube",
  YOUTUBE_WEBSUB_VERIFY_TOKEN: "verify-token",
});

const sampleAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>UC123</yt:channelId>
    <title>Song upload</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2026-06-22T10:00:00+00:00</published>
    <updated>2026-06-22T10:01:00+00:00</updated>
  </entry>
</feed>`;

const targetResolver = {
  resolve: (channelId: string) => channelId === "UC123"
    ? { targetId: "member-uc123", channelId, topicUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}` }
    : undefined,
};

function subscriptionDouble(upsertSubscription: (input: unknown) => Promise<void> = async () => undefined) {
  return {
    upsertSubscription,
    upsertVerifiedSubscription: vi.fn(async (input: unknown) => upsertSubscription(input)),
  };
}

describe("registerWebhookRoutes", () => {
  it("returns hub challenge and records verification when verify token matches", async () => {
    const app = Fastify();
    const upsertSubscription = vi.fn(async () => undefined);

    await registerWebhookRoutes(app, {
      env: routeEnv,
      subscriptions: subscriptionDouble(upsertSubscription),
      songIngestion: {
        ingestYoutubeUpload: async () => ({ ingested: true as const, songId: "unused" }),
      },
      uploadNotification: { handleYoutubeUpload: async () => undefined },
      targetResolver,
      now: () => new Date("2026-06-22T00:00:00.000Z"),
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/webhooks/youtube?hub.mode=subscribe&hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123&hub.challenge=challenge-token&hub.verify_token=verify-token&hub.lease_seconds=864000",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("challenge-token");
  expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "youtube",
        targetId: "member-uc123",
        topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123",
        status: "active",
      }),
    );
  });

  it("rejects verification when verify token does not match", async () => {
    const app = Fastify();

    await registerWebhookRoutes(app, {
      env: routeEnv,
      subscriptions: subscriptionDouble(),
      songIngestion: {
        ingestYoutubeUpload: async () => ({ ingested: true as const, songId: "unused" }),
      },
      uploadNotification: { handleYoutubeUpload: async () => undefined },
      targetResolver,
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/webhooks/youtube?hub.mode=subscribe&hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123&hub.challenge=challenge-token&hub.verify_token=wrong-token",
    });

    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_websub_verify_token" });
  });

  it("parses Atom payloads and forwards entries to song ingestion", async () => {
    const app = Fastify();
    const ingestYoutubeUpload = vi.fn(async () => ({ ingested: true as const, songId: "song-1" }));

    await registerWebhookRoutes(app, {
      env: routeEnv,
      subscriptions: subscriptionDouble(),
      songIngestion: { ingestYoutubeUpload },
      uploadNotification: { handleYoutubeUpload: async () => undefined },
      targetResolver,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/youtube",
      headers: { "content-type": "application/atom+xml" },
      payload: sampleAtom,
    });

    await app.close();

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ received: 1, ingested: 1, skipped: 0 });
  expect(ingestYoutubeUpload).toHaveBeenCalledWith(
    expect.objectContaining({
      videoId: "abc123",
      channelId: "UC123",
      title: "Song upload",
    }),
  );
});

it("rejects verification for an unknown subscription target", async () => {
  const app = Fastify();
  const upsertVerifiedSubscription = vi.fn(async () => undefined);
  await registerWebhookRoutes(app, {
    env: routeEnv,
    subscriptions: {
      upsertSubscription: async () => undefined,
      upsertVerifiedSubscription,
    },
    songIngestion: {
      ingestYoutubeUpload: async () => ({ ingested: true as const, songId: "unused" }),
    },
    uploadNotification: { handleYoutubeUpload: async () => undefined },
    targetResolver,
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/webhooks/youtube?hub.mode=subscribe&hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UNKNOWN&hub.challenge=challenge-token&hub.verify_token=verify-token",
  });
  await app.close();

  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ error: "youtube_subscription_target_unknown" });
  expect(upsertVerifiedSubscription).not.toHaveBeenCalled();
});

it("passes WebSub video notifications to the required upload hook before song ingestion", async () => {
  const app = Fastify();
  const uploadNotification = { handleYoutubeUpload: vi.fn(async () => undefined) };
  const ingestYoutubeUpload = vi.fn(async () => ({ ingested: true as const, songId: "song-1" }));
  await registerWebhookRoutes(app, {
    env: routeEnv,
    subscriptions: subscriptionDouble(),
    songIngestion: { ingestYoutubeUpload },
    uploadNotification,
    targetResolver,
  });
  const response = await app.inject({
    method: "POST",
    url: "/v1/webhooks/youtube",
    headers: { "content-type": "application/atom+xml" },
    payload: sampleAtom,
  });
  await app.close();

  expect(response.statusCode).toBe(202);
  expect(uploadNotification.handleYoutubeUpload).toHaveBeenCalledWith({
    videoId: "abc123",
    channelId: "UC123",
    title: "Song upload",
    sourceUrl: "https://www.youtube.com/watch?v=abc123",
    publishedAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:01:00.000Z",
  });
  expect(ingestYoutubeUpload).toHaveBeenCalledTimes(1);
});

it("returns a retryable 5xx when upload notification persistence fails", async () => {
  const app = Fastify();
  const ingestYoutubeUpload = vi.fn(async () => ({ ingested: true as const, songId: "song-1" }));
  await registerWebhookRoutes(app, {
    env: routeEnv,
    subscriptions: subscriptionDouble(),
    songIngestion: { ingestYoutubeUpload },
    uploadNotification: { handleYoutubeUpload: async () => { throw new Error("platform_event_create_failed"); } },
    targetResolver,
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/webhooks/youtube",
    headers: { "content-type": "application/atom+xml" },
    payload: sampleAtom,
  });
  await app.close();

  expect(response.statusCode).toBe(500);
  expect(ingestYoutubeUpload).not.toHaveBeenCalled();
});
});
