import { describe, expect, it, vi } from "vitest";
import { createAdminSessionCookie } from "../src/admin/adminAuth.js";
import { buildApp } from "../src/app.js";
import type { AdminHubEvent, HubEventAdminValidationResult } from "../src/hub-events/hubEventAdminTypes.js";
import { HubEventRevisionConflictException } from "../src/hub-events/hubEventAdminService.js";

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  ADMIN_CONSOLE_ENABLED: "true",
  ADMIN_CONSOLE_TOKEN: "admin-token",
  INTERNAL_API_TOKEN: "internal-token"
};

const event: AdminHubEvent = {
  id: "event-1",
  category: "online_goods",
  tags: [],
  participationMode: "online",
  status: "announced",
  title: "Official Goods",
  generationId: "official",
  sourceUrl: "https://example.com/source",
  sourceLabel: "Stellive Official",
  sourceType: "official",
  announcedAt: "2026-06-12T00:00:00.000Z",
  notificationEligible: true,
  publicationState: "draft",
  revision: 1,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z"
};

function createFakeService() {
  return {
    list: vi.fn(async () => ({ items: [event] })),
    getById: vi.fn(async (id: string) => (id === event.id ? event : undefined)),
    createDraft: vi.fn(async (_input?: unknown, _actor?: unknown) => event),
    update: vi.fn(async () => ({ ...event, title: "Updated" })),
    publish: vi.fn(async () => ({ ...event, publicationState: "published", publishedAt: "2026-06-12T12:00:00.000Z" })),
    cancel: vi.fn(async () => ({ ...event, status: "cancelled", cancelledAt: "2026-06-12T12:00:00.000Z" })),
    deactivate: vi.fn(async () => ({ ...event, publicationState: "inactive", deactivatedAt: "2026-06-12T12:00:00.000Z" })),
    delete: vi.fn(async () => ({ ...event, publicationState: "deleted", deletedAt: "2026-06-12T12:00:00.000Z" })),
    validate: vi.fn((): HubEventAdminValidationResult => ({ valid: true, errors: [] })),
    listAuditLog: vi.fn(async () => []),
    createScheduleItem: vi.fn(async () => event),
    updateScheduleItem: vi.fn(async () => event),
    deleteScheduleItem: vi.fn(async () => ({ event, scheduleItemId: "schedule-1", deletion: "hard_deleted" as const })),
    restoreScheduleItem: vi.fn(async () => event),
    reorderScheduleItems: vi.fn(async () => event)
  };
}

async function buildTestApp(service = createFakeService(), dependencies: Record<string, unknown> = {}) {
  return {
    service,
    app: await buildApp({
      env,
      useProcessEnv: false,
      adminHubEventRoutes: {
        dependencies: { service, ...dependencies }
      }
    })
  };
}

describe("admin hub event routes", () => {
  it("rejects missing admin auth", async () => {
    const { app } = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/v1/admin/hub-events" });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_authorization" });
  });

  it("rejects the internal token when it differs from the admin token", async () => {
    const { app } = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/hub-events",
      headers: { authorization: "Bearer internal-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_token" });
  });

  it("lists events with a valid admin bearer token and no public CORS", async () => {
    const { app, service } = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/hub-events?publicationState=draft&limit=5",
      headers: { authorization: "Bearer admin-token", origin: "https://example.com" }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.json()).toEqual({ items: [event] });
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ publicationState: "draft", limit: 5 }));
  });

  it("passes the ended status filter to the admin hub event list service", async () => {
    const { app, service } = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/hub-events?status=ended&limit=5",
      headers: { authorization: "Bearer admin-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ status: "ended", limit: 5 }));
  });

  it("passes explicit null date fields from update requests", async () => {
    const { app, service } = await buildTestApp();

    const response = await app.inject({
      method: "PUT",
      url: "/v1/admin/hub-events/event-1",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        startsAt: "2026-07-11T09:00:00.000Z",
        endsAt: null
      })
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(service.update).toHaveBeenCalledWith(
      "event-1",
      {
        startsAt: "2026-07-11T09:00:00.000Z",
        endsAt: null
      },
      { actorId: "admin", reason: undefined }
    );
  });

  it("preserves review image metadata when saving a draft", async () => {
    const image = {
      policyState: "verify_required",
      url: "https://example.com/event.jpg",
      sourceLabel: "공식 공지",
      sourceUrl: "https://example.com/notice"
    };
    const service = createFakeService();
    service.createDraft.mockImplementation(async (input) => ({
      ...event,
      ...(input as Record<string, unknown>),
      id: "event-image-draft"
    }));
    const { app } = await buildTestApp(service);

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/hub-events",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json"
      },
      payload: JSON.stringify({
        ...event,
        image
      })
    });

    await app.close();

    expect(response.statusCode).toBe(201);
    expect(service.createDraft).toHaveBeenCalledWith(expect.objectContaining({ image }), {
      actorId: "admin",
      reason: undefined
    });
    expect(response.json()).toEqual(expect.objectContaining({ image }));
  });

  it("accepts a signed admin session cookie when explicitly sent", async () => {
    const cookie = createAdminSessionCookie({ adminToken: "admin-token", secure: false, now: new Date() });
    const { app } = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/hub-events",
      headers: { cookie: `${cookie?.name}=${cookie?.value}` }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
  });

  it("dispatches special-day status recalculation from an authenticated admin request", async () => {
    const clearSpecialDayStatusCache = vi.fn(() => ({ cleared: true }));
    const { app } = await buildTestApp(createFakeService(), { clearSpecialDayStatusCache });

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/hub-events/special-days/recalculate-status",
      headers: {
        authorization: "Bearer admin-token"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, cleared: true });
    expect(clearSpecialDayStatusCache).toHaveBeenCalledTimes(1);
  });

  it("dispatches create, update, publish, cancel, deactivate, delete, validate, and audit handlers", async () => {
    const { app, service } = await buildTestApp();
    const authHeaders = { authorization: "Bearer admin-token" };
    const jsonHeaders = { ...authHeaders, "content-type": "application/json" };

    expect((await app.inject({ method: "POST", url: "/v1/admin/hub-events", headers: jsonHeaders, payload: JSON.stringify(event) })).statusCode).toBe(201);
    expect((await app.inject({ method: "PUT", url: "/v1/admin/hub-events/event-1", headers: jsonHeaders, payload: JSON.stringify({ title: "Updated" }) })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/admin/hub-events/event-1/publish", headers: authHeaders })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/admin/hub-events/event-1/cancel", headers: authHeaders })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/admin/hub-events/event-1/deactivate", headers: authHeaders })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: "/v1/admin/hub-events/event-1", headers: authHeaders })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/admin/hub-events/validate", headers: jsonHeaders, payload: JSON.stringify(event) })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/admin/hub-events/event-1/audit-log", headers: authHeaders })).statusCode).toBe(200);
    await app.close();

    expect(service.createDraft).toHaveBeenCalledOnce();
    expect(service.update).toHaveBeenCalledOnce();
    expect(service.publish).toHaveBeenCalledOnce();
    expect(service.cancel).toHaveBeenCalledOnce();
    expect(service.deactivate).toHaveBeenCalledOnce();
    expect(service.delete).toHaveBeenCalledOnce();
    expect(service.validate).toHaveBeenCalledOnce();
    expect(service.listAuditLog).toHaveBeenCalledOnce();
  });

  it("returns validation errors as 400 responses", async () => {
    const service = createFakeService();
    service.validate.mockReturnValue({
      valid: false,
      errors: [{ field: "sourceUrl", reason: "url_not_https", message: "sourceUrl must be an HTTPS URL." }]
    } satisfies HubEventAdminValidationResult);
    const { app } = await buildTestApp(service);
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/hub-events/validate",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      payload: JSON.stringify({ sourceUrl: "http://example.com" })
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      valid: false,
      errors: [{ field: "sourceUrl", reason: "url_not_https", message: "sourceUrl must be an HTTPS URL." }]
    });
  });

  it("returns 404 for missing event details", async () => {
    const { app } = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/hub-events/missing",
      headers: { authorization: "Bearer admin-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "hub_event_not_found" });
  });

  it("dispatches authenticated schedule item mutations with expected revisions", async () => {
    const { app, service } = await buildTestApp();
    const headers = { authorization: "Bearer admin-token", "content-type": "application/json" };
    const mutation = {
      expectedRevision: 1,
      kind: "sales_open",
      label: "판매 시작",
      startsAt: "2026-07-20T01:00:00.000Z",
      timePrecision: "datetime",
      timezone: "Asia/Seoul"
    };

    expect((await app.inject({ method: "POST", url: "/v1/admin/hub-events/event-1/schedule-items", headers, payload: mutation })).statusCode).toBe(201);
    expect((await app.inject({ method: "PATCH", url: "/v1/admin/hub-events/event-1/schedule-items/schedule-1", headers, payload: mutation })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: "/v1/admin/hub-events/event-1/schedule-items/schedule-1", headers, payload: { expectedRevision: 1 } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/admin/hub-events/event-1/schedule-items/schedule-1/restore", headers, payload: { expectedRevision: 1 } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: "/v1/admin/hub-events/event-1/schedule-items/order", headers, payload: { expectedRevision: 1, scheduleItemIds: ["schedule-1"] } })).statusCode).toBe(200);
    await app.close();

    expect(service.createScheduleItem).toHaveBeenCalledWith("event-1", expect.objectContaining({ expectedRevision: 1 }), expect.any(Object));
    expect(service.updateScheduleItem).toHaveBeenCalledWith("event-1", "schedule-1", expect.objectContaining({ expectedRevision: 1 }), expect.any(Object));
    expect(service.deleteScheduleItem).toHaveBeenCalledWith("event-1", "schedule-1", 1, expect.any(Object));
    expect(service.restoreScheduleItem).toHaveBeenCalledWith("event-1", "schedule-1", 1, expect.any(Object));
    expect(service.reorderScheduleItems).toHaveBeenCalledOnce();
  });

  it("returns schedule revision conflicts as 409 responses", async () => {
    const service = createFakeService();
    service.createScheduleItem.mockRejectedValueOnce(new HubEventRevisionConflictException(2, 3));
    const { app } = await buildTestApp(service);
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/hub-events/event-1/schedule-items",
      headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
      payload: {
        expectedRevision: 2,
        kind: "custom",
        label: "일정",
        startsAt: "2026-07-20T01:00:00.000Z",
        timePrecision: "datetime",
        timezone: "Asia/Seoul"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "hub_event_revision_conflict",
      expectedRevision: 2,
      currentRevision: 3
    });
  });
});
