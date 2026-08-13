import { describe, expect, it, vi } from "vitest";
import { reconcileServiceTopicSubscriptions } from "../src/push/serviceTopicReconciliation.js";

describe("service topic reconciliation", () => {
  it("pages active devices and retries transient failures without returning tokens", async () => {
    const listPushTargetsPage = vi.fn(async ({ cursor }: { cursor?: string; limit: number }) => (
      cursor
        ? { items: [{ deviceId: "device-3" }], nextCursor: null }
        : { items: [{ deviceId: "device-1" }, { deviceId: "device-2" }], nextCursor: "device-2" }
    ));
    const attempts = new Map<string, number>();
    const syncDevice = vi.fn(async ({ deviceId }: { deviceId: string }) => {
      const attempt = (attempts.get(deviceId) ?? 0) + 1;
      attempts.set(deviceId, attempt);
      if (deviceId === "device-1" && attempt < 3) return { status: "transient_failure" as const };
      if (deviceId === "device-2") return { status: "token_missing" as const };
      return { status: "synced" as const };
    });

    const result = await reconcileServiceTopicSubscriptions(
      { devices: { listPushTargetsPage }, subscriptions: { syncDevice } },
      { pageSize: 500, concurrency: 10, maxAttempts: 3 },
    );

    expect(result).toEqual({
      processed: 3,
      synced: 2,
      tokenMissing: 1,
      disabled: 0,
      transientFailure: 0,
      retries: 2,
      success: true,
    });
    expect(listPushTargetsPage).toHaveBeenNthCalledWith(1, { cursor: undefined, limit: 500 });
    expect(listPushTargetsPage).toHaveBeenNthCalledWith(2, { cursor: "device-2", limit: 500 });
    expect(syncDevice).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(result)).not.toContain("private-device-token");
  });

  it("fails when disabled or transient statuses remain unresolved", async () => {
    const result = await reconcileServiceTopicSubscriptions({
      devices: {
        async listPushTargetsPage() {
          return { items: [{ deviceId: "device-1" }, { deviceId: "device-2" }], nextCursor: null };
        },
      },
      subscriptions: {
        async syncDevice({ deviceId }) {
          if (deviceId === "device-1") return { status: "disabled" };
          return { status: "transient_failure" };
        },
      },
    });

    expect(result).toMatchObject({
      processed: 2,
      disabled: 1,
      transientFailure: 1,
      retries: 2,
      success: false,
    });
  });

  it("caps in-flight synchronization at the configured concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const result = await reconcileServiceTopicSubscriptions({
      devices: {
        async listPushTargetsPage() {
          return {
            items: Array.from({ length: 7 }, (_, index) => ({ deviceId: `device-${index}` })),
            nextCursor: null,
          };
        },
      },
      subscriptions: {
        async syncDevice() {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await Promise.resolve();
          active -= 1;
          return { status: "synced" };
        },
      },
    }, { concurrency: 3 });

    expect(result.success).toBe(true);
    expect(maxActive).toBe(3);
  });
});
