import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import {
  authenticateAdminSessionCookie,
  authenticateBearerToken,
  shouldEnableAdminConsole
} from "../admin/adminAuth.js";
import { CatalogService } from "../catalog/catalog.js";
import type { AppEnv } from "../config/env.js";
import { clearSpecialDayStatusSnapshotCache } from "../hub-events/hubCalendarSpecialDays.js";
import { HubEventAdminService, HubEventAdminValidationException } from "../hub-events/hubEventAdminService.js";
import type { HubEventAdminValidationResult } from "../hub-events/hubEventAdminTypes.js";
import type { AdminHubEventFilters } from "../hub-events/hubEventRepository.js";

interface HubEventAdminRouteService {
  list(filters: AdminHubEventFilters): Promise<unknown>;
  getById(id: string): Promise<unknown | undefined>;
  createDraft(input: unknown, actor: { actorId?: string; reason?: string }): Promise<unknown>;
  update(id: string, input: unknown, actor: { actorId?: string; reason?: string }): Promise<unknown>;
  publish(id: string, actor: { actorId?: string; reason?: string }): Promise<unknown>;
  cancel(id: string, actor: { actorId?: string; reason?: string }): Promise<unknown>;
  deactivate(id: string, actor: { actorId?: string; reason?: string }): Promise<unknown>;
  delete(id: string, actor: { actorId?: string; reason?: string }): Promise<unknown>;
  validate(input: unknown, mode: "draft" | "publish"): HubEventAdminValidationResult;
  listAuditLog(id: string, limit: number): Promise<unknown>;
}

export interface AdminHubEventRouteDependencies {
  service: HubEventAdminRouteService;
  clearSpecialDayStatusCache: () => { cleared: true };
}

export interface AdminHubEventRouteOptions {
  env: AppEnv;
  dependencies?: Partial<AdminHubEventRouteDependencies>;
}

const privilegedRouteOptions: RouteShorthandOptions = {
  config: {
    cors: false
  } as unknown as RouteShorthandOptions["config"]
};

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join("; ") : value;
}

function parseLimit(value: unknown, defaultLimit: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function actorFromRequest(request: FastifyRequest): { actorId: string; reason?: string } {
  const body = request.body as { changeReason?: string; reason?: string } | undefined;
  return {
    actorId: "admin",
    reason: body?.changeReason ?? body?.reason
  };
}

function applyNoStore(reply: FastifyReply) {
  reply.header("Cache-Control", "no-store");
  reply.header("Pragma", "no-cache");
}

function authenticateAdminRequest(request: FastifyRequest, env: AppEnv) {
  const authorization = readHeader(request.headers.authorization);
  if (authorization) return authenticateBearerToken(authorization, env.ADMIN_CONSOLE_TOKEN);
  return authenticateAdminSessionCookie(readHeader(request.headers.cookie), env.ADMIN_CONSOLE_TOKEN);
}

function parseListFilters(query: Record<string, unknown>): AdminHubEventFilters {
  return {
    publicationState: typeof query.publicationState === "string" ? query.publicationState as AdminHubEventFilters["publicationState"] : undefined,
    status: typeof query.status === "string" ? query.status as AdminHubEventFilters["status"] : undefined,
    category: typeof query.category === "string" ? query.category as AdminHubEventFilters["category"] : undefined,
    participationMode: typeof query.participationMode === "string" ? query.participationMode as AdminHubEventFilters["participationMode"] : undefined,
    generationId: typeof query.generationId === "string" ? query.generationId : undefined,
    memberId: typeof query.memberId === "string" ? query.memberId : undefined,
    query: typeof query.query === "string" ? query.query : undefined,
    cursor: typeof query.cursor === "string" ? query.cursor : undefined,
    includeDeleted: query.includeDeleted === "true" || query.includeDeleted === true,
    limit: parseLimit(query.limit, 50)
  };
}

async function sendServiceError(error: unknown, reply: FastifyReply) {
  if (error instanceof HubEventAdminValidationException) {
    return reply.code(error.statusCode).send({ valid: false, errors: error.errors });
  }
  if (error instanceof Error && error.message === "hub_event_not_found") {
    return reply.code(404).send({ error: "hub_event_not_found" });
  }
  throw error;
}

export async function registerAdminHubEventRoutes(app: FastifyInstance, options: AdminHubEventRouteOptions): Promise<void> {
  const service = options.dependencies?.service ?? new HubEventAdminService({ catalog: new CatalogService() });
  const clearSpecialDayStatusCache =
    options.dependencies?.clearSpecialDayStatusCache ?? clearSpecialDayStatusSnapshotCache;

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/admin/hub-events")) return;
    if (request.method === "OPTIONS") return;
    if (!options.env.ADMIN_CONSOLE_ENABLED) return reply.callNotFound();
    if (!shouldEnableAdminConsole(options.env)) return reply.code(503).send({ error: "admin_console_token_missing" });

    const auth = authenticateAdminRequest(request, options.env);
    if (!auth.ok) return reply.code(401).send({ error: auth.reason });
  });

  app.get("/v1/admin/hub-events", privilegedRouteOptions, async (request) => {
    return service.list(parseListFilters(request.query as Record<string, unknown>));
  });

  app.post("/v1/admin/hub-events/validate", privilegedRouteOptions, async (request, reply) => {
    const result = service.validate(request.body, "publish");
    if (!result.valid) return reply.code(400).send(result);
    return result;
  });

  app.post("/v1/admin/hub-events/special-days/recalculate-status", privilegedRouteOptions, async (_request, reply) => {
    applyNoStore(reply);
    return { ok: true, ...clearSpecialDayStatusCache() };
  });

  app.post("/v1/admin/hub-events", privilegedRouteOptions, async (request, reply) => {
    applyNoStore(reply);
    try {
      const created = await service.createDraft(request.body, actorFromRequest(request));
      return reply.code(201).send(created);
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>("/v1/admin/hub-events/:id/audit-log", privilegedRouteOptions, async (request) => {
    const limit = parseLimit((request.query as { limit?: unknown }).limit, 25);
    return service.listAuditLog(request.params.id, limit);
  });

  app.get<{ Params: { id: string } }>("/v1/admin/hub-events/:id", privilegedRouteOptions, async (request, reply) => {
    const event = await service.getById(request.params.id);
    if (!event) return reply.code(404).send({ error: "hub_event_not_found" });
    return event;
  });

  app.put<{ Params: { id: string } }>("/v1/admin/hub-events/:id", privilegedRouteOptions, async (request, reply) => {
    applyNoStore(reply);
    try {
      return await service.update(request.params.id, request.body, actorFromRequest(request));
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/admin/hub-events/:id/publish", privilegedRouteOptions, async (request, reply) => {
    applyNoStore(reply);
    try {
      return await service.publish(request.params.id, actorFromRequest(request));
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/admin/hub-events/:id/cancel", privilegedRouteOptions, async (request, reply) => {
    applyNoStore(reply);
    try {
      return await service.cancel(request.params.id, actorFromRequest(request));
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/admin/hub-events/:id/deactivate", privilegedRouteOptions, async (request, reply) => {
    applyNoStore(reply);
    try {
      return await service.deactivate(request.params.id, actorFromRequest(request));
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.delete<{ Params: { id: string } }>("/v1/admin/hub-events/:id", privilegedRouteOptions, async (request, reply) => {
    applyNoStore(reply);
    try {
      return await service.delete(request.params.id, actorFromRequest(request));
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
}
