import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { InternalRouteDependencies } from "../src/routes/internalRoutes.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_LIVE_POLLING_ENABLED: "false"
};
const adminEnv = { ...baseEnv, ADMIN_CONSOLE_ENABLED: "true", ADMIN_CONSOLE_TOKEN: "admin-token" };
const internalAuth = { authorization: "Bearer internal-test-token" };
const adminAuth = { authorization: "Bearer admin-token" };

function createHarness(env: Record<string, string> = adminEnv) {
  const listDiagnostics = vi.fn(async () => []);
  const drain = vi.fn(async () => ({ status: "ok" }));
  const hubEventList = vi.fn(async () => ({ items: [] }));
  const announcementList = vi.fn(async () => ({ items: [] }));
  const internalDependencies = {
    webhookSubscriptions: { listDiagnostics },
    notificationJobs: { listDiagnostics: vi.fn(async () => []), drain },
    summaryNotifications: { summarize: drain, listDiagnostics: vi.fn(async () => []) }
  } as unknown as InternalRouteDependencies;

  const build = () =>
    buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: { dependencies: internalDependencies },
      adminHubEventRoutes: { dependencies: { service: { list: hubEventList } as never } },
      adminServiceAnnouncementRoutes: { service: { list: announcementList } as never }
    });

  return { build, listDiagnostics, drain, hubEventList, announcementList };
}

describe("percent-encoded path auth bypass", () => {
  it("rejects encoded internal GET paths without credentials", async () => {
    const h = createHarness();
    const app = await h.build();
    for (const url of [
      "/v1/%69nternal/webhooks/subscriptions",
      "/v1/i%6Eternal/webhooks/subscriptions",
      "/v1/internal/webhooks/%73ubscriptions"
    ]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(401);
    }
    await app.close();
    expect(h.listDiagnostics).not.toHaveBeenCalled();
  });

  it("rejects encoded internal POST paths without credentials", async () => {
    const h = createHarness();
    const app = await h.build();
    const response = await app.inject({ method: "POST", url: "/v1/%69nternal/jobs/notifications/drain", payload: {} });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(h.drain).not.toHaveBeenCalled();
  });

  it("still serves authenticated plain and encoded internal requests", async () => {
    const h = createHarness();
    const app = await h.build();
    const plain = await app.inject({ method: "GET", url: "/v1/internal/webhooks/subscriptions", headers: internalAuth });
    const encoded = await app.inject({ method: "GET", url: "/v1/%69nternal/webhooks/subscriptions", headers: internalAuth });
    await app.close();

    expect(plain.statusCode).toBe(200);
    expect(encoded.statusCode).toBe(200);
  });

  it("rejects encoded admin hub-event paths without credentials", async () => {
    const h = createHarness();
    const app = await h.build();
    for (const url of ["/v1/%61dmin/hub-events", "/v1/admin/hub%2Devents", "/v1/admin/hub-%65vents"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(401);
    }
    await app.close();
    expect(h.hubEventList).not.toHaveBeenCalled();
  });

  it("hides encoded admin hub-event paths when the admin console is disabled", async () => {
    const h = createHarness({ ...baseEnv, ADMIN_CONSOLE_ENABLED: "false" });
    const app = await h.build();
    for (const url of ["/v1/%61dmin/hub-events", "/v1/admin/hub%2Devents", "/v1/admin/hub-%65vents"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(404);
    }
    await app.close();
    expect(h.hubEventList).not.toHaveBeenCalled();
  });

  it("rejects encoded admin announcement paths without credentials", async () => {
    const h = createHarness();
    const app = await h.build();
    for (const url of ["/v1/%61dmin/announcements", "/v1/admin/%61nnouncements"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(401);
    }
    await app.close();
    expect(h.announcementList).not.toHaveBeenCalled();
  });

  it("still serves authenticated admin hub-event and announcement requests", async () => {
    const h = createHarness();
    const app = await h.build();
    const hubEvents = await app.inject({ method: "GET", url: "/v1/admin/hub-events", headers: adminAuth });
    const announcements = await app.inject({ method: "GET", url: "/v1/admin/announcements", headers: adminAuth });
    await app.close();

    expect(hubEvents.statusCode).toBe(200);
    expect(announcements.statusCode).toBe(200);
    expect(h.hubEventList).toHaveBeenCalledOnce();
    expect(h.announcementList).toHaveBeenCalledOnce();
  });
});

describe("percent-encoded path CORS", () => {
  const preflightHeaders = { origin: "https://evil.example", "access-control-request-method": "GET" };

  it("does not grant wildcard CORS to encoded privileged preflights", async () => {
    const h = createHarness();
    const app = await h.build();
    for (const url of [
      "/v1/%61dmin/hub-events",
      "/v1/admin/hub%2Devents",
      "/v1/%61dmin/announcements",
      "/v1/%69nternal/webhooks/subscriptions"
    ]) {
      const response = await app.inject({ method: "OPTIONS", url, headers: preflightHeaders });
      expect(response.headers["access-control-allow-origin"], url).toBeUndefined();
    }
    await app.close();
  });

  it("does not grant CORS to encoded privileged simple requests", async () => {
    const h = createHarness();
    const app = await h.build();
    const response = await app.inject({
      method: "GET",
      url: "/v1/%69nternal/webhooks/subscriptions",
      headers: { ...internalAuth, origin: "https://evil.example" }
    });
    await app.close();

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps wildcard CORS on public route preflights", async () => {
    const h = createHarness();
    const app = await h.build();
    const response = await app.inject({ method: "OPTIONS", url: "/health", headers: preflightHeaders });
    await app.close();

    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });
});
