import { describe, expect, it, vi } from "vitest";
import { createAdminSessionCookie } from "../src/admin/adminAuth.js";
import { renderAdminConsoleHtml } from "../src/admin/adminConsoleHtml.js";
import { buildApp } from "../src/app.js";
import type { AdminHubEvent, HubEventAdminValidationResult } from "../src/hub-events/hubEventAdminTypes.js";

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  ADMIN_CONSOLE_ENABLED: "true",
  ADMIN_CONSOLE_TOKEN: "admin-token",
  INTERNAL_API_TOKEN: "internal-token"
};

const event: AdminHubEvent = {
  id: "event-1",
  category: "online_goods",
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
    createDraft: vi.fn(async () => event),
    update: vi.fn(async () => ({ ...event, title: "Updated" })),
    publish: vi.fn(async () => ({ ...event, publicationState: "published", publishedAt: "2026-06-12T12:00:00.000Z" })),
    cancel: vi.fn(async () => ({ ...event, status: "cancelled", cancelledAt: "2026-06-12T12:00:00.000Z" })),
    deactivate: vi.fn(async () => ({ ...event, publicationState: "inactive", deactivatedAt: "2026-06-12T12:00:00.000Z" })),
    delete: vi.fn(async () => ({ ...event, publicationState: "deleted", deletedAt: "2026-06-12T12:00:00.000Z" })),
    validate: vi.fn((): HubEventAdminValidationResult => ({ valid: true, errors: [] })),
    listAuditLog: vi.fn(async () => [])
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
  it("renders hub event image metadata fields in the admin form", () => {
    const html = renderAdminConsoleHtml();

    expect(html).toContain('id="hub-event-image-policy-state"');
    expect(html).toContain('id="hub-event-image-url"');
    expect(html).toContain('id="hub-event-image-source-label"');
    expect(html).toContain('id="hub-event-image-source-url"');
    expect(html).toContain('value="official_runtime_url"');
    expect(html).toContain('value="third_party_allowed"');
  });

  it("renders the redesigned hub event console layout", () => {
    const html = renderAdminConsoleHtml();

    expect(html).toContain('class="hub-events-workspace"');
    expect(html).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(html).toContain("grid-column: 1 / -1;");
    expect(html).toContain('class="hub-events-sidebar"');
    expect(html).toContain('class="hub-events-editor"');
    expect(html).toContain("Basic information");
    expect(html).toContain("Source and thumbnail");
    expect(html).toContain("Schedule");
    expect(html).toContain("Links and venue");

    for (const anchors of [
      ["hub-event-generation", "hub-event-member", "hub-event-source-type"],
      ["hub-event-source-type", "hub-event-image-policy-state", "hub-event-source-url"],
      ["hub-event-source-url", "hub-event-source-label", "hub-event-image-url"],
      ["hub-event-image-url", "hub-event-image-source-label", "hub-event-image-source-url"],
      ["hub-event-announced-at", "hub-event-starts-at", "hub-event-ends-at"],
      ["hub-event-purchase-url", "hub-event-ticket-url", "hub-event-venue-name", "hub-event-venue-address"],
    ]) {
      const positions = anchors.map((anchor) => html.indexOf(`id="${anchor}"`));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it("preserves hub event ids used by admin console scripts", () => {
    const html = renderAdminConsoleHtml();

    for (const id of [
      "hub-event-state-filter",
      "hub-event-status-filter",
      "hub-event-search",
      "hub-event-list",
      "hub-event-form",
      "hub-event-generation",
      "hub-event-member",
      "hub-event-source-type",
      "hub-event-image-policy-state",
      "hub-event-source-url",
      "hub-event-source-label",
      "hub-event-image-url",
      "hub-event-image-source-label",
      "hub-event-image-source-url",
      "hub-event-announced-at",
      "hub-event-starts-at",
      "hub-event-ends-at",
      "hub-event-purchase-url",
      "hub-event-ticket-url",
      "hub-event-venue-name",
      "hub-event-venue-address",
      "hub-event-notification-eligible",
      "hub-event-validation",
      "hub-event-audit-log",
      "recalculate-special-days"
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("renders backend-supported hub event option values and operator guidance", () => {
    const html = renderAdminConsoleHtml();

    for (const value of ["online_goods", "online_collab", "offline_concert", "offline_collab", "offline_popup", "ticketing"]) {
      expect(html).toContain(`value="${value}"`);
    }
    for (const value of ["official", "member", "official_collab"]) {
      expect(html).toContain(`value="${value}"`);
    }
    for (const value of ["offline_event", "venue", "store"]) {
      expect(html).not.toContain(`value="${value}"`);
    }
    expect(html).toContain("Use the member's matching generation");
    expect(html).toContain("Example: akane-lize");
  });

  it("sends the collected hub event input directly for admin validation", () => {
    const html = renderAdminConsoleHtml();

    expect(html).toContain('const headers = init && init.body ? { "content-type": "application/json" } : undefined;');
    expect(html).toContain("body: JSON.stringify(collectHubEventInput())");
    expect(html).not.toContain("JSON.stringify({ mode, input: collectHubEventInput() })");
  });

  it("renders single-select checkboxes for hub event rows", () => {
    const html = renderAdminConsoleHtml();

    expect(html).toContain('data-hub-event-select="true"');
    expect(html).toContain('<th aria-label="Select"></th>');
    expect(html).toContain(".hub-events-list th:first-child");
    expect(html).toContain('selectedHubEventId');
    expect(html).toContain('cell.colSpan = 5');
  });

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
});
