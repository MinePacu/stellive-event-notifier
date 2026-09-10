import type {
  AnnouncementsSummary,
  ServiceAnnouncement,
  ServiceAnnouncementPlatform,
  ServiceAnnouncementPublicationState,
  ServiceAnnouncementSeverity,
  ServiceAnnouncementType,
} from "../../../../shared/schemas/domain.js";
import { getPrismaClient } from "../storage/prisma.js";
import { compareAppVersions, evaluateServiceAnnouncementTarget } from "./serviceAnnouncementTargetPolicy.js";

export interface ServiceAnnouncementRecord {
  id: string;
  type: string;
  severity: string;
  publicationState: string;
  title: string;
  summary: string;
  body: string;
  isPinned: boolean;
  targetPlatforms: unknown;
  minimumAppVersion: string | null;
  maximumAppVersion: string | null;
  appDeepLink: string | null;
  externalUrl: string | null;
  actionLabel: string | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  pushEnabled: boolean;
  pushStatus: string;
  pushSentAt: Date | null;
  attentionRevision: number;
  revision: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminServiceAnnouncement extends ServiceAnnouncementRecord {
  targetPlatforms: ServiceAnnouncementPlatform[];
}

export interface ServiceAnnouncementWriteInput {
  type?: ServiceAnnouncementType;
  severity?: ServiceAnnouncementSeverity;
  title?: string;
  summary?: string;
  body?: string;
  isPinned?: boolean;
  targetPlatforms?: ServiceAnnouncementPlatform[];
  minimumAppVersion?: string | null;
  maximumAppVersion?: string | null;
  appDeepLink?: string | null;
  externalUrl?: string | null;
  actionLabel?: string | null;
  expiresAt?: string | Date | null;
  pushEnabled?: boolean;
}

export interface ServiceAnnouncementPushAttemptEntry {
  id: string;
  announcementId: string;
  attentionRevision: number;
  topic?: string;
  eventId?: string;
  status: string;
  providerMessageId?: string;
  providerErrorCode?: string;
  retryAfterMs?: number;
  requestedBy?: string;
  requestedAt: string;
  completedAt?: string;
}

export interface ServiceAnnouncementAuditEntry {
  id: string;
  announcementId: string;
  action: string;
  actorId?: string;
  reason?: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

type PrismaLike = ReturnType<typeof getPrismaClient>;

function platforms(value: unknown): ServiceAnnouncementPlatform[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ServiceAnnouncementPlatform => item === "android" || item === "ios");
}

function nullableDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function writeData(input: ServiceAnnouncementWriteInput): Record<string, unknown> {
  return stripUndefined({
    type: input.type,
    severity: input.severity,
    title: input.title?.trim(),
    summary: input.summary?.trim(),
    body: input.body?.trim(),
    isPinned: input.isPinned,
    targetPlatforms: input.targetPlatforms,
    minimumAppVersion: input.minimumAppVersion,
    maximumAppVersion: input.maximumAppVersion,
    appDeepLink: input.appDeepLink,
    externalUrl: input.externalUrl,
    actionLabel: input.actionLabel,
    expiresAt: nullableDate(input.expiresAt),
    pushEnabled: input.pushEnabled,
  });
}

function toPublic(record: ServiceAnnouncementRecord): ServiceAnnouncement {
  return {
    id: record.id,
    type: record.type as ServiceAnnouncementType,
    severity: record.severity as ServiceAnnouncementSeverity,
    title: record.title,
    summary: record.summary,
    body: record.body,
    isPinned: record.isPinned,
    targetPlatforms: platforms(record.targetPlatforms),
    minimumAppVersion: record.minimumAppVersion ?? undefined,
    maximumAppVersion: record.maximumAppVersion ?? undefined,
    appDeepLink: record.appDeepLink ?? undefined,
    externalUrl: record.externalUrl ?? undefined,
    actionLabel: record.actionLabel ?? undefined,
    publishedAt: record.publishedAt!.toISOString(),
    expiresAt: record.expiresAt?.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString(),
    archivedAt: record.archivedAt?.toISOString(),
    attentionRevision: record.attentionRevision,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toAdmin(record: ServiceAnnouncementRecord): AdminServiceAnnouncement {
  return { ...record, targetPlatforms: platforms(record.targetPlatforms) };
}

export { compareAppVersions } from "./serviceAnnouncementTargetPolicy.js";

export function isAnnouncementVisibleToClient(record: ServiceAnnouncementRecord, input: {
  platform?: ServiceAnnouncementPlatform;
  appVersion?: string;
  includeArchived?: boolean;
  now: Date;
}): boolean {
  if (record.deletedAt || !record.publishedAt) return false;
  if (record.publicationState !== "published" && !(input.includeArchived && record.publicationState === "archived")) return false;
  if (record.expiresAt && record.expiresAt <= input.now) return false;
  return evaluateServiceAnnouncementTarget({
    targetPlatforms: platforms(record.targetPlatforms),
    minimumAppVersion: record.minimumAppVersion,
    maximumAppVersion: record.maximumAppVersion,
    platform: input.platform,
    // Read API intentionally preserves omitted query dimensions: an omitted appVersion
    // does not filter the list, while worker evaluation requires it when bounded.
    appVersion: input.appVersion,
    requireVersionForBounds: false,
  }).eligible;
}

export class ServiceAnnouncementRepository {
  constructor(private readonly prisma: PrismaLike = getPrismaClient()) {}

  async listPublic(input: {
    platform?: ServiceAnnouncementPlatform;
    appVersion?: string;
    includeArchived?: boolean;
    cursor?: string;
    limit?: number;
    now?: Date;
  } = {}): Promise<{ items: ServiceAnnouncement[]; nextCursor?: string }> {
    const now = input.now ?? new Date();
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const where = {
      deletedAt: null,
      publicationState: { in: input.includeArchived ? ["published", "archived"] : ["published"] },
    };
    const orderBy = [{ publishedAt: "desc" as const }, { id: "asc" as const }];
    // DB-level cursor pagination: page through the ordered set in batches and apply the
    // client-visibility filter per record, accumulating until we have one more than the
    // requested limit (to detect a next page) or the table is exhausted. This avoids the
    // previous take:500 cap (which permanently dropped records past the first 500 visible)
    // and the in-memory findIndex cursor (which re-returned the first page on an unknown
    // cursor). An unknown cursor id is now surfaced as a Prisma error rather than silently
    // restarting pagination.
    const batchSize = Math.max(limit + 1, 50);
    const visible: ServiceAnnouncementRecord[] = [];
    let cursorId = input.cursor;
    for (let guard = 0; visible.length <= limit && guard < 1000; guard += 1) {
      const batch = await this.prisma.serviceAnnouncement.findMany({
        where,
        orderBy,
        take: batchSize,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
      for (const record of batch) {
        if (isAnnouncementVisibleToClient(record, { ...input, now })) visible.push(record);
      }
      if (batch.length < batchSize) break;
      cursorId = batch[batch.length - 1]!.id;
    }
    const page = visible.slice(0, limit);
    return {
      items: page.map(toPublic),
      nextCursor: visible.length > limit ? page.at(-1)?.id : undefined,
    };
  }

  async getPublicById(id: string, input: { platform?: ServiceAnnouncementPlatform; appVersion?: string; now?: Date } = {}): Promise<ServiceAnnouncement | undefined> {
    const record = await this.prisma.serviceAnnouncement.findUnique({ where: { id } });
    return record && isAnnouncementVisibleToClient(record, { ...input, now: input.now ?? new Date() }) ? toPublic(record) : undefined;
  }

  async summary(input: { platform?: ServiceAnnouncementPlatform; appVersion?: string; now?: Date } = {}): Promise<AnnouncementsSummary> {
    const now = input.now ?? new Date();
    const { items } = await this.listPublic({ ...input, limit: 100, now });
    const pinned = items
      .filter((item) => item.severity === "critical" || (item.isPinned && item.severity === "important"))
      .sort((left, right) => {
        const severity = Number(right.severity === "critical") - Number(left.severity === "critical");
        return severity || right.publishedAt.localeCompare(left.publishedAt);
      })[0];
    return {
      activeCount: items.length,
      items: items.map(({ id, attentionRevision, publishedAt, severity, isPinned }) => ({ id, attentionRevision, publishedAt, severity, isPinned })),
      pinned,
      generatedAt: now.toISOString(),
    };
  }

  async listAdmin(input: { publicationState?: ServiceAnnouncementPublicationState; limit?: number; cursor?: string } = {}) {
    const limit = Math.min(100, Math.max(1, input.limit ?? 50));
    const records = await this.prisma.serviceAnnouncement.findMany({
      where: stripUndefined({ publicationState: input.publicationState, deletedAt: null }),
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
    });
    return { items: records.slice(0, limit).map(toAdmin), nextCursor: records.length > limit ? records[limit]?.id : undefined };
  }

  async getAdminById(id: string): Promise<AdminServiceAnnouncement | undefined> {
    const record = await this.prisma.serviceAnnouncement.findUnique({ where: { id } });
    return record ? toAdmin(record) : undefined;
  }

  async createDraft(input: ServiceAnnouncementWriteInput, actorId?: string): Promise<AdminServiceAnnouncement> {
    const record = await this.prisma.serviceAnnouncement.create({ data: {
      type: "general", severity: "info", title: "", summary: "", body: "", targetPlatforms: [],
      ...writeData(input), publicationState: "draft", attentionRevision: 1, revision: 1,
      createdBy: actorId, updatedBy: actorId,
    } as never });
    return toAdmin(record);
  }

  async update(id: string, input: ServiceAnnouncementWriteInput, actorId?: string): Promise<AdminServiceAnnouncement> {
    const record = await this.prisma.serviceAnnouncement.update({ where: { id }, data: {
      ...writeData(input), updatedBy: actorId, revision: { increment: 1 },
    } as never });
    return toAdmin(record);
  }

  async transition(id: string, data: Record<string, unknown>, actorId?: string): Promise<AdminServiceAnnouncement> {
    const record = await this.prisma.serviceAnnouncement.update({ where: { id }, data: {
      ...data, updatedBy: actorId, revision: { increment: 1 },
    } as never });
    return toAdmin(record);
  }

  async bumpAttention(id: string, actorId?: string): Promise<AdminServiceAnnouncement> {
    const record = await this.prisma.serviceAnnouncement.update({ where: { id }, data: {
      attentionRevision: { increment: 1 }, revision: { increment: 1 }, updatedBy: actorId,
    } });
    return toAdmin(record);
  }

  async softDelete(id: string, deletedAt: Date, actorId?: string): Promise<AdminServiceAnnouncement> {
    const record = await this.prisma.serviceAnnouncement.update({ where: { id }, data: {
      deletedAt, updatedBy: actorId, revision: { increment: 1 },
    } });
    return toAdmin(record);
  }

  async writeAudit(input: { announcementId: string; action: string; actorId?: string; reason?: string; before: unknown; after: unknown }): Promise<void> {
    await this.prisma.serviceAnnouncementAuditLog.create({ data: input as never });
  }

  async listAudit(announcementId: string, limit = 50): Promise<ServiceAnnouncementAuditEntry[]> {
    const records = await this.prisma.serviceAnnouncementAuditLog.findMany({ where: { announcementId }, orderBy: { createdAt: "desc" }, take: Math.min(100, limit) });
    return records.map((record) => ({ ...record, actorId: record.actorId ?? undefined, reason: record.reason ?? undefined, createdAt: record.createdAt.toISOString() }));
  }

  async createPushAttempt(input: { announcementId: string; attentionRevision: number; topic?: string; eventId?: string; requestedBy?: string; status?: string }): Promise<string> {
    const data = { ...input, status: input.status ?? "sending" };
    const record = input.eventId
      ? await this.prisma.serviceAnnouncementPushAttempt.upsert({ where: { eventId: input.eventId }, create: data, update: {} })
      : await this.prisma.serviceAnnouncementPushAttempt.create({ data });
    return record.id;
  }

  async completePushAttempt(id: string, input: { status: string; providerMessageId?: string; providerErrorCode?: string; retryAfterMs?: number; completedAt: Date }): Promise<void> {
    await this.prisma.serviceAnnouncementPushAttempt.update({ where: { id }, data: input });
  }

  async completeDispatchByEventId(input: {
    eventId: string;
    status: "sent" | "skipped" | "failed";
    providerErrorCode?: string;
    retryAfterMs?: number;
    completedAt: Date;
    pushSentAt?: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const attempt = await transaction.serviceAnnouncementPushAttempt.update({
        where: { eventId: input.eventId },
        data: {
          status: input.status,
          providerErrorCode: input.providerErrorCode,
          retryAfterMs: input.retryAfterMs,
          completedAt: input.completedAt,
        },
      });
      await transaction.serviceAnnouncement.update({
        where: { id: attempt.announcementId },
        data: {
          pushStatus: input.status,
          ...(input.pushSentAt ? { pushSentAt: input.pushSentAt } : {}),
        },
      });
    });
  }

  async markPushResult(id: string, input: { pushStatus: string; pushSentAt?: Date }): Promise<void> {
    await this.prisma.serviceAnnouncement.update({ where: { id }, data: input });
  }

  async hasSuccessfulPush(id: string, attentionRevision: number): Promise<boolean> {
    return (await this.prisma.serviceAnnouncementPushAttempt.count({ where: { announcementId: id, attentionRevision, status: "sent" } })) > 0;
  }

  async listPushAttempts(announcementId: string, limit = 50): Promise<ServiceAnnouncementPushAttemptEntry[]> {
    const records = await this.prisma.serviceAnnouncementPushAttempt.findMany({ where: { announcementId }, orderBy: { requestedAt: "desc" }, take: Math.min(100, limit) });
    return records.map((record) => ({ ...record, topic: record.topic ?? undefined, eventId: record.eventId ?? undefined, providerMessageId: record.providerMessageId ?? undefined, providerErrorCode: record.providerErrorCode ?? undefined, retryAfterMs: record.retryAfterMs ?? undefined, requestedBy: record.requestedBy ?? undefined, requestedAt: record.requestedAt.toISOString(), completedAt: record.completedAt?.toISOString() }));
  }
}
