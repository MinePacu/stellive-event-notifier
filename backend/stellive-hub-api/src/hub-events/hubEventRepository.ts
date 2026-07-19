import { getPrismaClient } from "../storage/prisma.js";
import type {
  HubEvent,
  HubEventImage,
  HubEventLink,
  HubEventScheduleItem,
  HubEventsSummary,
  HubEventStatus,
  PlatformEvent
} from "../types.js";
import type { AdminHubEvent, HubEventAdminAction, HubEventPublicationState } from "./hubEventAdminTypes.js";
import type { HubEventFilters, HubEventListResult } from "./hubEventService.js";
import { koreaDateKey, resolveEffectiveHubEventStatus, withEffectiveHubEventStatus } from "./hubEventStatus.js";
import { deriveHubEventScheduleMode, normalizeHubEventScheduleText } from "./hubEventSchedulePolicy.js";
import {
  firstEventLegacyProjection,
  firstScheduleLegacyProjection,
  normalizeHubEventLinks,
  resolvedEventLinks,
  resolvedScheduleLinks,
  type HubEventLinkInput
} from "./hubEventLinkPolicy.js";

interface HubEventRecord {
  id: string;
  category: string;
  participationMode: string;
  status: string;
  scheduleMode?: string;
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
  scheduleItems?: HubEventScheduleItemRecord[];
  links?: HubEventExternalLinkRecord[];
}

interface HubEventScheduleItemRecord {
  id: string;
  hubEventId: string;
  kind: string;
  title?: string | null;
  label: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  timePrecision: string;
  timezone: string;
  actionUrl: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  notificationEligible: boolean;
  isPrimary: boolean;
  sortOrder: number;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  links?: HubEventExternalLinkRecord[];
}

interface HubEventExternalLinkRecord {
  id: string;
  hubEventId: string | null;
  scheduleItemId: string | null;
  kind: string;
  label: string | null;
  url: string;
  sortOrder: number;
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
  $transaction?<T>(callback: (transaction: HubEventDelegate) => Promise<T>): Promise<T>;
  hubEvent?: {
    findMany?(args: unknown): Promise<HubEventRecord[]>;
    findFirst?(args: unknown): Promise<HubEventRecord | null>;
    create?(args: { data: Record<string, unknown>; include?: Record<string, unknown> }): Promise<HubEventRecord>;
    update?(args: { where: { id: string }; data: Record<string, unknown>; include?: Record<string, unknown> }): Promise<HubEventRecord>;
    updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  hubEventScheduleItem?: {
    findMany?(args: unknown): Promise<HubEventScheduleItemRecord[]>;
    findFirst?(args: unknown): Promise<HubEventScheduleItemRecord | null>;
    create?(args: { data: Record<string, unknown> }): Promise<HubEventScheduleItemRecord>;
    update?(args: { where: { id: string }; data: Record<string, unknown> }): Promise<HubEventScheduleItemRecord>;
    updateMany?(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
    delete?(args: { where: { id: string } }): Promise<HubEventScheduleItemRecord>;
  };
  hubEventExternalLink?: {
    findMany?(args: unknown): Promise<HubEventExternalLinkRecord[]>;
    create?(args: { data: Record<string, unknown> }): Promise<HubEventExternalLinkRecord>;
    update?(args: { where: { id: string }; data: Record<string, unknown> }): Promise<HubEventExternalLinkRecord>;
    deleteMany?(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
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

export type AdminHubEventLinkWriteInput = HubEventLinkInput;

export type AdminHubEventScheduleItemWriteInput = Omit<
  Partial<HubEventScheduleItem>,
  "id" | "description" | "startsAt" | "endsAt" | "cancelledAt" | "createdAt" | "updatedAt" | "links"
> & {
  id?: string;
  description?: string | null;
  startsAt?: NullableDateInput;
  endsAt?: NullableDateInput;
  cancelledAt?: NullableDateInput;
  links?: AdminHubEventLinkWriteInput[];
};

export type AdminHubEventWriteInput = Omit<
  Partial<HubEvent>,
  "announcedAt" | "startsAt" | "endsAt" | "scheduleItems" | "links"
> & {
  announcedAt?: NullableDateInput;
  startsAt?: NullableDateInput;
  endsAt?: NullableDateInput;
  scheduleItems?: AdminHubEventScheduleItemWriteInput[];
  links?: AdminHubEventLinkWriteInput[];
  actorId?: string;
  expectedRevision?: number;
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

export interface HubEventStatusReconcileResult {
  status: "ok";
  checkedAt: string;
  opened: number;
  ended: number;
  startOnlyEnded: number;
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

function toScheduleItem(record: HubEventScheduleItemRecord): HubEventScheduleItem {
  const text = normalizeHubEventScheduleText(record);
  const item = stripUndefined({
    id: record.id,
    kind: record.kind,
    title: text.title,
    label: text.label,
    description: text.description ?? undefined,
    startsAt: record.startsAt.toISOString(),
    endsAt: toIso(record.endsAt),
    timePrecision: record.timePrecision,
    timezone: record.timezone,
    actionUrl: record.actionUrl ?? undefined,
    sourceUrl: record.sourceUrl ?? undefined,
    sourceLabel: record.sourceLabel ?? undefined,
    links: (record.links ?? []).map(toLink),
    notificationEligible: record.notificationEligible,
    isPrimary: record.isPrimary,
    sortOrder: record.sortOrder,
    cancelledAt: toIso(record.cancelledAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }) as unknown as HubEventScheduleItem;
  return { ...item, links: resolvedScheduleLinks(item) };
}

function toLink(record: HubEventExternalLinkRecord): HubEventLink {
  return stripUndefined({
    id: record.id,
    kind: record.kind,
    label: record.label ?? undefined,
    url: record.url,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }) as unknown as HubEventLink;
}

function toPublicHubEvent(record: HubEventRecord): HubEvent {
  const event = stripUndefined({
    id: record.id,
    category: record.category,
    participationMode: record.participationMode,
    status: record.status,
    scheduleMode: record.scheduleMode ?? "single_window",
    scheduleItems: (record.scheduleItems ?? []).map(toScheduleItem),
    links: (record.links ?? []).map(toLink),
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
  return { ...event, links: resolvedEventLinks(event) };
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

function dateOnlyInTimezone(value: string, timezone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offsetAt = (timestamp: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    return Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    ) - timestamp;
  };
  let result = utcGuess - offsetAt(utcGuess);
  result = utcGuess - offsetAt(result);
  return new Date(result);
}

function toScheduleDate(
  value: NullableDateInput,
  precision: AdminHubEventScheduleItemWriteInput["timePrecision"],
  timezone: string
): Date | null | undefined {
  if (precision === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dateOnlyInTimezone(value, timezone);
  }
  return toDate(value);
}

function toWriteData(input: AdminHubEventWriteInput): Record<string, unknown> {
  const activeSchedules = input.scheduleItems?.filter((item) => !item.cancelledAt) ?? [];
  const projectedSchedule = activeSchedules.find((item) => item.isPrimary);
  const hasScheduleWrite = input.scheduleItems !== undefined;
  const projectedTimezone = projectedSchedule?.timezone ?? "Asia/Seoul";
  const legacyLinks = firstEventLegacyProjection(input.links);
  return stripUndefined({
    category: input.category,
    participationMode: input.participationMode,
    status: input.status,
    scheduleMode: hasScheduleWrite ? deriveHubEventScheduleMode(input.scheduleItems ?? []) : input.scheduleMode,
    title: input.title,
    summary: input.summary,
    memberId: input.memberId,
    generationId: input.generationId,
    sourceUrl: input.sourceUrl,
    sourceLabel: input.sourceLabel,
    sourceType: input.sourceType,
    announcedAt: toDate(input.announcedAt),
    startsAt: hasScheduleWrite
      ? toScheduleDate(projectedSchedule?.startsAt ?? null, projectedSchedule?.timePrecision, projectedTimezone)
      : toDate(input.startsAt),
    endsAt: hasScheduleWrite
      ? toScheduleDate(projectedSchedule?.endsAt ?? null, projectedSchedule?.timePrecision, projectedTimezone)
      : toDate(input.endsAt),
    purchaseUrl: legacyLinks.purchaseUrl ?? input.purchaseUrl,
    ticketUrl: legacyLinks.ticketUrl ?? input.ticketUrl,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    image: input.image,
    notificationEligible: input.notificationEligible
  });
}

function toScheduleWriteData(
  item: AdminHubEventScheduleItemWriteInput,
  hubEventId: string
): Record<string, unknown> {
  const timezone = item.timezone ?? "Asia/Seoul";
  const text = normalizeHubEventScheduleText(item);
  const legacyLinks = firstScheduleLegacyProjection(item.links);
  return stripUndefined({
    id: item.id,
    hubEventId,
    kind: item.kind,
    title: text.title,
    label: text.label,
    description: text.description,
    startsAt: toScheduleDate(item.startsAt, item.timePrecision, timezone),
    endsAt: toScheduleDate(item.endsAt, item.timePrecision, timezone),
    timePrecision: item.timePrecision,
    timezone,
    actionUrl: legacyLinks.actionUrl ?? item.actionUrl,
    sourceUrl: legacyLinks.sourceUrl ?? item.sourceUrl,
    sourceLabel: legacyLinks.sourceLabel ?? item.sourceLabel,
    notificationEligible: item.notificationEligible ?? true,
    isPrimary: item.isPrimary ?? false,
    sortOrder: item.sortOrder ?? 0,
    cancelledAt: toDate(item.cancelledAt)
  });
}

function toLinkWriteData(link: AdminHubEventLinkWriteInput): Record<string, unknown> {
  return stripUndefined({
    kind: link.kind,
    label: link.label?.trim() || null,
    url: link.url?.trim(),
    sortOrder: link.sortOrder ?? 0
  });
}

function nestedLinksCreate(links: AdminHubEventLinkWriteInput[] | undefined): Record<string, unknown> | undefined {
  const normalized = normalizeHubEventLinks(links);
  return normalized?.length ? { create: normalized.map(toLinkWriteData) } : undefined;
}

const linksInclude = { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] };
const scheduleItemsInclude = {
  links: linksInclude,
  scheduleItems: {
    include: { links: linksInclude },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }, { id: "asc" }]
  }
};

function addHubEventFilters(where: Record<string, unknown>, filters: HubEventFilters, options: { includeStatus?: boolean } = {}) {
  if (filters.category) where.category = filters.category;
  if (filters.participationMode) where.participationMode = filters.participationMode;
  if (filters.generationId) where.generationId = filters.generationId;
  if (filters.memberId) where.memberId = filters.memberId;
  if (options.includeStatus !== false && filters.status) where.status = filters.status;
}

function requireMethod<T>(method: T | undefined, name: string): T {
  if (!method) throw new Error(`${name}_unavailable`);
  return method;
}

function asDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function effectiveStatus(event: HubEvent, now: Date): HubEventStatus {
  return resolveEffectiveHubEventStatus(event, now);
}

function startOnlyEndCutoff(now: Date): Date {
  return new Date(`${koreaDateKey(now)}T00:00:00+09:00`);
}

export class HubEventRepository {
  constructor(private readonly prisma: HubEventDelegate = getPrismaClient() as unknown as HubEventDelegate) {}

  async list(filters: HubEventFilters = {}, now: Date = new Date()): Promise<HubEventListResult> {
    return this.listPublished(filters, now);
  }

  async getById(id: string): Promise<HubEvent | undefined> {
    return this.getPublishedById(id);
  }

  async isScheduleNotificationCurrent(event: PlatformEvent, now: Date = new Date()): Promise<boolean> {
    if (event.source !== "hub_event" || !isRecord(event.rawPayload)) return true;
    const hubEventId = stringValue(event.rawPayload.hubEventId);
    const scheduleItemId = stringValue(event.rawPayload.scheduleItemId);
    const scheduledAt = stringValue(event.rawPayload.scheduledAt);
    const revision = typeof event.rawPayload.revision === "number" ? event.rawPayload.revision : undefined;
    if (!hubEventId || !scheduleItemId || !scheduledAt) return true;

    const parent = await this.getAdminById(hubEventId);
    if (
      !parent ||
      parent.publicationState !== "published" ||
      parent.deletedAt ||
      parent.cancelledAt ||
      !parent.notificationEligible ||
      (revision !== undefined && parent.revision !== revision)
    ) {
      return false;
    }
    const scheduleItem = parent.scheduleItems?.find((item) => item.id === scheduleItemId);
    if (!scheduleItem || scheduleItem.cancelledAt || !scheduleItem.notificationEligible) return false;
    const currentScheduledAt = asDate(scheduleItem.startsAt);
    const expectedScheduledAt = asDate(scheduledAt);
    return Boolean(
      currentScheduledAt &&
      expectedScheduledAt &&
      currentScheduledAt.getTime() === expectedScheduledAt.getTime() &&
      expectedScheduledAt.getTime() <= now.getTime()
    );
  }

  async summary(now: Date = new Date()): Promise<HubEventsSummary> {
    const { items } = await this.listPublished({ limit: 100 }, now);
    const statuses = items.map((event) => effectiveStatus(event, now));
    const openCount = statuses.filter((status) => status === "open").length;
    const closingSoonCount = statuses.filter((status) => status === "closing_soon").length;
    const upcomingCount = statuses.filter((status) => status === "upcoming").length;

    return { openCount, closingSoonCount, upcomingCount, preview: items.slice(0, 3) };
  }

  async reconcileDueStatuses(now: Date = new Date()): Promise<HubEventStatusReconcileResult> {
    const findManyRecords = this.prisma.hubEvent?.findMany?.bind(this.prisma.hubEvent);
    const updateRecord = this.prisma.hubEvent?.update?.bind(this.prisma.hubEvent);
    if (findManyRecords && updateRecord) {
      const records = await findManyRecords({
        where: { publicationState: "published", deletedAt: null },
        include: scheduleItemsInclude
      });
      let opened = 0;
      let ended = 0;
      let startOnlyEnded = 0;
      for (const record of records) {
        const event = toPublicHubEvent(record);
        const status = resolveEffectiveHubEventStatus(event, now);
        if (status === record.status) continue;
        await updateRecord({ where: { id: record.id }, data: { status } });
        if (status === "open" || status === "closing_soon") opened += 1;
        if (status === "ended") {
          ended += 1;
          if ((event.scheduleItems ?? []).length === 0 && event.startsAt && !event.endsAt) startOnlyEnded += 1;
        }
      }
      return { status: "ok", checkedAt: now.toISOString(), opened, ended, startOnlyEnded };
    }

    const updateMany = requireMethod(this.prisma.hubEvent?.updateMany?.bind(this.prisma.hubEvent), "hub_event_update_many");
    const baseWhere = {
      publicationState: "published",
      deletedAt: null,
      cancelledAt: null
    };

    const opened = await updateMany({
      where: {
        ...baseWhere,
        status: "upcoming",
        startsAt: { lte: now }
      },
      data: { status: "open" }
    });
    const ended = await updateMany({
      where: {
        ...baseWhere,
        status: { in: ["open", "closing_soon"] },
        endsAt: { lte: now }
      },
      data: { status: "ended" }
    });
    const startOnlyEnded = await updateMany({
      where: {
        ...baseWhere,
        status: { in: ["open", "closing_soon"] },
        startsAt: { lt: startOnlyEndCutoff(now) },
        endsAt: null
      },
      data: { status: "ended" }
    });

    return {
      status: "ok",
      checkedAt: now.toISOString(),
      opened: opened.count,
      ended: ended.count,
      startOnlyEnded: startOnlyEnded.count
    };
  }

  async listPublished(filters: HubEventFilters = {}, now: Date = new Date()): Promise<HubEventListResult> {
    const findMany = requireMethod(this.prisma.hubEvent?.findMany?.bind(this.prisma.hubEvent), "hub_event_find_many");
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const queryLimit = filters.status ? 100 : limit;
    const where: Record<string, unknown> = {
      publicationState: "published",
      deletedAt: null
    };
    addHubEventFilters(where, filters, { includeStatus: false });

    const records = await findMany({
      where,
      include: scheduleItemsInclude,
      orderBy: [{ endsAt: "asc" }, { startsAt: "asc" }, { updatedAt: "desc" }],
      take: queryLimit,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : undefined
    });
    const items = records
      .map(toPublicHubEvent)
      .map((event) => withEffectiveHubEventStatus(event, now))
      .filter((event) => !filters.status || event.status === filters.status)
      .slice(0, limit);
    return { items };
  }

  async getPublishedById(id: string): Promise<HubEvent | undefined> {
    const findFirst = requireMethod(this.prisma.hubEvent?.findFirst?.bind(this.prisma.hubEvent), "hub_event_find_first");
    const record = await findFirst({
      where: {
        id,
        publicationState: "published",
        deletedAt: null
      },
      include: scheduleItemsInclude
    });
    return record ? withEffectiveHubEventStatus(toPublicHubEvent(record)) : undefined;
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
      include: scheduleItemsInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limit + 1,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : undefined
    });
    const pageRecords = records.slice(0, limit);
    const nextRecord = records.length > limit ? records[limit] : undefined;
    return {
      items: pageRecords.map(toAdminHubEvent),
      nextCursor: nextRecord?.id
    };
  }

  async getAdminById(id: string): Promise<AdminHubEvent | undefined> {
    const findFirst = requireMethod(this.prisma.hubEvent?.findFirst?.bind(this.prisma.hubEvent), "hub_event_find_first");
    const record = await findFirst({ where: { id }, include: scheduleItemsInclude });
    return record ? toAdminHubEvent(record) : undefined;
  }

  async createDraft(input: AdminHubEventWriteInput): Promise<AdminHubEvent> {
    const create = requireMethod(this.prisma.hubEvent?.create?.bind(this.prisma.hubEvent), "hub_event_create");
    const record = await create({
      data: {
        ...toWriteData(input),
        links: nestedLinksCreate(input.links),
        scheduleItems: input.scheduleItems?.length
          ? { create: input.scheduleItems.map((item) => {
              const data = toScheduleWriteData(item, "");
              delete data.hubEventId;
              data.links = nestedLinksCreate(item.links);
              return data;
            }) }
          : undefined,
        publicationState: "draft",
        revision: 1,
        createdBy: input.actorId,
        updatedBy: input.actorId
      },
      include: scheduleItemsInclude
    });
    return toAdminHubEvent(record);
  }

  async update(id: string, input: AdminHubEventWriteInput): Promise<AdminHubEvent> {
    const run = async (client: HubEventDelegate): Promise<AdminHubEvent> => {
      const updateData = {
        ...toWriteData(input),
        updatedBy: input.actorId,
        revision: { increment: 1 }
      };
      let record: HubEventRecord;
      if (input.expectedRevision !== undefined) {
        const updateMany = requireMethod(client.hubEvent?.updateMany?.bind(client.hubEvent), "hub_event_update_many");
        const result = await updateMany({ where: { id, revision: input.expectedRevision }, data: updateData });
        if (result.count !== 1) throw new Error("hub_event_revision_conflict");
        const findFirst = requireMethod(client.hubEvent?.findFirst?.bind(client.hubEvent), "hub_event_find_first");
        const found = await findFirst({ where: { id }, include: scheduleItemsInclude });
        if (!found) throw new Error("hub_event_not_found");
        record = found;
      } else {
        const update = requireMethod(client.hubEvent?.update?.bind(client.hubEvent), "hub_event_update");
        record = await update({ where: { id }, data: updateData, include: scheduleItemsInclude });
      }

      if (input.links !== undefined) {
        await this.syncOwnedLinks(client, { hubEventId: id, scheduleItemId: null }, input.links);
      }

      if (input.scheduleItems === undefined || !client.hubEventScheduleItem) {
        if (input.links === undefined) return toAdminHubEvent(record);
        const findFirst = requireMethod(client.hubEvent?.findFirst?.bind(client.hubEvent), "hub_event_find_first");
        const refreshed = await findFirst({ where: { id }, include: scheduleItemsInclude });
        return toAdminHubEvent(refreshed ?? record);
      }

      const findMany = requireMethod(
        client.hubEventScheduleItem.findMany?.bind(client.hubEventScheduleItem),
        "hub_event_schedule_item_find_many"
      );
      const create = requireMethod(
        client.hubEventScheduleItem.create?.bind(client.hubEventScheduleItem),
        "hub_event_schedule_item_create"
      );
      const updateSchedule = requireMethod(
        client.hubEventScheduleItem.update?.bind(client.hubEventScheduleItem),
        "hub_event_schedule_item_update"
      );
      const updateMany = requireMethod(
        client.hubEventScheduleItem.updateMany?.bind(client.hubEventScheduleItem),
        "hub_event_schedule_item_update_many"
      );
      const existing = await findMany({ where: { hubEventId: id }, select: { id: true } });
      const existingIds = new Set(existing.map((item) => item.id));
      const retainedIds = new Set<string>();

      await updateMany({
        where: { hubEventId: id, isPrimary: true, cancelledAt: null },
        data: { isPrimary: false }
      });

      for (const item of input.scheduleItems) {
        const data = toScheduleWriteData(item, id);
        let scheduleItemId: string;
        if (item.id && existingIds.has(item.id)) {
          retainedIds.add(item.id);
          scheduleItemId = item.id;
          delete data.id;
          delete data.hubEventId;
          await updateSchedule({ where: { id: item.id }, data });
        } else {
          const created = await create({ data });
          retainedIds.add(created.id);
          scheduleItemId = created.id;
        }
        if (item.links !== undefined) {
          await this.syncOwnedLinks(client, { hubEventId: null, scheduleItemId }, item.links);
        }
      }

      const removedIds = [...existingIds].filter((scheduleItemId) => !retainedIds.has(scheduleItemId));
      if (removedIds.length > 0) {
        await updateMany({
          where: { id: { in: removedIds }, hubEventId: id, cancelledAt: null },
          data: { cancelledAt: new Date() }
        });
      }

      const findFirst = requireMethod(client.hubEvent?.findFirst?.bind(client.hubEvent), "hub_event_find_first");
      const refreshed = await findFirst({ where: { id }, include: scheduleItemsInclude });
      return toAdminHubEvent(refreshed ?? record);
    };

    return this.prisma.$transaction ? this.prisma.$transaction(run) : run(this.prisma);
  }

  private async syncOwnedLinks(
    client: HubEventDelegate,
    owner: { hubEventId: string | null; scheduleItemId: string | null },
    links: AdminHubEventLinkWriteInput[]
  ): Promise<void> {
    const delegate = client.hubEventExternalLink;
    const findMany = requireMethod(delegate?.findMany?.bind(delegate), "hub_event_external_link_find_many");
    const create = requireMethod(delegate?.create?.bind(delegate), "hub_event_external_link_create");
    const update = requireMethod(delegate?.update?.bind(delegate), "hub_event_external_link_update");
    const deleteMany = requireMethod(delegate?.deleteMany?.bind(delegate), "hub_event_external_link_delete_many");
    const existing = await findMany({ where: owner });
    const existingIds = new Set(existing.map((link) => link.id));
    const retainedIds = new Set<string>();
    const normalized = normalizeHubEventLinks(links) ?? [];

    for (const link of normalized) {
      const data = toLinkWriteData(link);
      if (link.id) {
        if (!existingIds.has(link.id)) throw new Error("hub_event_link_not_found");
        retainedIds.add(link.id);
        await update({ where: { id: link.id }, data });
      } else {
        const created = await create({ data: { ...data, ...owner } });
        retainedIds.add(created.id);
      }
    }

    const removedIds = [...existingIds].filter((linkId) => !retainedIds.has(linkId));
    if (removedIds.length > 0) {
      await deleteMany({ where: { id: { in: removedIds }, ...owner } });
    }
  }

  async hardDeleteScheduleItem(
    id: string,
    scheduleItemId: string,
    input: AdminHubEventWriteInput
  ): Promise<AdminHubEvent> {
    const run = async (client: HubEventDelegate): Promise<AdminHubEvent> => {
      const findSchedule = requireMethod(
        client.hubEventScheduleItem?.findFirst?.bind(client.hubEventScheduleItem),
        "hub_event_schedule_item_find_first"
      );
      const owned = await findSchedule({ where: { id: scheduleItemId, hubEventId: id } });
      if (!owned) throw new Error("hub_event_schedule_item_not_found");

      const updateMany = requireMethod(client.hubEvent?.updateMany?.bind(client.hubEvent), "hub_event_update_many");
      const result = await updateMany({
        where: { id, revision: input.expectedRevision },
        data: { ...toWriteData(input), updatedBy: input.actorId, revision: { increment: 1 } }
      });
      if (result.count !== 1) throw new Error("hub_event_revision_conflict");

      const deleteSchedule = requireMethod(
        client.hubEventScheduleItem?.delete?.bind(client.hubEventScheduleItem),
        "hub_event_schedule_item_delete"
      );
      await deleteSchedule({ where: { id: scheduleItemId } });
      const findFirst = requireMethod(client.hubEvent?.findFirst?.bind(client.hubEvent), "hub_event_find_first");
      const refreshed = await findFirst({ where: { id }, include: scheduleItemsInclude });
      if (!refreshed) throw new Error("hub_event_not_found");
      return toAdminHubEvent(refreshed);
    };
    return this.prisma.$transaction ? this.prisma.$transaction(run) : run(this.prisma);
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
      }),
      include: scheduleItemsInclude
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
      },
      include: scheduleItemsInclude
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
