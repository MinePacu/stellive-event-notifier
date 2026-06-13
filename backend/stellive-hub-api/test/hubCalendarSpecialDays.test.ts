import { describe, expect, it } from "vitest";
import type { HubCalendarSpecialDay } from "../src/types.js";
import { productionHubCalendarSpecialDays } from "../src/hub-events/hubCalendarSpecialDayCatalog.js";
import { anniversaryYearFor, buildSpecialDayEntries } from "../src/hub-events/hubCalendarSpecialDays.js";

const now = new Date("2026-06-12T00:00:00.000Z");

function specialDay(overrides: Partial<HubCalendarSpecialDay> = {}): HubCalendarSpecialDay {
  return {
    id: "birthday:member-yuni",
    kind: "member_birthday",
    title: "아야츠노 유니 생일",
    generationId: "gen1",
    memberId: "member-yuni",
    month: 6,
    day: 12,
    activeStatus: "active",
    catalogRole: "member",
    sourceLabel: "카탈로그",
    policyState: "catalog_verified",
    ...overrides
  };
}

describe("hub calendar special days", () => {
  it("projects active member birthdays inside the requested local-date range", () => {
    const entries = buildSpecialDayEntries([specialDay()], {
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-30T23:59:59.999Z"),
      timezone: "Asia/Seoul",
      now
    });

    expect(entries).toEqual([
      expect.objectContaining({
        id: "birthday:member-yuni:2026-06-12",
        eventId: "birthday:member-yuni",
        entryKind: "member_birthday",
        specialDayKind: "member_birthday",
        title: "아야츠노 유니 생일",
        generationId: "gen1",
        memberId: "member-yuni",
        displayDate: "2026-06-12",
        displayTimeText: "종일",
        sourceLabel: "카탈로그",
        appDeepLink: "stellivehub://calendar/special-days/birthday:member-yuni?date=2026-06-12"
      })
    ]);
  });

  it("drops unverified, official, and malformed special days", () => {
    const entries = buildSpecialDayEntries(
      [
        specialDay({ id: "birthday:verify", policyState: "verify_required" }),
        specialDay({ id: "birthday:official", generationId: "official" as never }),
        specialDay({ id: "birthday:missing-member", memberId: undefined }),
        specialDay({ id: "birthday:official-channel", catalogRole: "official_channel" as never })
      ],
      {
        from: new Date("2026-06-01T00:00:00.000Z"),
        to: new Date("2026-06-30T23:59:59.999Z"),
        timezone: "Asia/Seoul",
        now
      }
    );

    expect(entries).toEqual([]);
  });

  it("projects generation anniversaries only after their start year", () => {
    const entries = buildSpecialDayEntries(
      [
        specialDay({
          id: "anniversary:gen3:debut",
          kind: "generation_anniversary",
          title: "스텔라이브 3기",
          generationId: "gen3",
          memberId: undefined,
          month: 5,
          day: 19,
          startYear: 2024,
          catalogRole: undefined
        })
      ],
      {
        from: new Date("2026-05-01T00:00:00.000Z"),
        to: new Date("2026-05-31T23:59:59.999Z"),
        timezone: "Asia/Seoul",
        now
      }
    );

    expect(anniversaryYearFor(2026, 2024)).toBe(2);
    expect(anniversaryYearFor(2024, 2024)).toBeUndefined();
    expect(entries).toEqual([
      expect.objectContaining({
        id: "anniversary:gen3:debut:2026-05-19",
        eventId: "anniversary:gen3:debut",
        entryKind: "generation_anniversary",
        specialDayKind: "generation_anniversary",
        specialDayLabel: "2주년",
        title: "스텔라이브 3기 2주년",
        generationId: "gen3",
        displayDate: "2026-05-19"
      })
    ]);
  });
});

describe("production hub calendar special-day catalog", () => {
  it("contains only the verified active member birthdays approved for production", () => {
    expect(productionHubCalendarSpecialDays).toHaveLength(10);
    expect(productionHubCalendarSpecialDays.map((day) => day.id).sort()).toEqual([
      "birthday:akane-lize",
      "birthday:aokumo-rin",
      "birthday:arahashi-tabi",
      "birthday:ayatsuno-yuni",
      "birthday:hanako-nana",
      "birthday:neneko-mashiro",
      "birthday:sakihane-huya",
      "birthday:shirayuki-hina",
      "birthday:tenko-shibuki",
      "birthday:yuzuha-riko"
    ]);
    expect(productionHubCalendarSpecialDays.every((day) => day.kind === "member_birthday")).toBe(true);
    expect(productionHubCalendarSpecialDays.every((day) => day.policyState === "catalog_verified")).toBe(true);
    expect(productionHubCalendarSpecialDays.some((day) => day.memberId === "gangzi")).toBe(false);
    expect(productionHubCalendarSpecialDays.some((day) => day.kind === "generation_anniversary")).toBe(false);
  });
});
