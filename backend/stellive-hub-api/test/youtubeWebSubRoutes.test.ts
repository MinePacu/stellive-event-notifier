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

describe("registerWebhookRoutes", () => {
  it("returns hub challenge and records verification when verify token matches", async () => {
    const app = Fastify();
    const upsertSubscription = vi.fn(async () => undefined);

    await registerWebhookRoutes(app, {
      env: routeEnv,
      subscriptions: { upsertSubscription },
      songIngestion: {
        ingestYoutubeUpload: async () => ({ ingested: true as const, songId: "unused" }),
      },
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
        targetId: "UC123",
        topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123",
        status: "active",
      }),
    );
  });

  it("rejects verification when verify token does not match", async () => {
    const app = Fastify();

    await registerWebhookRoutes(app, {
      env: routeEnv,
      subscriptions: { upsertSubscription: async () => undefined },
      songIngestion: {
        ingestYoutubeUpload: async () => ({ ingested: true as const, songId: "unused" }),
      },
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
      subscriptions: { upsertSubscription: async () => undefined },
      songIngestion: { ingestYoutubeUpload },
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
});
