import { describe, expect, it, vi } from "vitest";
import { WebhookSubscriptionRepository } from "../src/repositories/webhookSubscriptionRepository.js";

describe("WebhookSubscriptionRepository canonical verification", () => {
  it("removes only the same-topic legacy channel target inside the transaction", async () => {
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    const upsert = vi.fn(async () => undefined);
    const transaction = vi.fn(async (work: (client: unknown) => Promise<void>) => work({
      webhookSubscription: { deleteMany, upsert },
    }));
    const repository = new WebhookSubscriptionRepository({
      $transaction: transaction,
      webhookSubscription: { deleteMany, upsert },
    } as never);

    await repository.upsertVerifiedSubscription({
      source: "youtube",
      targetId: "member-1",
      callbackUrl: "https://example.com/v1/webhooks/youtube",
      topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC1",
      status: "active",
    }, "UC1");

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { source: "youtube", targetId: "UC1", topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC1" },
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { source_targetId_topicUrl: { source: "youtube", targetId: "member-1", topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC1" } },
    }));
  });
});
