import type { FastifyInstance, FastifyReply } from "fastify";
import {
  buildHubCalendarResponse,
  buildHubCalendarWidgetSnapshot,
  type CalendarResponseOptions,
  type WidgetSnapshotOptions
} from "../hub-events/hubEventCalendar.js";
import type { HubEventFilters, HubEventReadPort } from "../hub-events/hubEventService.js";
import type { SpecialDayOccurrence } from "../hub-events/hubCalendarSpecialDayMaterializer.js";
import type {
  HubCalendarEntryKind,
  HubCalendarSpecialDay,
  HubEvent,
  HubEventCategory,
  HubEventTag,
  HubEventParticipationMode,
  HubEventStatus
} from "../types.js";
import { HUB_EVENT_TAGS } from "../types.js";

const hubEventCategories = new Set<HubEventCategory>([
  "online_goods",
  "online_collab",
  "offline_concert",
  "offline_collab",
  "offline_popup",
  "ticketing"
]);
const hubEventTags = new Set<HubEventTag>(HUB_EVENT_TAGS);
const participationModes = new Set<HubEventParticipationMode>(["online", "offline", "hybrid"]);
const hubEventStatuses = new Set<HubEventStatus>(["announced", "upcoming", "open", "closing_soon", "ended", "cancelled"]);
const hubCalendarEntryKinds = new Set<HubCalendarEntryKind>(["hub_event", "member_birthday", "generation_anniversary"]);

export interface RegisterHubEventReadRouteOptions {
  hubEvents: HubEventReadPort;
  hubCalendarSpecialDays?: HubCalendarSpecialDay[];
  hubCalendarSpecialDayOccurrences?: {
    listRange(filters: {
      from: Date;
      to: Date;
      generationId?: string;
      memberId?: string;
      kind?: string;
    }): Promise<SpecialDayOccurrence[]>;
  };
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; response: FastifyReply };

function invalidQuery(reply: FastifyReply, field: string): ParseResult<never> {
  return {
    ok: false,
    response: reply.code(400).send({ error: "invalid_hub_event_query", field })
  };
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

function parseDateQuery(value: unknown, field: string, reply: FastifyReply): ParseResult<Date | undefined> {
  const raw = firstQueryValue(value);
  if (!raw) return { ok: true, value: undefined };

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return invalidQuery(reply, field);

  return { ok: true, value: parsed };
}

function parseLimitQuery(value: unknown, defaultLimit: number, maxLimit: number, reply: FastifyReply): ParseResult<number> {
  const raw = firstQueryValue(value);
  if (!raw) return { ok: true, value: defaultLimit };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return invalidQuery(reply, "limit");

  return { ok: true, value: Math.min(Math.trunc(parsed), maxLimit) };
}

function parseBooleanQuery(value: unknown, field: string, reply: FastifyReply): ParseResult<boolean | undefined> {
  const raw = firstQueryValue(value);
  if (!raw) return { ok: true, value: undefined };
  if (raw === "true") return { ok: true, value: true };
  if (raw === "false") return { ok: true, value: false };
  return invalidQuery(reply, field);
}

function parseEntryKindsQuery(value: unknown, reply: FastifyReply): ParseResult<HubCalendarEntryKind[] | undefined> {
  const raw = firstQueryValue(value);
  if (!raw) return { ok: true, value: undefined };

  const entryKinds = raw.split(",").map((entryKind) => entryKind.trim()).filter(Boolean);
  if (entryKinds.length === 0 || entryKinds.some((entryKind) => !hubCalendarEntryKinds.has(entryKind as HubCalendarEntryKind))) {
    return invalidQuery(reply, "entryKind");
  }

  return { ok: true, value: entryKinds as HubCalendarEntryKind[] };
}

function parseTimezoneQuery(value: unknown, reply: FastifyReply): ParseResult<string> {
  const timezone = firstQueryValue(value) ?? "Asia/Seoul";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    return invalidQuery(reply, "timezone");
  }
  return { ok: true, value: timezone };
}

function defaultCalendarWindow(now: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

function parseHubEventListQuery(query: unknown, reply: FastifyReply): ParseResult<HubEventFilters> {
  const input = query as Record<string, unknown>;
  const category = firstQueryValue(input.category);
  if (category && !hubEventCategories.has(category as HubEventCategory)) return invalidQuery(reply, "category");

  const tag = firstQueryValue(input.tag);
  if (tag && !hubEventTags.has(tag as HubEventTag)) return invalidQuery(reply, "tag");

  const participationMode = firstQueryValue(input.participationMode);
  if (participationMode && !participationModes.has(participationMode as HubEventParticipationMode)) {
    return invalidQuery(reply, "participationMode");
  }

  const status = firstQueryValue(input.status);
  if (status && !hubEventStatuses.has(status as HubEventStatus)) return invalidQuery(reply, "status");

  const from = parseDateQuery(input.from, "from", reply);
  if (!from.ok) return from;

  const to = parseDateQuery(input.to, "to", reply);
  if (!to.ok) return to;

  if (from.value && to.value && from.value.getTime() > to.value.getTime()) return invalidQuery(reply, "date_range");

  const limit = parseLimitQuery(input.limit, 20, 50, reply);
  if (!limit.ok) return limit;

  return {
    ok: true,
    value: {
      category: category as HubEventCategory | undefined,
      tag: tag as HubEventTag | undefined,
      participationMode: participationMode as HubEventParticipationMode | undefined,
      status: status as HubEventStatus | undefined,
      generationId: firstQueryValue(input.generationId),
      memberId: firstQueryValue(input.memberId),
      from: from.value,
      to: to.value,
      cursor: firstQueryValue(input.cursor),
      limit: limit.value
    }
  };
}

function parseHubCalendarQuery(query: unknown, reply: FastifyReply): ParseResult<CalendarResponseOptions> {
  const input = query as Record<string, unknown>;
  const now = new Date();
  const fallbackWindow = defaultCalendarWindow(now);
  const from = parseDateQuery(input.from, "from", reply);
  if (!from.ok) return from;

  const to = parseDateQuery(input.to, "to", reply);
  if (!to.ok) return to;

  if (from.value && to.value && from.value.getTime() > to.value.getTime()) return invalidQuery(reply, "date_range");

  const timezone = parseTimezoneQuery(input.timezone, reply);
  if (!timezone.ok) return timezone;

  const includeSpecialDays = parseBooleanQuery(input.includeSpecialDays, "includeSpecialDays", reply);
  if (!includeSpecialDays.ok) return includeSpecialDays;

  const entryKinds = parseEntryKindsQuery(input.entryKind, reply);
  if (!entryKinds.ok) return entryKinds;

  return {
    ok: true,
    value: {
      from: from.value ?? fallbackWindow.from,
      to: to.value ?? fallbackWindow.to,
      timezone: timezone.value,
      now,
      includeSpecialDays: includeSpecialDays.value,
      entryKinds: entryKinds.value,
      generationId: firstQueryValue(input.generationId),
      memberId: firstQueryValue(input.memberId)
    }
  };
}

function parseHubWidgetSnapshotQuery(query: unknown, reply: FastifyReply): ParseResult<WidgetSnapshotOptions> {
  const input = query as Record<string, unknown>;
  const timezone = parseTimezoneQuery(input.timezone, reply);
  if (!timezone.ok) return timezone;

  const limit = parseLimitQuery(input.limit, 5, 10, reply);
  if (!limit.ok) return limit;

  const includeSpecialDays = parseBooleanQuery(input.includeSpecialDays, "includeSpecialDays", reply);
  if (!includeSpecialDays.ok) return includeSpecialDays;

  const entryKinds = parseEntryKindsQuery(input.entryKind, reply);
  if (!entryKinds.ok) return entryKinds;

  return {
    ok: true,
    value: {
      timezone: timezone.value,
      limit: limit.value,
      now: new Date(),
      includeSpecialDays: includeSpecialDays.value,
      entryKinds: entryKinds.value,
      generationId: firstQueryValue(input.generationId),
      memberId: firstQueryValue(input.memberId)
    }
  };
}

function isMissingOptionalSpecialDayOccurrenceStore(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2021"
  );
}

/**
 * Renders the calendar's special-day (member_birthday / generation_anniversary) entries
 * as a sorted "id:status" signature for a given `now`. Special-day statuses only ever
 * advance forward in time (upcoming -> open -> ended); they never regress. So if the
 * signature is identical at two points in time, the status of every special-day entry
 * must have stayed constant for the entire interval between those two points — it cannot
 * have changed and changed back. That lets us safely compare "now" against the time the
 * client's cached response was known to be valid without re-deriving what happened at
 * every instant in between.
 */
function specialDayStatusSignature(
  events: HubEvent[],
  options: CalendarResponseOptions,
  hubCalendarSpecialDays: HubCalendarSpecialDay[],
  specialDayOccurrences: SpecialDayOccurrence[],
  now: Date
): string {
  const response = buildHubCalendarResponse(events, { ...options, now }, hubCalendarSpecialDays, specialDayOccurrences);
  return response.days
    .flatMap((day) => day.entries.filter((entry) => entry.entryKind !== "hub_event").map((entry) => `${entry.id}:${entry.status}`))
    .sort()
    .join("|");
}

/**
 * True when a special-day entry's derived status could have changed between `since`
 * (the time the client's cached Last-Modified was known valid, i.e. the parsed
 * If-Modified-Since header) and the current request's `now`. See specialDayStatusSignature
 * for why comparing the two endpoints is sufficient.
 */
function specialDayStatusesChanged(
  events: HubEvent[],
  options: CalendarResponseOptions,
  hubCalendarSpecialDays: HubCalendarSpecialDay[],
  specialDayOccurrences: SpecialDayOccurrence[],
  since: Date
): boolean {
  if (options.includeSpecialDays === false) return false;
  const previousSignature = specialDayStatusSignature(events, options, hubCalendarSpecialDays, specialDayOccurrences, since);
  const currentSignature = specialDayStatusSignature(events, options, hubCalendarSpecialDays, specialDayOccurrences, options.now);
  return previousSignature !== currentSignature;
}

export default function registerHubEventReadRoutes(app: FastifyInstance, options: RegisterHubEventReadRouteOptions): void {
  const { hubEvents, hubCalendarSpecialDays = [], hubCalendarSpecialDayOccurrences } = options;

  async function listOptionalSpecialDayOccurrences(
    filters: { from: Date; to: Date; generationId?: string; memberId?: string; kind?: string },
    includeSpecialDays?: boolean
  ): Promise<SpecialDayOccurrence[]> {
    if (includeSpecialDays === false || !hubCalendarSpecialDayOccurrences) return [];

    try {
      return await hubCalendarSpecialDayOccurrences.listRange(filters);
    } catch (error) {
      if (isMissingOptionalSpecialDayOccurrenceStore(error)) {
        app.log.warn(
          { err: error },
          "Special-day occurrence table is unavailable; continuing without special-day entries"
        );
        return [];
      }

      throw error;
    }
  }

  app.get("/v1/hub-events/summary", async () => hubEvents.summary());

  app.get("/v1/hub-events", async (request, reply) => {
    const parsed = parseHubEventListQuery(request.query, reply);
    if (!parsed.ok) return parsed.response;

    return hubEvents.list(parsed.value, new Date());
  });

  app.get("/v1/hub-events/calendar", async (request, reply) => {
    const parsed = parseHubCalendarQuery(request.query, reply);
    if (!parsed.ok) return parsed.response;

    const events = await hubEvents.list({
      from: parsed.value.from,
      to: parsed.value.to,
      generationId: parsed.value.generationId,
      memberId: parsed.value.memberId
    }, parsed.value.now);

    // Fetch special-day occurrences before deciding on a 304: unlike HubEvent rows,
    // special-day (birthday / anniversary) entries have no `updatedAt` of their own —
    // their displayed status is derived live from the request's `now`. A 304 decided
    // purely from HubEvent.updatedAt can therefore hide a real status change (e.g.
    // upcoming -> open) that happened only because time passed.
    const specialDayOccurrences = await listOptionalSpecialDayOccurrences(
      {
        from: parsed.value.from,
        to: parsed.value.to,
        generationId: parsed.value.generationId,
        memberId: parsed.value.memberId
      },
      parsed.value.includeSpecialDays
    );

    const maxUpdatedAtMs = events.items.length === 0
      ? undefined
      : Math.max(...events.items.map((item) => new Date(item.updatedAt).getTime()));
    if (maxUpdatedAtMs !== undefined) {
      const lastModified = new Date(Math.floor(maxUpdatedAtMs / 1000) * 1000);
      reply.header("Last-Modified", lastModified.toUTCString());

      const ifModifiedSinceHeader = request.headers["if-modified-since"];
      if (typeof ifModifiedSinceHeader === "string") {
        const parsedIfModifiedSince = new Date(ifModifiedSinceHeader);
        if (
          !Number.isNaN(parsedIfModifiedSince.getTime()) &&
          lastModified.getTime() <= parsedIfModifiedSince.getTime() &&
          !specialDayStatusesChanged(events.items, parsed.value, hubCalendarSpecialDays, specialDayOccurrences, parsedIfModifiedSince)
        ) {
          return reply.code(304).send();
        }
      }
    }

    return buildHubCalendarResponse(events.items, parsed.value, hubCalendarSpecialDays, specialDayOccurrences);
  });

  app.get("/v1/hub-events/widget-snapshot", async (request, reply) => {
    const parsed = parseHubWidgetSnapshotQuery(request.query, reply);
    if (!parsed.ok) return parsed.response;

    const events = await hubEvents.list({
      limit: 100,
      generationId: parsed.value.generationId,
      memberId: parsed.value.memberId
    }, parsed.value.now);
    const specialDayOccurrences = await listOptionalSpecialDayOccurrences(
      {
        from: parsed.value.now,
        to: new Date(parsed.value.now.getTime() + 90 * 24 * 60 * 60 * 1000),
        generationId: parsed.value.generationId,
        memberId: parsed.value.memberId
      },
      parsed.value.includeSpecialDays
    );
    return buildHubCalendarWidgetSnapshot(events.items, parsed.value, hubCalendarSpecialDays, specialDayOccurrences);
  });

  app.get("/v1/hub-events/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await hubEvents.getById(id);
    if (!event) return reply.code(404).send({ error: "hub_event_not_found" });
    return event;
  });
}
