import { getPrismaClient } from "../storage/prisma.js";
import type { SpecialDayOccurrence } from "./hubCalendarSpecialDayMaterializer.js";

interface SpecialDayOccurrenceRecord {
  id: string;
  specialDayId: string;
  kind: string;
  displayYear: number;
  displayDate: string;
  title: string;
  specialDayLabel: string;
  generationId: string;
  memberId: string | null;
  startsAt: Date;
  endsAt: Date;
  sourceLabel: string;
  policyState: string;
}

interface SpecialDayOccurrenceDelegate {
  findUnique(args: {
    where: { specialDayId_displayYear: { specialDayId: string; displayYear: number } };
  }): Promise<SpecialDayOccurrenceRecord | unknown | null>;
  upsert(args: {
    where: { specialDayId_displayYear: { specialDayId: string; displayYear: number } };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
  findMany(args: { where: Record<string, unknown>; orderBy: Array<Record<string, "asc" | "desc">> }): Promise<SpecialDayOccurrenceRecord[]>;
}

export interface MaterializeSpecialDayYearResult {
  targetYear: number;
  timezone: "Asia/Seoul";
  created: number;
  updated: number;
  skipped: number;
  dryRun: boolean;
}

export interface UpsertSpecialDayYearOptions {
  dryRun?: boolean;
  targetYear?: number;
}

export interface SpecialDayOccurrenceRangeFilters {
  from: Date;
  to: Date;
  generationId?: string;
  memberId?: string;
  kind?: string;
}

function defaultDelegate(): SpecialDayOccurrenceDelegate {
  const prisma = getPrismaClient() as unknown as { hubCalendarSpecialDayOccurrence: SpecialDayOccurrenceDelegate };
  return prisma.hubCalendarSpecialDayOccurrence;
}

export function createHubCalendarSpecialDayOccurrenceRepositoryIfAvailable():
  | HubCalendarSpecialDayOccurrenceRepository
  | undefined {
  const prisma = getPrismaClient() as unknown as { hubCalendarSpecialDayOccurrence?: SpecialDayOccurrenceDelegate };
  if (!prisma.hubCalendarSpecialDayOccurrence) return undefined;
  return new HubCalendarSpecialDayOccurrenceRepository({ hubCalendarSpecialDayOccurrence: prisma.hubCalendarSpecialDayOccurrence });
}

function occurrenceData(occurrence: SpecialDayOccurrence): Record<string, unknown> {
  return {
    id: occurrence.id,
    specialDayId: occurrence.specialDayId,
    kind: occurrence.kind,
    displayYear: occurrence.displayYear,
    displayDate: occurrence.displayDate,
    title: occurrence.title,
    specialDayLabel: occurrence.specialDayLabel,
    generationId: occurrence.generationId,
    memberId: occurrence.memberId,
    startsAt: occurrence.startsAt,
    endsAt: occurrence.endsAt,
    sourceLabel: occurrence.sourceLabel,
    policyState: occurrence.policyState
  };
}

function toOccurrence(record: SpecialDayOccurrenceRecord): SpecialDayOccurrence {
  return {
    id: record.id,
    specialDayId: record.specialDayId,
    kind: record.kind as SpecialDayOccurrence["kind"],
    displayYear: record.displayYear,
    displayDate: record.displayDate,
    title: record.title,
    specialDayLabel: record.specialDayLabel,
    generationId: record.generationId,
    memberId: record.memberId ?? undefined,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    sourceLabel: record.sourceLabel,
    policyState: "catalog_verified"
  };
}

export class HubCalendarSpecialDayOccurrenceRepository {
  private readonly delegate: SpecialDayOccurrenceDelegate;

  constructor(prisma: { hubCalendarSpecialDayOccurrence: SpecialDayOccurrenceDelegate } = { hubCalendarSpecialDayOccurrence: defaultDelegate() }) {
    this.delegate = prisma.hubCalendarSpecialDayOccurrence;
  }

  async upsertYear(
    occurrences: SpecialDayOccurrence[],
    options: UpsertSpecialDayYearOptions = {}
  ): Promise<MaterializeSpecialDayYearResult> {
    const dryRun = options.dryRun === true;
    const targetYear = options.targetYear ?? occurrences[0]?.displayYear ?? 0;
    if (dryRun) {
      return { targetYear, timezone: "Asia/Seoul", created: 0, updated: 0, skipped: occurrences.length, dryRun };
    }

    let created = 0;
    let updated = 0;

    for (const occurrence of occurrences) {
      const where = {
        specialDayId_displayYear: {
          specialDayId: occurrence.specialDayId,
          displayYear: occurrence.displayYear
        }
      };
      const existing = await this.delegate.findUnique({ where });
      const data = occurrenceData(occurrence);
      await this.delegate.upsert({
        where,
        create: data,
        update: data
      });
      if (existing) updated += 1;
      else created += 1;
    }

    return { targetYear, timezone: "Asia/Seoul", created, updated, skipped: 0, dryRun };
  }

  async listRange(filters: SpecialDayOccurrenceRangeFilters): Promise<SpecialDayOccurrence[]> {
    const where: Record<string, unknown> = {
      startsAt: { lte: filters.to },
      endsAt: { gte: filters.from }
    };
    if (filters.generationId) where.generationId = filters.generationId;
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.kind) where.kind = filters.kind;

    const records = await this.delegate.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }]
    });
    return records.map(toOccurrence);
  }
}
