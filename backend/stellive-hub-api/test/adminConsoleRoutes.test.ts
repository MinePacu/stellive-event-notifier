import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminSessionCookieName } from "../src/admin/adminAuth.js";
import { buildApp } from "../src/app.js";

const databaseUrl = "postgresql://stellive:stellive@localhost:5432/stellive_hub";
const indexHtml = '<!doctype html><html><head><script type="module" src="/admin/assets/index-abc123.js"></script></head><body><div id="root"></div></body></html>';
const assetJs = 'console.log("admin");';

let tempRoot: string;
let distDir: string;

beforeAll(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "stellive-admin-console-"));
  distDir = path.join(tempRoot, "dist");
  await mkdir(path.join(distDir, "assets"), { recursive: true });
  await writeFile(path.join(distDir, "index.html"), indexHtml);
  await writeFile(path.join(distDir, "assets", "index-abc123.js"), assetJs);
  await writeFile(path.join(distDir, "assets", "index-abc123.css"), "body{margin:0}");
  await writeFile(path.join(distDir, "favicon.svg"), "<svg></svg>");
  await writeFile(path.join(distDir, ".env"), "SECRET=dotfile");
  await writeFile(path.join(tempRoot, "secret.txt"), "outside-dist-secret");
  await symlink(path.join(tempRoot, "secret.txt"), path.join(distDir, "assets", "linked-secret.txt"));
});

afterAll(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

async function buildAdminApp(env: Record<string, string> = {}) {
  return buildApp({
    env: {
      DATABASE_URL: databaseUrl,
      ADMIN_CONSOLE_ENABLED: "true",
      ADMIN_CONSOLE_TOKEN: "admin-token",
      ADMIN_CONSOLE_DIST_DIR: distDir,
      ...env
    },
    useProcessEnv: false
  });
}

describe("admin session API", () => {
  it("returns 404 when the admin console is disabled", async () => {
    const app = await buildAdminApp({ ADMIN_CONSOLE_ENABLED: "false" });
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/v1/admin/session", headers: { authorization: "Bearer admin-token" } }),
      app.inject({ method: "POST", url: "/v1/admin/session", payload: { token: "admin-token" } }),
      app.inject({ method: "DELETE", url: "/v1/admin/session" })
    ]);
    await app.close();

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404]);
    expect(responses.every((response) => response.headers["set-cookie"] === undefined)).toBe(true);
  });

  it("returns 503 when enabled without an effective admin token", async () => {
    const app = await buildAdminApp({ ADMIN_CONSOLE_TOKEN: "   " });
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/v1/admin/session" }),
      app.inject({ method: "POST", url: "/v1/admin/session", payload: { token: "anything" } }),
      app.inject({ method: "DELETE", url: "/v1/admin/session" })
    ]);
    await app.close();

    for (const response of responses) {
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: "admin_console_token_missing" });
    }
  });

  it("reports unauthenticated requests as 401 with no-store", async () => {
    const app = await buildAdminApp();
    const missing = await app.inject({ method: "GET", url: "/v1/admin/session" });
    const wrongBearer = await app.inject({ method: "GET", url: "/v1/admin/session", headers: { authorization: "Bearer wrong-token" } });
    const forgedCookie = await app.inject({
      method: "GET",
      url: "/v1/admin/session",
      headers: { cookie: `${adminSessionCookieName}=v1.1.nonce.forged` }
    });
    await app.close();

    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "missing_authorization" });
    expect(missing.headers["cache-control"]).toBe("no-store");
    expect(wrongBearer.statusCode).toBe(401);
    expect(wrongBearer.json()).toEqual({ error: "invalid_token" });
    expect(forgedCookie.statusCode).toBe(401);
    expect(forgedCookie.json()).toEqual({ error: "invalid_token" });
  });

  it("does not accept the internal api token as an admin session", async () => {
    const app = await buildAdminApp({ INTERNAL_API_TOKEN: "internal-test-token" });
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/session",
      headers: { authorization: "Bearer internal-test-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(401);
  });

  it("authenticates a valid admin bearer token", async () => {
    const app = await buildAdminApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/session",
      headers: { authorization: "Bearer admin-token", origin: "https://example.com" }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: true });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects invalid or missing login tokens without setting a session cookie", async () => {
    const app = await buildAdminApp();
    const wrong = await app.inject({ method: "POST", url: "/v1/admin/session", payload: { token: "wrong-token" } });
    const missing = await app.inject({ method: "POST", url: "/v1/admin/session", payload: {} });
    const nonString = await app.inject({ method: "POST", url: "/v1/admin/session", payload: { token: 123 } });
    await app.close();

    for (const response of [wrong, missing, nonString]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "invalid_admin_token" });
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("issues an HttpOnly SameSite=Strict session cookie that authenticates later requests", async () => {
    const app = await buildAdminApp();
    const login = await app.inject({ method: "POST", url: "/v1/admin/session", payload: { token: "admin-token" } });
    const setCookie = String(login.headers["set-cookie"]);
    const cookie = setCookie.split(";")[0];
    const session = await app.inject({ method: "GET", url: "/v1/admin/session", headers: { cookie } });
    await app.close();

    expect(login.statusCode).toBe(204);
    expect(login.body).toBe("");
    expect(login.headers["cache-control"]).toBe("no-store");
    expect(setCookie).toContain(`${adminSessionCookieName}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).not.toContain("admin-token");
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({ authenticated: true });
  });

  it("does not trust forwarded proto headers but honors ADMIN_CONSOLE_COOKIE_SECURE", async () => {
    const plainApp = await buildAdminApp();
    const forwarded = await plainApp.inject({
      method: "POST",
      url: "/v1/admin/session",
      headers: { "x-forwarded-proto": "https" },
      payload: { token: "admin-token" }
    });
    await plainApp.close();

    const secureApp = await buildAdminApp({ ADMIN_CONSOLE_COOKIE_SECURE: "true" });
    const secure = await secureApp.inject({ method: "POST", url: "/v1/admin/session", payload: { token: "admin-token" } });
    const logout = await secureApp.inject({ method: "DELETE", url: "/v1/admin/session" });
    await secureApp.close();

    expect(forwarded.statusCode).toBe(204);
    expect(String(forwarded.headers["set-cookie"])).not.toContain("Secure");
    expect(secure.statusCode).toBe(204);
    expect(String(secure.headers["set-cookie"])).toContain("Secure");
    expect(String(logout.headers["set-cookie"])).toContain("Secure");
  });

  it("clears the session cookie on DELETE", async () => {
    const app = await buildAdminApp();
    const response = await app.inject({ method: "DELETE", url: "/v1/admin/session" });
    await app.close();

    const setCookie = String(response.headers["set-cookie"]);
    expect(response.statusCode).toBe(204);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(setCookie).toContain(`${adminSessionCookieName}=;`);
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
  });
});

describe("admin console SPA serving", () => {
  it("returns 404 when the admin console is disabled", async () => {
    const app = await buildAdminApp({ ADMIN_CONSOLE_ENABLED: "false" });
    const responses = await Promise.all(["/admin", "/admin/", "/admin/assets/index-abc123.js"].map((url) => app.inject({ method: "GET", url })));
    await app.close();

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404]);
  });

  it("returns 503 when enabled without an effective admin token", async () => {
    const app = await buildAdminApp({ ADMIN_CONSOLE_TOKEN: "" });
    const response = await app.inject({ method: "GET", url: "/admin" });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "admin_console_token_missing" });
  });

  it("returns 503 when the SPA has not been built", async () => {
    const app = await buildAdminApp({ ADMIN_CONSOLE_DIST_DIR: path.join(tempRoot, "missing-dist") });
    const responses = await Promise.all(["/admin", "/admin/hub-events", "/admin/assets/index-abc123.js"].map((url) => app.inject({ method: "GET", url })));
    await app.close();

    for (const response of responses) {
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: "admin_console_not_built" });
    }
  });

  it("serves index.html without authentication at /admin and /admin/", async () => {
    const app = await buildAdminApp();
    const responses = await Promise.all(["/admin", "/admin/", "/admin?lang=ko", "/admin/index.html"].map((url) => app.inject({ method: "GET", url })));
    await app.close();

    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(indexHtml);
      expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["content-security-policy"]).toBe(
        "default-src 'self'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      );
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    }
  });

  it("serves hashed assets with their mime type and an immutable cache policy", async () => {
    const app = await buildAdminApp();
    const js = await app.inject({ method: "GET", url: "/admin/assets/index-abc123.js" });
    const css = await app.inject({ method: "GET", url: "/admin/assets/index-abc123.css" });
    await app.close();

    expect(js.statusCode).toBe(200);
    expect(js.body).toBe(assetJs);
    expect(js.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(js.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(js.headers.pragma).toBeUndefined();
    expect(css.statusCode).toBe(200);
    expect(css.headers["content-type"]).toBe("text/css; charset=utf-8");
    expect(css.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("serves other dist files without long-lived caching", async () => {
    const app = await buildAdminApp();
    const response = await app.inject({ method: "GET", url: "/admin/favicon.svg" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/svg+xml");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns 404 for missing assets instead of the SPA shell", async () => {
    const app = await buildAdminApp();
    const response = await app.inject({ method: "GET", url: "/admin/assets/missing-123.js" });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('<div id="root">');
  });

  it("falls back to index.html for SPA deep links", async () => {
    const app = await buildAdminApp();
    const responses = await Promise.all(
      ["/admin/hub-events", "/admin/sign-in", "/admin/hub-events/event-1/edit?tab=schedule", "/admin/settings/"].map((url) =>
        app.inject({ method: "GET", url })
      )
    );
    await app.close();

    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(indexHtml);
      expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("rejects path traversal, dotfiles, and symlinks that escape the dist directory", async () => {
    const app = await buildAdminApp();
    const urls = [
      "/admin/../secret.txt",
      "/admin/assets/../../secret.txt",
      "/admin/%2e%2e/secret.txt",
      "/admin/%2E%2E%2Fsecret.txt",
      "/admin/assets/%2e%2e%2f%2e%2e%2fsecret.txt",
      "/admin/..%5csecret.txt",
      "/admin/secret.txt%00.js",
      "/admin/.env",
      "/admin/%2eenv",
      "/admin/assets/linked-secret.txt"
    ];
    const responses = await Promise.all(urls.map((url) => app.inject({ method: "GET", url })));
    await app.close();

    responses.forEach((response, index) => {
      expect(response.body, urls[index]).not.toContain("outside-dist-secret");
      expect(response.body, urls[index]).not.toContain("SECRET=dotfile");
      expect([400, 404], urls[index]).toContain(response.statusCode);
    });
  });
});
