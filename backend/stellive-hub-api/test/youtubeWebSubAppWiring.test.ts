import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>wire-video</yt:videoId>
    <yt:channelId>UC_WIRE</yt:channelId>
    <title>Wired upload</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=wire-video"/>
    <published>2026-08-20T10:00:00+00:00</published>
    <updated>2026-08-20T10:01:00+00:00</updated>
  </entry>
</feed>`;

describe("YouTube WebSub app wiring", () => {
  it("injects the upload notification handler before song ingestion", async () => {
    const uploadNotification = vi.fn(async () => ({ status: "created" }));
    const ingestYoutubeUpload = vi.fn(async () => ({ ingested: false as const, reason: "unknown_youtube_channel" as const }));
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub_test",
        YOUTUBE_WEBSUB_ENABLED: true,
        YOUTUBE_WEBSUB_CALLBACK_URL: "https://example.com/v1/webhooks/youtube",
        YOUTUBE_WEBSUB_VERIFY_TOKEN: "verify-token",
      },
      useProcessEnv: false,
      webhookRoutes: {
        dependencies: {
          subscriptions: {
            upsertSubscription: async () => undefined,
            upsertVerifiedSubscription: async () => undefined,
          },
          songIngestion: { ingestYoutubeUpload },
          uploadNotification: { handleYoutubeUpload: uploadNotification },
          targetResolver: {
            resolve: (channelId) => channelId === "UC_WIRE" ? {
              targetId: "wire-member",
              channelId,
              topicUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
            } : undefined,
          },
        },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/youtube",
      headers: { "content-type": "application/atom+xml" },
      payload: atom,
    });
    await app.close();

    expect(response.statusCode).toBe(202);
    expect(uploadNotification).toHaveBeenCalledTimes(1);
    expect(ingestYoutubeUpload).toHaveBeenCalledTimes(1);
    expect(uploadNotification.mock.invocationCallOrder[0]).toBeLessThan(ingestYoutubeUpload.mock.invocationCallOrder[0]);
  });
});
