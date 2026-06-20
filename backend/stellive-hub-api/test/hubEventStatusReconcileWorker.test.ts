import { describe, expect, it } from "vitest";
import { msUntilNextHour } from "../src/workers/hubEventStatusReconcileWorker.js";

describe("hub event status reconcile worker", () => {
  it("schedules the next run at the next whole hour", () => {
    expect(msUntilNextHour(new Date("2026-06-20T10:00:00.000Z"))).toBe(60 * 60 * 1000);
    expect(msUntilNextHour(new Date("2026-06-20T10:30:15.250Z"))).toBe(29 * 60 * 1000 + 44_750);
    expect(msUntilNextHour(new Date("2026-06-20T10:59:59.999Z"))).toBe(1);
  });
});
