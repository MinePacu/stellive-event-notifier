import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import { ServiceAnnouncementAdminService, ServiceAnnouncementValidationError } from "../announcements/serviceAnnouncementAdminService.js";
import { authenticateAdminSessionCookie, authenticateBearerToken, shouldEnableAdminConsole } from "../admin/adminAuth.js";
import type { AppEnv } from "../config/env.js";

const privileged: RouteShorthandOptions = { config: { cors: false } as never };

function header(value: string | string[] | undefined) { return Array.isArray(value) ? value.join("; ") : value; }
function actor(request: FastifyRequest) {
  const body = request.body as { reason?: string; changeReason?: string; sendPush?: boolean } | undefined;
  return { actorId: "admin", reason: body?.reason ?? body?.changeReason, sendPush: body?.sendPush };
}
function parseLimit(value: unknown, fallback = 50) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.trunc(parsed))) : fallback; }
function noStore(reply: FastifyReply) { reply.header("Cache-Control", "no-store"); reply.header("Pragma", "no-cache"); }

async function handle(error: unknown, reply: FastifyReply) {
  if (error instanceof ServiceAnnouncementValidationError) return reply.code(400).send({ error: error.message, errors: error.errors });
  if (error instanceof Error && error.message === "service_announcement_not_found") return reply.code(404).send({ error: error.message });
  if (error instanceof Error && error.message === "service_announcement_not_published") return reply.code(409).send({ error: error.message });
  throw error;
}

export async function registerAdminServiceAnnouncementRoutes(app: FastifyInstance, options: { env: AppEnv; service: ServiceAnnouncementAdminService }) {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/admin/announcements") || request.method === "OPTIONS") return;
    if (!options.env.ADMIN_CONSOLE_ENABLED) return reply.callNotFound();
    if (!shouldEnableAdminConsole(options.env)) return reply.code(503).send({ error: "admin_console_token_missing" });
    const authorization = header(request.headers.authorization);
    const auth = authorization
      ? authenticateBearerToken(authorization, options.env.ADMIN_CONSOLE_TOKEN)
      : authenticateAdminSessionCookie(header(request.headers.cookie), options.env.ADMIN_CONSOLE_TOKEN);
    if (!auth.ok) return reply.code(401).send({ error: auth.reason });
  });

  app.get("/v1/admin/announcements", privileged, async (request) => {
    const query = request.query as Record<string, unknown>;
    return options.service.list({ publicationState: typeof query.publicationState === "string" ? query.publicationState as never : undefined, cursor: typeof query.cursor === "string" ? query.cursor : undefined, limit: parseLimit(query.limit) });
  });
  app.post("/v1/admin/announcements", privileged, async (request, reply) => { noStore(reply); try { return reply.code(201).send(await options.service.createDraft(request.body, actor(request))); } catch (error) { return handle(error, reply); } });
  app.get<{ Params: { id: string } }>("/v1/admin/announcements/:id/audit-log", privileged, async (request) => options.service.listAudit(request.params.id, parseLimit((request.query as Record<string, unknown>).limit)));
  app.get<{ Params: { id: string } }>("/v1/admin/announcements/:id/push-attempts", privileged, async (request) => options.service.listPushAttempts(request.params.id, parseLimit((request.query as Record<string, unknown>).limit)));
  app.get<{ Params: { id: string } }>("/v1/admin/announcements/:id", privileged, async (request, reply) => { const value = await options.service.getById(request.params.id); return value ?? reply.code(404).send({ error: "service_announcement_not_found" }); });
  app.patch<{ Params: { id: string } }>("/v1/admin/announcements/:id", privileged, async (request, reply) => { noStore(reply); try { return await options.service.update(request.params.id, request.body, actor(request)); } catch (error) { return handle(error, reply); } });
  for (const [action, execute] of Object.entries({
    publish: (id: string, request: FastifyRequest) => options.service.publish(id, actor(request)),
    resolve: (id: string, request: FastifyRequest) => options.service.resolve(id, actor(request)),
    archive: (id: string, request: FastifyRequest) => options.service.archive(id, actor(request)),
    resend: (id: string, request: FastifyRequest) => options.service.resend(id, actor(request)),
    "bump-attention": (id: string, request: FastifyRequest) => options.service.bumpAttention(id, actor(request)),
  })) {
    app.post<{ Params: { id: string } }>(`/v1/admin/announcements/:id/${action}`, privileged, async (request, reply) => { noStore(reply); try { return await execute(request.params.id, request); } catch (error) { return handle(error, reply); } });
  }
}
