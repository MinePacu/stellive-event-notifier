import { describe, expect, it } from "vitest";
import { msUntilNextKoreaMidnight } from "../src/workers/hubEventStatusReconcileWorker.js";

describe("hub event status reconcile worker", () => {
  it("schedules the next run at the next Korea midnight", () => {
    expect(msUntilNextKoreaMidnight(new Date("2026-06-20T10:00:00.000Z"))).toBe(5 * 60 * 60 * 1000);
    expect(msUntilNextKoreaMidnight(new Date("2026-06-20T14:59:59.999Z"))).toBe(1);
    expect(msUntilNextKoreaMidnight(new Date("2026-06-20T15:00:00.000Z"))).toBe(24 * 60 * 60 * 1000);
  });
});
