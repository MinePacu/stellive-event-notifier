import type { FastifyInstance, FastifyReply } from "fastify";
import {
  buildHubCalendarResponse,
  buildHubCalendarWidgetSnapshot,
  type CalendarResponseOptions,
  type WidgetSnapshotOptions,
} from "../hub-events/hubEventCalendar.js";
import type { HubEventFilters, HubEventReadPort } from "../hub-events/hubEventService.js";
import type { HubEventCategory, HubEventParticipationMode, HubEventStatus } from "../types.js";

const hubEventCategories = new Set<HubEventCategory>([
  "online_goods",
  "online_collab",
  "offline_concert",
  "offline_collab",
  "offline_popup",
  "ticketing",
]);

const participationModes = new Set<HubEventParticipationMode>(["online", "offline", "hybrid"]);
const hubEventStatuses = new Set<HubEventStatus>(["announced", "upcoming", "open", "closing_soon", "ended", "cancelled"]);

export interface RegisterHubEventReadRouteOptions {
  hubEvents: HubEventReadPort;
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; response: FastifyReply };

function invalidQuery(reply: FastifyReply, field: string): ParseResult<never> {
  return {
    ok: false,
    response: reply.code(400).send({ error: "invalid_hub_event_query", field }),
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

function isSupportedTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseTimezoneQuery(value: unknown, reply: FastifyReply): ParseResult<string> {
  const timezone = firstQueryValue(value) ?? "Asia/Seoul";
  if (!isSupportedTimezone(timezone)) return invalidQuery(reply, "timezone");

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

  const limit = parseLimitQuery(input.limit, 25, 100, reply);
  if (!limit.ok) return limit;

  return {
    ok: true,
    value: {
      category: category as HubEventCategory | undefined,
      participationMode: participationMode as HubEventParticipationMode | undefined,
      status: status as HubEventStatus | undefined,
      generationId: firstQueryValue(input.generationId),
      memberId: firstQueryValue(input.memberId),
      from: from.value,
      to: to.value,
      cursor: firstQueryValue(input.cursor),
      limit: limit.value,
    },
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

  return {
    ok: true,
    value: {
      from: from.value ?? fallbackWindow.from,
      to: to.value ?? fallbackWindow.to,
      timezone: timezone.value,
      now,
    },
  };
}

function parseHubWidgetSnapshotQuery(query: unknown, reply: FastifyReply): ParseResult<WidgetSnapshotOptions> {
  const input = query as Record<string, unknown>;
  const timezone = parseTimezoneQuery(input.timezone, reply);
  if (!timezone.ok) return timezone;

  const limit = parseLimitQuery(input.limit, 5, 10, reply);
  if (!limit.ok) return limit;

  return {
    ok: true,
    value: {
      timezone: timezone.value,
      limit: limit.value,
      now: new Date(),
    },
  };
}

export default function registerHubEventReadRoutes(app: FastifyInstance, options: RegisterHubEventReadRouteOptions): void {
  const { hubEvents } = options;

  app.get("/v1/hub-events/summary", async () => hubEvents.summary());

  app.get("/v1/hub-events", async (request, reply) => {
    const parsed = parseHubEventListQuery(request.query, reply);
    if (!parsed.ok) return parsed.response;

    return hubEvents.list(parsed.value, new Date());
  });

  app.get("/v1/hub-events/calendar", async (request, reply) => {
    const parsed = parseHubCalendarQuery(request.query, reply);
    if (!parsed.ok) return parsed.response;

    const events = await hubEvents.list({ limit: 100 }, parsed.value.now);
    return buildHubCalendarResponse(events.items, parsed.value);
  });

  app.get("/v1/hub-events/widget-snapshot", async (request, reply) => {
    const parsed = parseHubWidgetSnapshotQuery(request.query, reply);
    if (!parsed.ok) return parsed.response;

    const events = await hubEvents.list({ limit: 100 }, parsed.value.now);
    return buildHubCalendarWidgetSnapshot(events.items, parsed.value);
  });

  app.get("/v1/hub-events/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await hubEvents.getById(id);
    if (!event) return reply.code(404).send({ error: "hub_event_not_found" });

    return event;
  });
}
