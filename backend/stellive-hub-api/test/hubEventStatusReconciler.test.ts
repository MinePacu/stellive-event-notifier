import { describe, expect, it, vi } from "vitest";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";

describe("HubEventRepository.reconcileDueStatuses", () => {
  it("persists due upcoming and ended hub event status transitions", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 });
    const repository = new HubEventRepository({
      hubEvent: { updateMany }
    } as never);
    const now = new Date("2026-06-20T10:00:00.000Z");

    const result = await repository.reconcileDueStatuses(now);

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        publicationState: "published",
        deletedAt: null,
        cancelledAt: null,
        status: "upcoming",
        startsAt: { lte: now }
      },
      data: { status: "open" }
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        publicationState: "published",
        deletedAt: null,
        cancelledAt: null,
        status: { in: ["open", "closing_soon"] },
        endsAt: { lte: now }
      },
      data: { status: "ended" }
    });
    expect(result).toEqual({
      status: "ok",
      checkedAt: "2026-06-20T10:00:00.000Z",
      opened: 2,
      ended: 3
    });
  });
});
