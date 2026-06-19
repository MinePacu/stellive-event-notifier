import { getPrismaClient } from "../storage/prisma.js";
import type { HubEvent, HubEventImage, HubEventsSummary, HubEventStatus } from "../types.js";
import type { AdminHubEvent, HubEventAdminAction, HubEventPublicationState } from "./hubEventAdminTypes.js";
import type { HubEventFilters, HubEventListResult } from "./hubEventService.js";

interface HubEventRecord {
  id: string;
  category: string;
  participationMode: string;
  status: string;
  title: string;
  summary: string | null;
  memberId: string | null;
  generationId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceType: string;
  announcedAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  purchaseUrl: string | null;
  ticketUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  image?: unknown | null;
  notificationEligible: boolean;
  publicationState: string;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  deactivatedAt: Date | null;
  deletedAt: Date | null;
  revision: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface HubEventAuditLogRecord {
  id: string;
  hubEventId: string;
  action: string;
  actorId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

interface HubEventDelegate {
  hubEvent?: {
    findMany?(args: unknown): Promise<HubEventRecord[]>;
    findFirst?(args: unknown): Promise<HubEventRecord | null>;
    create?(args: { data: Record<string, unknown> }): Promise<HubEventRecord>;
    update?(args: { where: { id: string }; data: Record<string, unknown> }): Promise<HubEventRecord>;
  };
  hubEventAuditLog?: {
    create?(args: { data: Record<string, unknown> }): Promise<unknown>;
    findMany?(args: unknown): Promise<HubEventAuditLogRecord[]>;
  };
}

export interface AdminHubEventFilters extends HubEventFilters {
  publicationState?: HubEventPublicationState;
  includeDeleted?: boolean;
  query?: string;
}

export interface AdminHubEventListResult {
  items: AdminHubEvent[];
  nextCursor?: string;
}

type NullableDateInput = string | Date | null | undefined;

export type AdminHubEventWriteInput = Omit<Partial<HubEvent>, "announcedAt" | "startsAt" | "endsAt"> & {
  announcedAt?: NullableDateInput;
  startsAt?: NullableDateInput;
  endsAt?: NullableDateInput;
  actorId?: string;
};

export interface SetHubEventPublicationStateInput {
  id: string;
  publicationState: HubEventPublicationState;
  actorId?: string;
  publishedAt?: Date;
  cancelledAt?: Date;
  deactivatedAt?: Date;
}

export interface SoftDeleteHubEventInput {
  id: string;
  actorId?: string;
  deletedAt: Date;
}

export interface HubEventAuditLogInput {
  hubEventId: string;
  action: HubEventAdminAction;
  actorId?: string;
  reason?: string;
  before: unknown;
  after: unknown;
}

export interface HubEventAuditLogEntry {
  id: string;
  hubEventId: string;
  action: string;
  actorId?: string;
  reason?: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeHubEventImage(value: unknown): HubEventImage | undefined {
  if (!isRecord(value)) return undefined;
  const policyState = stringValue(value.policyState);
  if (
    policyState !== "none" &&
    policyState !== "official_runtime_url" &&
    policyState !== "third_party_allowed" &&
    policyState !== "verify_required" &&
    policyState !== "blocked"
  ) {
    return undefined;
  }

  return stripUndefined({
    policyState,
    url: stringValue(value.url),
    sourceLabel: stringValue(value.sourceLabel),
    sourceUrl: stringValue(value.sourceUrl),
    altText: stringValue(value.altText)
  }) as unknown as HubEventImage;
}

function toPublicHubEvent(record: HubEventRecord): HubEvent {
  return stripUndefined({
    id: record.id,
    category: record.category,
    participationMode: record.participationMode,
    status: record.status,
    title: record.title,
    summary: record.summary ?? undefined,
    memberId: record.memberId ?? undefined,
    generationId: record.generationId,
    sourceUrl: record.sourceUrl,
    sourceLabel: record.sourceLabel,
    sourceType: record.sourceType,
    announcedAt: toIso(record.announcedAt),
    startsAt: toIso(record.startsAt),
    endsAt: toIso(record.endsAt),
    purchaseUrl: record.purchaseUrl ?? undefined,
    ticketUrl: record.ticketUrl ?? undefined,
    venueName: record.venueName ?? undefined,
    venueAddress: record.venueAddress ?? undefined,
    image: normalizeHubEventImage(record.image),
    notificationEligible: record.notificationEligible,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }) as unknown as HubEvent;
}

function toAdminHubEvent(record: HubEventRecord): AdminHubEvent {
  return stripUndefined({
    ...toPublicHubEvent(record),
    publicationState: record.publicationState,
    publishedAt: toIso(record.publishedAt),
    cancelledAt: toIso(record.cancelledAt),
    deactivatedAt: toIso(record.deactivatedAt),
    deletedAt: toIso(record.deletedAt),
    revision: record.revision,
    createdBy: record.createdBy ?? undefined,
    updatedBy: record.updatedBy ?? undefined
  }) as unknown as AdminHubEvent;
}

function toDate(value: NullableDateInput): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function toWriteData(input: AdminHubEventWriteInput): Record<string, unknown> {
  return stripUndefined({
    category: input.category,
    participationMode: input.participationMode,
    status: input.status,
    title: input.title,
    summary: input.summary,
    memberId: input.memberId,
    generationId: input.generationId,
    sourceUrl: input.sourceUrl,
    sourceLabel: input.sourceLabel,
    sourceType: input.sourceType,
    announcedAt: toDate(input.announcedAt),
    startsAt: toDate(input.startsAt),
    endsAt: toDate(input.endsAt),
    purchaseUrl: input.purchaseUrl,
    ticketUrl: input.ticketUrl,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    image: input.image,
    notificationEligible: input.notificationEligible
  });
}

function addHubEventFilters(where: Record<string, unknown>, filters: HubEventFilters) {
  if (filters.category) where.category = filters.category;
  if (filters.participationMode) where.participationMode = filters.participationMode;
  if (filters.generationId) where.generationId = filters.generationId;
  if (filters.memberId) where.memberId = filters.memberId;
  if (filters.status) where.status = filters.status;
}

function requireMethod<T>(method: T | undefined, name: string): T {
  if (!method) throw new Error(`${name}_unavailable`);
  return method;
}

const closingSoonWindowMs = 24 * 60 * 60 * 1000;

function asDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function effectiveStatus(event: HubEvent, now: Date): HubEventStatus {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "ended") return "ended";

  const nowTime = now.getTime();
  const startsAt = asDate(event.startsAt);
  const endsAt = asDate(event.endsAt);

  if (event.status === "closing_soon") {
    if (endsAt && nowTime >= endsAt.getTime()) return "ended";
    return "closing_soon";
  }

  if (endsAt && nowTime >= endsAt.getTime()) return "ended";
  if (startsAt && nowTime < startsAt.getTime()) return "upcoming";
  if (endsAt && endsAt.getTime() - nowTime <= closingSoonWindowMs) return "closing_soon";
  if (startsAt || endsAt) return "open";
  return "announced";
}

export class HubEventRepository {
  constructor(private readonly prisma: HubEventDelegate = getPrismaClient() as unknown as HubEventDelegate) {}

  async list(filters: HubEventFilters = {}, now: Date = new Date()): Promise<HubEventListResult> {
    void now;
    return this.listPublished(filters);
  }

  async getById(id: string): Promise<HubEvent | undefined> {
    return this.getPublishedById(id);
  }

  async summary(now: Date = new Date()): Promise<HubEventsSummary> {
    const { items } = await this.listPublished({ limit: 100 });
    const statuses = items.map((event) => effectiveStatus(event, now));
    const openCount = statuses.filter((status) => status === "open").length;
    const closingSoonCount = statuses.filter((status) => status === "closing_soon").length;
    const upcomingCount = statuses.filter((status) => status === "upcoming").length;

    return { openCount, closingSoonCount, upcomingCount, preview: items.slice(0, 3) };
  }

  async listPublished(filters: HubEventFilters = {}): Promise<HubEventListResult> {
    const findMany = requireMethod(this.prisma.hubEvent?.findMany?.bind(this.prisma.hubEvent), "hub_event_find_many");
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const where: Record<string, unknown> = {
      publicationState: "published",
      deletedAt: null
    };
    addHubEventFilters(where, filters);

    const records = await findMany({
      where,
      orderBy: [{ endsAt: "asc" }, { startsAt: "asc" }, { updatedAt: "desc" }],
      take: limit,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : undefined
    });
    const items = records.map(toPublicHubEvent);
    return { items };
  }

  async getPublishedById(id: string): Promise<HubEvent | undefined> {
    const findFirst = requireMethod(this.prisma.hubEvent?.findFirst?.bind(this.prisma.hubEvent), "hub_event_find_first");
    const record = await findFirst({
      where: {
        id,
        publicationState: "published",
        deletedAt: null
      }
    });
    return record ? toPublicHubEvent(record) : undefined;
  }

  async listAdmin(filters: AdminHubEventFilters = {}): Promise<AdminHubEventListResult> {
    const findMany = requireMethod(this.prisma.hubEvent?.findMany?.bind(this.prisma.hubEvent), "hub_event_find_many");
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const where: Record<string, unknown> = {};
    addHubEventFilters(where, filters);
    if (filters.publicationState) where.publicationState = filters.publicationState;
    if (!filters.includeDeleted) where.deletedAt = null;
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: "insensitive" } },
        { sourceLabel: { contains: filters.query, mode: "insensitive" } }
      ];
    }

    const records = await findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limit,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : undefined
    });
    return { items: records.map(toAdminHubEvent) };
  }

  async getAdminById(id: string): Promise<AdminHubEvent | undefined> {
    const findFirst = requireMethod(this.prisma.hubEvent?.findFirst?.bind(this.prisma.hubEvent), "hub_event_find_first");
    const record = await findFirst({ where: { id } });
    return record ? toAdminHubEvent(record) : undefined;
  }

  async createDraft(input: AdminHubEventWriteInput): Promise<AdminHubEvent> {
    const create = requireMethod(this.prisma.hubEvent?.create?.bind(this.prisma.hubEvent), "hub_event_create");
    const record = await create({
      data: {
        ...toWriteData(input),
        publicationState: "draft",
        revision: 1,
        createdBy: input.actorId,
        updatedBy: input.actorId
      }
    });
    return toAdminHubEvent(record);
  }

  async update(id: string, input: AdminHubEventWriteInput): Promise<AdminHubEvent> {
    const update = requireMethod(this.prisma.hubEvent?.update?.bind(this.prisma.hubEvent), "hub_event_update");
    const record = await update({
      where: { id },
      data: {
        ...toWriteData(input),
        updatedBy: input.actorId,
        revision: { increment: 1 }
      }
    });
    return toAdminHubEvent(record);
  }

  async setPublicationState(input: SetHubEventPublicationStateInput): Promise<AdminHubEvent> {
    const update = requireMethod(this.prisma.hubEvent?.update?.bind(this.prisma.hubEvent), "hub_event_update");
    const record = await update({
      where: { id: input.id },
      data: stripUndefined({
        publicationState: input.publicationState,
        publishedAt: input.publishedAt,
        cancelledAt: input.cancelledAt,
        deactivatedAt: input.deactivatedAt,
        updatedBy: input.actorId,
        revision: { increment: 1 }
      })
    });
    return toAdminHubEvent(record);
  }

  async softDelete(input: SoftDeleteHubEventInput): Promise<AdminHubEvent> {
    const update = requireMethod(this.prisma.hubEvent?.update?.bind(this.prisma.hubEvent), "hub_event_update");
    const record = await update({
      where: { id: input.id },
      data: {
        publicationState: "deleted",
        deletedAt: input.deletedAt,
        updatedBy: input.actorId,
        revision: { increment: 1 }
      }
    });
    return toAdminHubEvent(record);
  }

  async writeAuditLog(input: HubEventAuditLogInput): Promise<void> {
    const create = requireMethod(this.prisma.hubEventAuditLog?.create?.bind(this.prisma.hubEventAuditLog), "hub_event_audit_log_create");
    await create({
      data: {
        hubEventId: input.hubEventId,
        action: input.action,
        actorId: input.actorId,
        reason: input.reason,
        before: input.before,
        after: input.after
      }
    });
  }

  async listAuditLog(hubEventId: string, limit = 25): Promise<HubEventAuditLogEntry[]> {
    const findMany = requireMethod(this.prisma.hubEventAuditLog?.findMany?.bind(this.prisma.hubEventAuditLog), "hub_event_audit_log_find_many");
    const records = await findMany({
      where: { hubEventId },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit))
    });
    return records.map((record) => ({
      id: record.id,
      hubEventId: record.hubEventId,
      action: record.action,
      actorId: record.actorId ?? undefined,
      reason: record.reason ?? undefined,
      before: record.before,
      after: record.after,
      createdAt: record.createdAt.toISOString()
    }));
  }
}
