import { describe, expect, it, vi } from "vitest";
import { createAdminSessionCookie } from "../src/admin/adminAuth.js";
import { renderAdminConsoleHtml } from "../src/admin/adminConsoleHtml.js";
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

    expect(html).toContain("hub-event-editor-panel");
    expect(html).toContain("hub-event-list-panel");
    expect(html).toContain('id="hub-event-form"');
    expect(html).toContain('class="event-list hub-events-list"');
    expect(html).toContain('class="hub-event-pagination"');
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
      ["hub-event-link-add", "hub-event-links", "hub-event-venue-name", "hub-event-venue-address"],
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
      "hub-event-link-add",
      "hub-event-links",
      "hub-event-schedule-link-add",
      "hub-event-schedule-links",
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

  it("renders repeated event and schedule link editors with a primary schedule radio", () => {
    const html = renderAdminConsoleHtml();

    expect(html).toContain('row.className = "hub-event-link-row"');
    expect(html).toContain('kind.dataset.linkField = "kind"');
    expect(html).toContain('label.dataset.linkField = "label"');
    expect(html).toContain('url.dataset.linkField = "url"');
    expect(html).toContain('primary.name = "hub-event-primary-schedule"');
    expect(html).toContain("setPrimaryScheduleItem");
    expect(html).toContain("collectLinkEditor(hubEventLinksRoot)");
    expect(html).toContain("collectLinkEditor(hubEventScheduleLinksRoot)");
    expect(html).toContain("moveLinkEditorRow(row, -1)");
    expect(html).toContain("moveLinkEditorRow(row, 1)");
    expect(html).toContain("updateLinkEditorCount(root)");
    expect(html).toContain('t("hubEvent.scheduleLinkCount", { count: linkCount })');
  });

  it("defaults the hub event status filter to open while keeping all statuses and ended available", () => {
    const html = renderAdminConsoleHtml();

    expect(html).toContain('id="hub-event-status-filter"');
    expect(html).toContain('<option value="open" selected>Open</option>');
    expect(html).toContain('<option value="">All statuses</option>');
    expect(html).toContain('<option value="ended">Ended</option>');
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
    expect(html).toContain('className = "event-row"');
    expect(html).toContain('classList.add("active")');
    expect(html).toContain('hubEventListRoot.querySelectorAll(');
    expect(html).toContain('selectedHubEventId');
    expect(html).toContain('id="hub-event-prev-page"');
    expect(html).toContain('id="hub-event-next-page"');
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

  it("renders tabbed schedule editing without expanded schedule arrays in the event form", () => {
    const html = renderAdminConsoleHtml();

    expect(html).toContain('data-hub-event-tab="info"');
    expect(html).toContain('data-hub-event-tab="schedule"');
    expect(html).toContain('data-hub-event-tab="history"');
    expect(html).toContain('id="hub-event-schedule-dialog"');
    expect(html).toContain('id="hub-event-schedule-save"');
    expect(html).toContain('id="hub-event-schedule-title" autocomplete="off" required maxlength="160"');
    expect(html).toContain('id="hub-event-schedule-description" rows="3" maxlength="2000"');
    expect(html).toContain('id="hub-event-schedule-timing"');
    expect(html).toContain('<option value="point">Single point</option>');
    expect(html).toContain('<option value="period">Period</option>');
    expect(html).toContain('id="hub-event-schedule-ends-at" type="datetime-local" disabled');
    expect(html).toContain('function setScheduleTimingUi(timing)');
    expect(html).toContain('endsAt: timing === "period"');
    expect(html).toContain('id="hub-event-schedule-label" autocomplete="off" maxlength="80"');
    expect(html).toContain('label: value("hub-event-schedule-label") || title');
    expect(html).not.toContain('input.scheduleItems = collectScheduleItems()');
  });

  it("localizes required title and optional schedule fields", () => {
    const html = renderAdminConsoleHtml("ko");

    expect(html).toContain(">제목<");
    expect(html).toContain(">설명 (선택 사항)<");
    expect(html).toContain(">짧은 라벨 (선택 사항)<");
    expect(html).toContain(">비우면 제목을 사용합니다<");
    expect(html).toContain('<option value="point">단일 시점</option>');
    expect(html).toContain('<option value="period">기간</option>');
    expect(html).toContain('t("hubEvent.scheduleTitleRequired")');
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
