import type { HubCalendarSpecialDay } from "../types.js";

export interface SpecialDayOccurrence {
  id: string;
  specialDayId: string;
  kind: "member_birthday" | "generation_anniversary";
  displayYear: number;
  displayDate: string;
  title: string;
  specialDayLabel: string;
  generationId: string;
  memberId?: string;
  startsAt: Date;
  endsAt: Date;
  sourceLabel: string;
  policyState: "catalog_verified";
}

export interface BuildSpecialDayOccurrencesOptions {
  targetYear: number;
  timezone: "Asia/Seoul";
  includeVerifyRequired?: boolean;
}

export function anniversaryYearFor(displayYear: number, startYear: number): number | undefined {
  const anniversaryYear = displayYear - startYear;
  return anniversaryYear > 0 ? anniversaryYear : undefined;
}

function localDateString(year: number, month: number, day: number): string {
  return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function kstDayStart(displayDate: string): Date {
  return new Date(`${displayDate}T00:00:00+09:00`);
}

function isValidLocalDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isAllowedSpecialDay(day: HubCalendarSpecialDay, options: BuildSpecialDayOccurrencesOptions): boolean {
  if (!options.includeVerifyRequired && day.policyState !== "catalog_verified") return false;
  if (day.policyState !== "catalog_verified") return false;
  if (day.generationId === ("official" as HubCalendarSpecialDay["generationId"])) return false;
  if (day.activeStatus !== "active" && day.activeStatus !== "upcoming") return false;
  if (day.kind === "member_birthday" && !day.memberId) return false;
  if (day.kind === "generation_anniversary" && !day.startYear) return false;
  return true;
}

function occurrenceForSpecialDay(
  day: HubCalendarSpecialDay,
  options: BuildSpecialDayOccurrencesOptions
): SpecialDayOccurrence | undefined {
  if (!isAllowedSpecialDay(day, options)) return undefined;
  if (!isValidLocalDate(options.targetYear, day.month, day.day)) return undefined;

  const displayDate = localDateString(options.targetYear, day.month, day.day);
  const startsAt = kstDayStart(displayDate);
  const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);

  if (day.kind === "generation_anniversary") {
    const anniversaryYear = anniversaryYearFor(options.targetYear, day.startYear ?? options.targetYear);
    if (!anniversaryYear) return undefined;
    const specialDayLabel = `${anniversaryYear}주년`;
    return {
      id: `special-day-occurrence:${day.id}:${options.targetYear}`,
      specialDayId: day.id,
      kind: "generation_anniversary",
      displayYear: options.targetYear,
      displayDate,
      title: `${day.title} ${specialDayLabel}`,
      specialDayLabel,
      generationId: day.generationId,
      memberId: day.memberId,
      startsAt,
      endsAt,
      sourceLabel: day.sourceLabel,
      policyState: "catalog_verified"
    };
  }

  return {
    id: `special-day-occurrence:${day.id}:${options.targetYear}`,
    specialDayId: day.id,
    kind: "member_birthday",
    displayYear: options.targetYear,
    displayDate,
    title: day.title,
    specialDayLabel: "생일",
    generationId: day.generationId,
    memberId: day.memberId,
    startsAt,
    endsAt,
    sourceLabel: day.sourceLabel,
    policyState: "catalog_verified"
  };
}

export function buildSpecialDayOccurrences(
  specialDays: HubCalendarSpecialDay[],
  options: BuildSpecialDayOccurrencesOptions
): SpecialDayOccurrence[] {
  return specialDays.flatMap((day) => {
    const occurrence = occurrenceForSpecialDay(day, options);
    return occurrence ? [occurrence] : [];
  });
}
