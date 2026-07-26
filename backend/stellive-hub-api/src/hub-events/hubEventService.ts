import type { CatalogService } from "../catalog/catalog.js";
import { validateHubEvent } from "./hubEventPolicy.js";
import { resolveEffectiveHubEventStatus, withEffectiveHubEventStatus } from "./hubEventStatus.js";
import type {
  HubEvent,
  HubEventCategory,
  HubEventTag,
  HubEventParticipationMode,
  HubEventStatus,
  HubEventsSummary,
  PlatformEvent
} from "../types.js";

export type HubEventFilters = {
  category?: HubEventCategory;
  tag?: HubEventTag;
  participationMode?: HubEventParticipationMode;
  status?: HubEventStatus;
  generationId?: string;
  memberId?: string;
  from?: string | Date;
  to?: string | Date;
  cursor?: string;
  limit?: number;
};

export type HubEventListResult = {
  items: HubEvent[];
  nextCursor?: string;
};

export interface HubEventReadPort {
  list(filters?: HubEventFilters, now?: Date): Promise<HubEventListResult> | HubEventListResult;
  getById(id: string): Promise<HubEvent | undefined> | HubEvent | undefined;
  summary(now?: Date): Promise<HubEventsSummary> | HubEventsSummary;
}

const statusRank: Record<HubEventStatus, number> = {
  closing_soon: 0,
  open: 1,
  upcoming: 2,
  announced: 3,
  cancelled: 4,
  ended: 5
};

function asDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function compareDates(left?: string, right?: string): number {
  const leftTime = asDate(left)?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightTime = asDate(right)?.getTime() ?? Number.POSITIVE_INFINITY;
  return leftTime - rightTime;
}

function sortEvents(events: HubEvent[], statusFor: (event: HubEvent) => HubEventStatus): HubEvent[] {
  return [...events].sort((left, right) => {
    const statusDiff = statusRank[statusFor(left)] - statusRank[statusFor(right)];
    if (statusDiff !== 0) return statusDiff;

    const dateDiff = compareDates(left.endsAt ?? left.startsAt ?? left.updatedAt, right.endsAt ?? right.startsAt ?? right.updatedAt);
    if (dateDiff !== 0) return dateDiff;

    return compareDates(left.updatedAt, right.updatedAt);
  });
}

function defaultHubEvents(): HubEvent[] {
  return [
    {
      id: "official-reservation-goods",
      category: "online_goods",
      tags: [],
      participationMode: "online",
      status: "open",
      title: "Stellive Official Reservation Goods",
      summary: "Official reservation goods are available now.",
      generationId: "official",
      sourceUrl: "https://example.com/hub-events/official-reservation-goods",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      startsAt: "2026-06-01T00:00:00Z",
      endsAt: "2026-06-08T00:00:00Z",
      notificationEligible: true,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z"
    },
    {
      id: "gen3-collab-popup",
      category: "offline_popup",
      tags: [],
      participationMode: "offline",
      status: "upcoming",
      title: "Gen 3 Collaboration Popup",
      summary: "A generation 3 collaboration popup is coming soon.",
      memberId: "tenko-shibuki",
      generationId: "gen3",
      sourceUrl: "https://example.com/hub-events/gen3-collab-popup",
      sourceLabel: "Tenko Shibuki",
      sourceType: "member",
      startsAt: "2026-06-12T00:00:00Z",
      endsAt: "2026-06-18T00:00:00Z",
      notificationEligible: true,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z"
    }
  ];
}

export class HubEventService {
  private readonly events: HubEvent[];

  constructor(private readonly catalog: CatalogService, seedEvents: HubEvent[] = defaultHubEvents()) {
    this.events = seedEvents
      .map((event) => ({ ...event, tags: event.tags ?? [] }))
      .filter((event) => validateHubEvent(event, this.catalog).valid);
  }

  private filteredEvents(filters: HubEventFilters, now: Date): HubEvent[] {
    const windowStart = asDate(filters.from);
    const windowEnd = asDate(filters.to);

    const sorted = sortEvents(this.events, (event) => this.effectiveStatus(event, now));
    const cursorIndex = filters.cursor ? sorted.findIndex((event) => event.id === filters.cursor) : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;

    return sorted.slice(startIndex).filter((event) => {
      if (filters.category && event.category !== filters.category) return false;
      if (filters.tag && !event.tags.includes(filters.tag)) return false;
      if (filters.participationMode && event.participationMode !== filters.participationMode) return false;
      if (filters.generationId && event.generationId !== filters.generationId) return false;
      if (filters.memberId && event.memberId !== filters.memberId) return false;

      const effectiveStatus = this.effectiveStatus(event, now);
      if (filters.status && effectiveStatus !== filters.status) return false;

      const eventStart = asDate(event.startsAt ?? event.endsAt ?? event.updatedAt);
      const eventEnd = asDate(event.endsAt ?? event.startsAt ?? event.updatedAt);
      if (windowStart && eventEnd && eventEnd.getTime() < windowStart.getTime()) return false;
      if (windowEnd && eventStart && eventStart.getTime() > windowEnd.getTime()) return false;

      return true;
    });
  }

  getById(id: string): HubEvent | undefined {
    const event = this.events.find((event) => event.id === id);
    return event ? withEffectiveHubEventStatus(event) : undefined;
  }

  effectiveStatus(event: HubEvent, now: Date = new Date()): HubEventStatus {
    return resolveEffectiveHubEventStatus(event, now);
  }

  list(filters: HubEventFilters = {}, now: Date = new Date()): HubEventListResult {
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const filtered = this.filteredEvents(filters, now);

    const items = filtered.slice(0, limit).map((event) => withEffectiveHubEventStatus(event, now));
    const nextCursor = filtered.length > limit ? items[items.length - 1]?.id : undefined;

    return nextCursor ? { items, nextCursor } : { items };
  }

  summary(now: Date = new Date()): HubEventsSummary {
    const allEvents = this.filteredEvents({}, now);
    const openCount = allEvents.filter((event) => this.effectiveStatus(event, now) === "open").length;
    const closingSoonCount = allEvents.filter((event) => this.effectiveStatus(event, now) === "closing_soon").length;
    const upcomingCount = allEvents.filter((event) => this.effectiveStatus(event, now) === "upcoming").length;
    const preview = allEvents
      .filter((event) => {
        const status = this.effectiveStatus(event, now);
        return status === "closing_soon" || status === "open" || status === "upcoming";
      })
      .slice(0, 3)
      .map((event) => withEffectiveHubEventStatus(event, now));

    return { openCount, closingSoonCount, upcomingCount, preview };
  }

  toNotificationEvent(event: HubEvent, type: PlatformEvent["type"]): PlatformEvent {
    const timestamp = event.updatedAt;
    const memberId = event.memberId ?? (event.generationId === "official" ? "stellive-official" : `hub-event:${event.id}`);

    return {
      id: `${event.id}:${type}`,
      source: "hub_event",
      type,
      memberId,
      generationId: event.generationId,
      title: event.title,
      body: event.summary ?? event.sourceLabel,
      platformUrl: event.purchaseUrl ?? event.ticketUrl ?? event.sourceUrl,
      appDeepLink: `stellivehub://hub-events/${event.id}`,
      occurredAt: timestamp,
      receivedAt: timestamp,
      dedupeKey: `${event.id}:${type}`,
      realtimeEligible: false,
      deliveryMode: "standard",
      rawPayload: event
    };
  }
}
