import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildApp, musicConfigurationWarnings } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";

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
        YOUTUBE_WEBSUB_SECRET: "websub-secret",
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
      headers: {
        "content-type": "application/atom+xml",
        "x-hub-signature": `sha1=${createHmac("sha1", "websub-secret").update(atom, "utf8").digest("hex")}`,
      },
      payload: atom,
    });
    await app.close();

    expect(response.statusCode).toBe(202);
    expect(uploadNotification).toHaveBeenCalledTimes(1);
    expect(ingestYoutubeUpload).toHaveBeenCalledTimes(1);
    expect(uploadNotification.mock.invocationCallOrder[0]).toBeLessThan(ingestYoutubeUpload.mock.invocationCallOrder[0]);
  });

  const schedulerBaseEnv = {
    DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub_test",
    INTERNAL_API_TOKEN: "internal-test-token",
    CHZZK_LIVE_POLLING_ENABLED: "false",
    YOUTUBE_WEBSUB_ENABLED: true,
    YOUTUBE_WEBSUB_CALLBACK_URL: "https://example.com/v1/webhooks/youtube",
    YOUTUBE_WEBSUB_VERIFY_TOKEN: "verify-token",
  };

  it.each([
    ["secret missing", { YOUTUBE_WEBSUB_SECRET: undefined }],
    ["secret is the placeholder", { YOUTUBE_WEBSUB_SECRET: "replace_with_websub_secret" }],
    ["verify token is the placeholder", { YOUTUBE_WEBSUB_SECRET: "websub-secret", YOUTUBE_WEBSUB_VERIFY_TOKEN: "replace_with_websub_verify_token" }],
  ])("does not create the subscription scheduler when the %s", async (_name, overrides) => {
    const app = await buildApp({ env: { ...schedulerBaseEnv, ...overrides }, useProcessEnv: false });
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/youtube/renew-subscriptions",
      headers: { authorization: "Bearer internal-test-token" },
    });
    await app.close();

    expect(response.json()).toEqual({ status: "not_available", reason: "youtube_subscription_renewal_not_configured" });
  });

  it("warns with a fixed code when WebSub is enabled without a configured secret", () => {
    const base = { DATABASE_URL: schedulerBaseEnv.DATABASE_URL, YOUTUBE_WEBSUB_ENABLED: "true" };
    const services = { channelDiscoveryServiceConfigured: true };

    expect(musicConfigurationWarnings(loadEnv(base), services)).toContain("youtube_websub_secret_not_configured");
    expect(musicConfigurationWarnings(loadEnv({ ...base, YOUTUBE_WEBSUB_SECRET: "replace_with_websub_secret" }), services))
      .toContain("youtube_websub_secret_not_configured");
    expect(musicConfigurationWarnings(loadEnv({ ...base, YOUTUBE_WEBSUB_SECRET: "websub-secret" }), services))
      .not.toContain("youtube_websub_secret_not_configured");
    expect(musicConfigurationWarnings(loadEnv({ ...base, YOUTUBE_WEBSUB_ENABLED: "false" }), services))
      .not.toContain("youtube_websub_secret_not_configured");
  });
});
