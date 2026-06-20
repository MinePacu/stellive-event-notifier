import { describe, expect, it, vi } from "vitest";
import type { HubCalendarSpecialDay } from "../src/types.js";
import { buildSpecialDayOccurrences } from "../src/hub-events/hubCalendarSpecialDayMaterializer.js";
import { HubCalendarSpecialDayOccurrenceRepository } from "../src/hub-events/hubCalendarSpecialDayOccurrenceRepository.js";

function specialDay(overrides: Partial<HubCalendarSpecialDay> = {}): HubCalendarSpecialDay {
  return {
    id: "birthday:ayatsuno-yuni",
    kind: "member_birthday",
    title: "아야츠노 유니 생일",
    generationId: "gen1",
    memberId: "ayatsuno-yuni",
    month: 5,
    day: 21,
    activeStatus: "active",
    catalogRole: "member",
    sourceLabel: "카탈로그",
    policyState: "catalog_verified",
    ...overrides
  };
}

describe("hub calendar special-day year materializer", () => {
  it("builds deterministic KST day occurrences for a target year", () => {
    const occurrences = buildSpecialDayOccurrences(
      [
        specialDay(),
        specialDay({
          id: "birthday:today-like",
          title: "오늘 생일",
          memberId: "today-like",
          month: 6,
          day: 20
        }),
        specialDay({
          id: "anniversary:gen3:debut",
          kind: "generation_anniversary",
          title: "스텔라이브 3기",
          generationId: "gen3",
          memberId: undefined,
          month: 5,
          day: 19,
          startYear: 2024
        })
      ],
      { targetYear: 2026, timezone: "Asia/Seoul" }
    );

    expect(occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "special-day-occurrence:birthday:ayatsuno-yuni:2026",
          specialDayId: "birthday:ayatsuno-yuni",
          kind: "member_birthday",
          displayYear: 2026,
          displayDate: "2026-05-21",
          startsAt: new Date("2026-05-20T15:00:00.000Z"),
          endsAt: new Date("2026-05-21T15:00:00.000Z"),
          specialDayLabel: "생일"
        }),
        expect.objectContaining({
          id: "special-day-occurrence:anniversary:gen3:debut:2026",
          specialDayLabel: "2주년",
          title: "스텔라이브 3기 2주년"
        })
      ])
    );
  });

  it("excludes unverified, official, malformed, and non-positive anniversary entries", () => {
    const occurrences = buildSpecialDayOccurrences(
      [
        specialDay({ id: "birthday:verify", policyState: "verify_required" }),
        specialDay({
          id: "birthday:official",
          generationId: "official" as HubCalendarSpecialDay["generationId"]
        }),
        specialDay({ id: "birthday:missing-member", memberId: undefined }),
        specialDay({
          id: "anniversary:missing-start",
          kind: "generation_anniversary",
          memberId: undefined,
          startYear: undefined
        }),
        specialDay({
          id: "anniversary:non-positive",
          kind: "generation_anniversary",
          memberId: undefined,
          startYear: 2026
        })
      ],
      { targetYear: 2026, timezone: "Asia/Seoul" }
    );

    expect(occurrences).toEqual([]);
  });

  it("upserts materialized occurrences without creating duplicates", async () => {
    const rows = new Map<string, unknown>();
    const delegate = {
      findUnique: vi.fn(async ({ where }: { where: { specialDayId_displayYear: { specialDayId: string; displayYear: number } } }) => {
        const key = `${where.specialDayId_displayYear.specialDayId}:${where.specialDayId_displayYear.displayYear}`;
        return rows.get(key);
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { specialDayId_displayYear: { specialDayId: string; displayYear: number } }; create: unknown; update: unknown }) => {
        const key = `${where.specialDayId_displayYear.specialDayId}:${where.specialDayId_displayYear.displayYear}`;
        const value = rows.has(key) ? { ...(rows.get(key) as object), ...(update as object) } : create;
        rows.set(key, value);
        return value;
      }),
      findMany: vi.fn()
    };
    const repository = new HubCalendarSpecialDayOccurrenceRepository({ hubCalendarSpecialDayOccurrence: delegate });
    const occurrences = buildSpecialDayOccurrences([specialDay()], { targetYear: 2026, timezone: "Asia/Seoul" });

    const first = await repository.upsertYear(occurrences, { dryRun: false });
    const second = await repository.upsertYear(occurrences, { dryRun: false });

    expect(first).toMatchObject({ targetYear: 2026, timezone: "Asia/Seoul", created: 1, updated: 0, skipped: 0, dryRun: false });
    expect(second).toMatchObject({ targetYear: 2026, timezone: "Asia/Seoul", created: 0, updated: 1, skipped: 0, dryRun: false });
    expect(rows).toHaveLength(1);
    expect(delegate.upsert).toHaveBeenCalledTimes(2);
  });
});
