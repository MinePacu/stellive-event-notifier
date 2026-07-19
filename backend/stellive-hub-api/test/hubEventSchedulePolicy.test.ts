import { describe, expect, it } from "vitest";
import {
  activeHubEventScheduleItems,
  deriveHubEventScheduleMode,
  normalizeHubEventScheduleText,
  withDefaultPrimaryScheduleItem,
  withPrimaryScheduleItem
} from "../src/hub-events/hubEventSchedulePolicy.js";
import type { AdminHubEventScheduleItemWriteInput } from "../src/hub-events/hubEventRepository.js";

function item(overrides: AdminHubEventScheduleItemWriteInput = {}): AdminHubEventScheduleItemWriteInput {
  return {
    id: "item",
    kind: "main_window",
    label: "일정",
    startsAt: "2026-07-20T01:00:00.000Z",
    timePrecision: "datetime",
    timezone: "Asia/Seoul",
    ...overrides
  };
}

describe("hub event schedule policy", () => {
  it("uses single_window only for one active main window", () => {
    expect(deriveHubEventScheduleMode([item()])).toBe("single_window");
    expect(deriveHubEventScheduleMode([item({ kind: "sales_open" })])).toBe("timeline");
    expect(deriveHubEventScheduleMode([item({ id: "a" }), item({ id: "b" })])).toBe("timeline");
  });

  it("excludes cancelled items from mode and active calculations", () => {
    const items = [item(), item({ id: "cancelled", kind: "deadline", cancelledAt: "2026-07-19T01:00:00.000Z" })];
    expect(activeHubEventScheduleItems(items)).toHaveLength(1);
    expect(deriveHubEventScheduleMode(items)).toBe("single_window");
  });

  it("defaults the first active item to primary without restoring cancelled items", () => {
    const items = withDefaultPrimaryScheduleItem([
      item({ id: "cancelled", cancelledAt: "2026-07-19T01:00:00.000Z" }),
      item({ id: "active", sortOrder: 1 })
    ]);
    expect(items.find((candidate) => candidate.id === "cancelled")?.isPrimary).not.toBe(true);
    expect(items.find((candidate) => candidate.id === "active")?.isPrimary).toBe(true);
  });

  it("replaces the active primary with exactly one target", () => {
    const items = withPrimaryScheduleItem([
      item({ id: "old", isPrimary: true }),
      item({ id: "next", isPrimary: false })
    ], 1);
    expect(items.filter((candidate) => candidate.isPrimary).map((candidate) => candidate.id)).toEqual(["next"]);
  });

  it("normalizes title, label, and optional description with compatibility fallbacks", () => {
    expect(normalizeHubEventScheduleText({ title: "  상세 제목  ", label: "  짧은 라벨  ", description: "  설명  " })).toEqual({
      title: "상세 제목",
      label: "짧은 라벨",
      description: "설명"
    });
    expect(normalizeHubEventScheduleText({ title: "제목", description: "   " })).toEqual({
      title: "제목",
      label: "제목",
      description: null
    });
    expect(normalizeHubEventScheduleText({ label: "레거시 라벨" })).toEqual({
      title: "레거시 라벨",
      label: "레거시 라벨",
      description: null
    });
  });
});
