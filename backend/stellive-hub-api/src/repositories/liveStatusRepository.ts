import type { LiveStatusDiagnostic } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

export interface LiveStatusRecord {
  memberId: string;
  generationId: string;
  isLive: boolean;
  title: string | null;
  liveCategory: string | null;
  thumbnailUrl: string | null;
  viewerCount: number | null;
  startedAt: Date | null;
  platformUrl: string | null;
  lastCheckedAt: Date;
  sourceVerificationState: string;
  lastTransitionAt?: Date | null;
}

interface LiveStatusDiagnosticSelect {
  memberId: true;
  generationId: true;
  isLive: true;
  title: true;
  liveCategory: true;
  thumbnailUrl: true;
  viewerCount: true;
  startedAt: true;
  platformUrl: true;
  lastCheckedAt: true;
  sourceVerificationState: true;
}

interface LiveStatusSelect extends LiveStatusDiagnosticSelect {
  lastTransitionAt: true;
}

interface LiveStatusWriteData {
  memberId: string;
  generationId: string;
  isLive: boolean;
  title: string | null;
  liveCategory: string | null;
  thumbnailUrl: string | null;
  viewerCount: number | null;
  startedAt: Date | null;
  platformUrl: string | null;
  sourceVerificationState: string;
  lastCheckedAt: Date;
  lastTransitionAt: Date | null;
}

interface LiveStatusDelegate {
  liveStatus: {
    upsert(args: {
      where: { memberId: string };
      create: LiveStatusWriteData;
      update: Omit<LiveStatusWriteData, "memberId">;
    }): Promise<LiveStatusRecord>;
    findUnique(args: {
      where: { memberId: string };
      select: LiveStatusSelect;
    }): Promise<LiveStatusRecord | null>;
    findMany(args: {
      orderBy: { lastCheckedAt: "desc" };
      take: number;
      select: LiveStatusDiagnosticSelect;
    }): Promise<LiveStatusRecord[]>;
  };
}

export interface LiveStatusWriteInput {
  memberId: string;
  generationId: string;
  isLive: boolean;
  title?: string;
  liveCategory?: string;
  thumbnailUrl?: string;
  viewerCount?: number;
  startedAt?: Date;
  platformUrl?: string;
  sourceVerificationState: string;
  lastCheckedAt?: Date;
  lastTransitionAt?: Date;
}

const liveStatusDiagnosticSelect: LiveStatusDiagnosticSelect = {
  memberId: true,
  generationId: true,
  isLive: true,
  title: true,
  liveCategory: true,
  thumbnailUrl: true,
  viewerCount: true,
  startedAt: true,
  platformUrl: true,
  lastCheckedAt: true,
  sourceVerificationState: true
};

const liveStatusSelect: LiveStatusSelect = {
  ...liveStatusDiagnosticSelect,
  lastTransitionAt: true
};

function clampDiagnosticLimit(limit: number, defaultLimit: number): number {
  if (!Number.isFinite(limit)) return defaultLimit;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function toDiagnostic(record: LiveStatusRecord): LiveStatusDiagnostic {
  return {
    memberId: record.memberId,
    generationId: record.generationId,
    isLive: record.isLive,
    title: record.title ?? undefined,
    liveCategory: record.liveCategory ?? undefined,
    channelImageUrl: record.thumbnailUrl ?? undefined,
    viewerCount: record.viewerCount ?? undefined,
    startedAt: record.startedAt?.toISOString(),
    platformUrl: record.platformUrl ?? undefined,
    lastCheckedAt: record.lastCheckedAt.toISOString(),
    sourceVerificationState: record.sourceVerificationState
  };
}

function toWriteData(input: LiveStatusWriteInput): LiveStatusWriteData {
  return {
    memberId: input.memberId,
    generationId: input.generationId,
    isLive: input.isLive,
    title: input.title ?? null,
    liveCategory: input.liveCategory ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    viewerCount: input.viewerCount ?? null,
    startedAt: input.startedAt ?? null,
    platformUrl: input.platformUrl ?? null,
    sourceVerificationState: input.sourceVerificationState,
    lastCheckedAt: input.lastCheckedAt ?? new Date(),
    lastTransitionAt: input.lastTransitionAt ?? null
  };
}

export class LiveStatusRepository {
  constructor(private readonly prisma: LiveStatusDelegate = getPrismaClient() as unknown as LiveStatusDelegate) {}

  async upsertLiveStatus(input: LiveStatusWriteInput): Promise<LiveStatusRecord> {
    const data = toWriteData(input);
    const existing =
      input.thumbnailUrl === undefined
        ? await this.getByMemberId(input.memberId)
        : null;

    return this.prisma.liveStatus.upsert({
      where: { memberId: input.memberId },
      create: data,
      update: {
        generationId: data.generationId,
        isLive: data.isLive,
        title: data.title,
        liveCategory: data.liveCategory,
        viewerCount: data.viewerCount,
        startedAt: data.startedAt,
        platformUrl: data.platformUrl,
        sourceVerificationState: data.sourceVerificationState,
        lastCheckedAt: data.lastCheckedAt,
        thumbnailUrl: data.thumbnailUrl ?? existing?.thumbnailUrl ?? null,
        lastTransitionAt: data.lastTransitionAt
      }
    });
  }

  async getByMemberId(memberId: string): Promise<LiveStatusRecord | null> {
    return this.prisma.liveStatus.findUnique({
      where: { memberId },
      select: liveStatusSelect
    });
  }

  async listDiagnostics(limit = 50): Promise<LiveStatusDiagnostic[]> {
    const records = await this.prisma.liveStatus.findMany({
      orderBy: { lastCheckedAt: "desc" },
      take: clampDiagnosticLimit(limit, 50),
      select: liveStatusDiagnosticSelect
    });

    return records.map(toDiagnostic);
  }
}
