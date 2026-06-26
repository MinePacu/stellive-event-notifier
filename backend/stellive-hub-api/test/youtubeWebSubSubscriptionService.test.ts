import { describe, expect, it, vi } from "vitest";
import {
  YoutubeWebSubSubscriptionService,
  type YoutubeWebSubSubscriptionTarget,
} from "../src/adapters/youtube/youtubeWebSubSubscriptionService.js";

const targets: YoutubeWebSubSubscriptionTarget[] = [
  {
    targetId: "akane-lize",
    channelId: "UC123",
    topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123",
  },
];

describe("YoutubeWebSubSubscriptionService", () => {
  it("subscribes supported topics and records pending verification state", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("", { status: 202 }));
    const upsertSubscription = vi.fn(async () => undefined);

    const service = new YoutubeWebSubSubscriptionService({
      callbackUrl: "https://example.com/v1/webhooks/youtube",
      verifyToken: "verify-token",
      targets,
      fetch: fetchImpl,
      subscriptions: { upsertSubscription },
      now: () => new Date("2026-06-22T00:00:00.000Z"),
    });

    await expect(service.renewSubscriptions()).resolves.toEqual({
      status: "ok",
      renewed: 1,
      failed: 0,
      skipped: 0,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const firstCall = fetchImpl.mock.calls.at(0);
    expect(firstCall?.[0]).toBe("https://pubsubhubbub.appspot.com/subscribe");
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "youtube",
        targetId: "akane-lize",
        topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123",
        status: "pending_verification",
      }),
    );
  });

  it("records renewal failures without leaking raw responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("bad request", { status: 500, statusText: "Internal Server Error" }));
    const upsertSubscription = vi.fn(async () => undefined);

    const service = new YoutubeWebSubSubscriptionService({
      callbackUrl: "https://example.com/v1/webhooks/youtube",
      verifyToken: "verify-token",
      targets,
      fetch: fetchImpl,
      subscriptions: { upsertSubscription },
    });

    await expect(service.renewSubscriptions()).resolves.toEqual({
      status: "partial_failure",
      renewed: 0,
      failed: 1,
      skipped: 0,
    });

    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "youtube",
        targetId: "akane-lize",
        status: "error",
        lastError: "youtube_websub_subscription_failed:500",
      }),
    );
  });
});
