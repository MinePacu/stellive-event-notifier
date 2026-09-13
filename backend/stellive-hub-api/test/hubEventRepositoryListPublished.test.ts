import { describe, expect, it } from "vitest";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";

// Minimal in-memory interpreter for the subset of Prisma `where` shapes that
// listPublished() actually builds: top-level equality/null fields plus
// top-level OR/AND arrays of { field: { gte | lte: Date } | null }.
function matches(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (key === "OR") {
      if (!(condition as Record<string, unknown>[]).some((clause) => matches(record, clause))) return false;
      continue;
    }
    if (key === "AND") {
      if (!(condition as Record<string, unknown>[]).every((clause) => matches(record, clause))) return false;
      continue;
    }
    const value = record[key];
    if (condition === null) {
      if (value !== null && value !== undefined) return false;
      continue;
    }
    if (typeof condition === "object" && condition !== null) {
      const ops = condition as { gte?: Date; lte?: Date };
      if (ops.gte !== undefined && !(value instanceof Date && value.getTime() >= ops.gte.getTime())) return false;
      if (ops.lte !== undefined && !(value instanceof Date && value.getTime() <= ops.lte.getTime())) return false;
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

function fakeRecord(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "id",
    category: "online_goods",
    tags: [],
    participationMode: "online",
    status: "announced",
    scheduleMode: "single_window",
    scheduleItems: [],
    links: [],
    title: "Event",
    summary: null,
    memberId: null,
    generationId: "official",
    sourceUrl: "https://example.com",
    sourceLabel: "Official",
    sourceType: "official",
    announcedAt: null,
    startsAt: null,
    endsAt: null,
    purchaseUrl: null,
    ticketUrl: null,
    venueName: null,
    venueAddress: null,
    image: null,
    notificationEligible: true,
    publicationState: "published",
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides
  };
}

function createFakePrisma(records: Record<string, unknown>[]) {
  return {
    hubEvent: {
      findMany: async (args: { where: Record<string, unknown>; take?: number }) => {
        const filtered = records.filter((record) => matches(record, args.where));
        return args.take ? filtered.slice(0, args.take) : filtered;
      }
    }
  };
}

describe("HubEventRepository.listPublished window filtering", () => {
  it("applies from/to to the production Prisma-backed query, not just the in-memory service", async () => {
    const inWindow = fakeRecord({ id: "in-window", startsAt: new Date("2026-06-10T00:00:00Z"), endsAt: new Date("2026-06-15T00:00:00Z") });
    const beforeWindow = fakeRecord({ id: "before-window", startsAt: new Date("2026-01-01T00:00:00Z"), endsAt: new Date("2026-01-05T00:00:00Z") });
    const afterWindow = fakeRecord({ id: "after-window", startsAt: new Date("2026-12-01T00:00:00Z"), endsAt: new Date("2026-12-05T00:00:00Z") });
    const repository = new HubEventRepository(createFakePrisma([inWindow, beforeWindow, afterWindow]) as never);

    const result = await repository.listPublished({ from: "2026-06-01T00:00:00Z", to: "2026-06-30T00:00:00Z" });

    expect(result.items.map((event) => event.id)).toEqual(["in-window"]);
  });

  it("does not cap a windowed query at the default 50/100-item page size", async () => {
    const records = Array.from({ length: 120 }, (_, index) =>
      fakeRecord({
        id: `event-${index}`,
        startsAt: new Date(Date.UTC(2026, 5, 1 + (index % 28))),
        endsAt: new Date(Date.UTC(2026, 5, 1 + (index % 28)))
      })
    );
    const repository = new HubEventRepository(createFakePrisma(records) as never);

    const result = await repository.listPublished({ from: "2026-06-01T00:00:00Z", to: "2026-06-30T00:00:00Z" });

    expect(result.items.length).toBe(120);
  });

  it("keeps the legacy 100-item cap and 50-item default for non-windowed queries", async () => {
    const records = Array.from({ length: 120 }, (_, index) =>
      fakeRecord({ id: `event-${index}`, startsAt: new Date(Date.UTC(2026, 0, 1)), endsAt: new Date(Date.UTC(2026, 0, 2)) })
    );
    const repository = new HubEventRepository(createFakePrisma(records) as never);

    const defaultResult = await repository.listPublished({});
    expect(defaultResult.items.length).toBe(50);

    const cappedResult = await repository.listPublished({ limit: 500 });
    expect(cappedResult.items.length).toBe(100);
  });

  it("treats a null endsAt/startsAt as always overlapping the window (coarse DB filter, exact post-filter)", async () => {
    const openEnded = fakeRecord({ id: "open-ended", startsAt: new Date("2026-06-10T00:00:00Z"), endsAt: null });
    const repository = new HubEventRepository(createFakePrisma([openEnded]) as never);

    const result = await repository.listPublished({ from: "2026-06-01T00:00:00Z", to: "2026-06-30T00:00:00Z" });

    expect(result.items.map((event) => event.id)).toEqual(["open-ended"]);
  });
});
