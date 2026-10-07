import { createHmac } from "node:crypto";
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
  YOUTUBE_WEBSUB_SECRET: "websub-secret",
});

function signedHeaders(body: string, algorithm: "sha1" | "sha256" = "sha1", secret = "websub-secret") {
  return {
    "content-type": "application/atom+xml",
    "x-hub-signature": `${algorithm}=${createHmac(algorithm, secret).update(body, "utf8").digest("hex")}`,
  };
}

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
      headers: signedHeaders(sampleAtom, "sha256"),
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
    headers: signedHeaders(sampleAtom),
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
    headers: signedHeaders(sampleAtom),
    payload: sampleAtom,
  });
  await app.close();

  expect(response.statusCode).toBe(500);
  expect(ingestYoutubeUpload).not.toHaveBeenCalled();
});
});

function newPostApp(envOverrides: Record<string, unknown>) {
  const handleYoutubeUpload = vi.fn(async () => undefined);
  const ingestYoutubeUpload = vi.fn(async () => ({ ingested: true as const, songId: "song-1" }));
  const env = loadEnv({
    DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub_test",
    YOUTUBE_WEBSUB_ENABLED: true,
    YOUTUBE_DATA_API_FALLBACK_ENABLED: false,
    YOUTUBE_WEBSUB_CALLBACK_URL: "https://example.com/v1/webhooks/youtube",
    YOUTUBE_WEBSUB_VERIFY_TOKEN: "verify-token",
    ...envOverrides,
  });
  const subscriptions = subscriptionDouble(vi.fn(async () => undefined));
  const app = Fastify();
  return {
    app,
    handleYoutubeUpload,
    ingestYoutubeUpload,
    subscriptions,
    register: () => registerWebhookRoutes(app, {
      env,
      subscriptions,
      songIngestion: { ingestYoutubeUpload },
      uploadNotification: { handleYoutubeUpload },
      targetResolver,
    }),
  };
}

const verifyUrl = (token?: string) =>
  "/v1/webhooks/youtube?hub.mode=subscribe&hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123&hub.challenge=challenge-token"
  + (token === undefined ? "" : `&hub.verify_token=${token}`);

describe("registerWebhookRoutes hardening", () => {
  it("rejects POST with 503 when WebSub is enabled but the secret is unset", async () => {
    const t = newPostApp({});
    await t.register();
    const response = await t.app.inject({ method: "POST", url: "/v1/webhooks/youtube", headers: { "content-type": "application/atom+xml" }, payload: sampleAtom });
    await t.app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "youtube_websub_secret_not_configured" });
    expect(t.handleYoutubeUpload).not.toHaveBeenCalled();
    expect(t.ingestYoutubeUpload).not.toHaveBeenCalled();
  });

  it("rejects POST with 503 when the secret is the .env.example placeholder, even if signed with it", async () => {
    const t = newPostApp({ YOUTUBE_WEBSUB_SECRET: "replace_with_websub_secret" });
    await t.register();
    const response = await t.app.inject({
      method: "POST",
      url: "/v1/webhooks/youtube",
      headers: signedHeaders(sampleAtom, "sha1", "replace_with_websub_secret"),
      payload: sampleAtom,
    });
    await t.app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "youtube_websub_secret_not_configured" });
    expect(t.handleYoutubeUpload).not.toHaveBeenCalled();
  });

  it("rejects POST with 403 when the signature is missing or invalid", async () => {
    const t = newPostApp({ YOUTUBE_WEBSUB_SECRET: "websub-secret" });
    await t.register();
    const missing = await t.app.inject({ method: "POST", url: "/v1/webhooks/youtube", headers: { "content-type": "application/atom+xml" }, payload: sampleAtom });
    const invalid = await t.app.inject({
      method: "POST",
      url: "/v1/webhooks/youtube",
      headers: signedHeaders(sampleAtom, "sha1", "wrong-secret"),
      payload: sampleAtom,
    });
    await t.app.close();

    expect(missing.statusCode).toBe(403);
    expect(invalid.statusCode).toBe(403);
    expect(invalid.json()).toEqual({ error: "invalid_websub_signature" });
    expect(t.handleYoutubeUpload).not.toHaveBeenCalled();
    expect(t.ingestYoutubeUpload).not.toHaveBeenCalled();
  });

  it("rejects GET verification with 503 when the verify token env is unset and the request omits the token", async () => {
    const t = newPostApp({ YOUTUBE_WEBSUB_VERIFY_TOKEN: undefined, YOUTUBE_WEBSUB_SECRET: "websub-secret" });
    await t.register();
    const response = await t.app.inject({ method: "GET", url: verifyUrl() });
    await t.app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "youtube_websub_verify_token_not_configured" });
    expect(t.subscriptions.upsertSubscription).not.toHaveBeenCalled();
    expect(t.subscriptions.upsertVerifiedSubscription).not.toHaveBeenCalled();
  });

  it("rejects GET verification with 503 when the verify token env is the .env.example placeholder", async () => {
    const t = newPostApp({ YOUTUBE_WEBSUB_VERIFY_TOKEN: "replace_with_websub_verify_token", YOUTUBE_WEBSUB_SECRET: "websub-secret" });
    await t.register();
    const response = await t.app.inject({ method: "GET", url: verifyUrl("replace_with_websub_verify_token") });
    await t.app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "youtube_websub_verify_token_not_configured" });
    expect(t.subscriptions.upsertVerifiedSubscription).not.toHaveBeenCalled();
  });

  it("rejects GET verification with 401 for a missing or wrong token and echoes the challenge for the right one", async () => {
    const t = newPostApp({ YOUTUBE_WEBSUB_SECRET: "websub-secret" });
    await t.register();
    const missing = await t.app.inject({ method: "GET", url: verifyUrl() });
    const wrong = await t.app.inject({ method: "GET", url: verifyUrl("wrong-token") });
    const correct = await t.app.inject({ method: "GET", url: verifyUrl("verify-token") });
    await t.app.close();

    expect(missing.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ error: "invalid_websub_verify_token" });
    expect(correct.statusCode).toBe(200);
    expect(correct.body).toBe("challenge-token");
    expect(t.subscriptions.upsertVerifiedSubscription).toHaveBeenCalledTimes(1);
  });
});
