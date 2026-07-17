import type { FastifyInstance } from "fastify";
import type { ServiceAnnouncementPlatform } from "../../../../shared/schemas/domain.js";
import { ServiceAnnouncementReadService } from "../announcements/serviceAnnouncementReadService.js";

function platform(value: unknown): ServiceAnnouncementPlatform | undefined {
  return value === "android" || value === "ios" ? value : undefined;
}

function limit(value: unknown, fallback = 20): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.trunc(parsed))) : fallback;
}

export async function registerServiceAnnouncementRoutes(app: FastifyInstance, service = new ServiceAnnouncementReadService()) {
  app.get("/v1/announcements", async (request) => {
    const query = request.query as Record<string, unknown>;
    const result = await service.list({
      platform: platform(query.platform),
      appVersion: typeof query.appVersion === "string" ? query.appVersion : undefined,
      includeArchived: query.includeArchived === true || query.includeArchived === "true",
      cursor: typeof query.cursor === "string" ? query.cursor : undefined,
      limit: limit(query.limit),
    });
    return { ...result, generatedAt: new Date().toISOString() };
  });

  app.get("/v1/announcements/summary", async (request) => {
    const query = request.query as Record<string, unknown>;
    return service.summary({ platform: platform(query.platform), appVersion: typeof query.appVersion === "string" ? query.appVersion : undefined });
  });

  app.get<{ Params: { id: string } }>("/v1/announcements/:id", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const item = await service.detail(request.params.id, { platform: platform(query.platform), appVersion: typeof query.appVersion === "string" ? query.appVersion : undefined });
    if (!item) return reply.code(404).send({ error: "service_announcement_not_found" });
    return item;
  });
}
