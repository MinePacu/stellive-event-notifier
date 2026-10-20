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

describe("WebhookSubscriptionRepository.markPendingVerification", () => {
  const input = {
    source: "youtube",
    targetId: "member-1",
    callbackUrl: "https://example.com/v1/webhooks/youtube",
    topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC1",
    requestedAt: new Date("2026-07-01T00:00:00.000Z"),
  };

  function build(overrides: { count?: number; existing?: { id: string } | null; createError?: unknown } = {}) {
    const updateMany = vi.fn(async () => ({ count: overrides.count ?? 0 }));
    const findUnique = vi.fn(async () => overrides.existing ?? null);
    const create = vi.fn(async () => {
      if (overrides.createError) throw overrides.createError;
    });
    const repository = new WebhookSubscriptionRepository({
      webhookSubscription: { updateMany, findUnique, create },
    } as never);
    return { repository, updateMany, findUnique, create };
  }

  it("guards the update so an active row verified at/after requestedAt is never downgraded", async () => {
    const { repository, updateMany, create } = build({ count: 1 });

    await repository.markPendingVerification(input);

    const args = updateMany.mock.calls[0] as unknown as [{ where: unknown; data: Record<string, unknown> }];
    expect(args[0].where).toEqual({
      source: "youtube",
      targetId: "member-1",
      topicUrl: input.topicUrl,
      NOT: { status: "active", lastVerifiedAt: { gte: input.requestedAt } },
    });
    expect(args[0].data).toEqual({ callbackUrl: input.callbackUrl, status: "pending_verification", lastError: null });
    expect(args[0].data).not.toHaveProperty("lastVerifiedAt");
    expect(args[0].data).not.toHaveProperty("leaseExpiresAt");
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps a freshly verified row untouched (guarded update matched nothing, row exists)", async () => {
    const { repository, create } = build({ count: 0, existing: { id: "row-1" } });

    await repository.markPendingVerification(input);

    expect(create).not.toHaveBeenCalled();
  });

  it("creates a pending row when none exists and tolerates a concurrent creation", async () => {
    const created = build();
    await created.repository.markPendingVerification(input);
    expect(created.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ targetId: "member-1", status: "pending_verification", lastError: null }),
    });

    const raced = build({ createError: { code: "P2002" } });
    await expect(raced.repository.markPendingVerification(input)).resolves.toBeUndefined();

    const broken = build({ createError: new Error("db down") });
    await expect(broken.repository.markPendingVerification(input)).rejects.toThrow("db down");
  });
});
