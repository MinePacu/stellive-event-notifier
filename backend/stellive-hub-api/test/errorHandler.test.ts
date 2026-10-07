import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { InternalRouteDependencies } from "../src/routes/internalRoutes.js";

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_LIVE_POLLING_ENABLED: "false"
};
const internalAuth = { authorization: "Bearer internal-test-token" };
const leakyMessage =
  "Invalid prisma.x.findMany() invocation in /Users/secret/path/file.ts:91:59 Can't reach database server at db.internal:5432";

async function buildWithThrowingDiagnostics(error: Error) {
  const internalDependencies = {
    webhookSubscriptions: { listDiagnostics: vi.fn(async () => { throw error; }) }
  } as unknown as InternalRouteDependencies;
  return buildApp({ env, useProcessEnv: false, internalRoutes: { dependencies: internalDependencies } });
}

async function buildPlain() {
  return buildApp({ env, useProcessEnv: false });
}

describe("global error handler", () => {
  it("does not leak internals in 500 responses", async () => {
    const app = await buildWithThrowingDiagnostics(new Error(leakyMessage));
    const response = await app.inject({ method: "GET", url: "/v1/internal/webhooks/subscriptions", headers: internalAuth });
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "internal_error" });
    expect(response.body).not.toContain("/Users/");
    expect(response.body).not.toContain("prisma");
    expect(response.body).not.toContain("5432");
  });

  it("keeps an error-provided 5xx status code but hides the message", async () => {
    const error = Object.assign(new Error(leakyMessage), { statusCode: 503 });
    const app = await buildWithThrowingDiagnostics(error);
    const response = await app.inject({ method: "GET", url: "/v1/internal/webhooks/subscriptions", headers: internalAuth });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "internal_error" });
    expect(response.body).not.toContain("5432");
  });
});

describe("global error handler leaves 4xx responses unchanged", () => {
  it("keeps the malformed JSON body response", async () => {
    const app = await buildPlain();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: "{bad",
      headers: { "content-type": "application/json" }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(response.body).toBe(
      '{"statusCode":400,"code":"FST_ERR_CTP_INVALID_JSON_BODY","error":"Bad Request","message":"Body is not valid JSON but content-type is set to \'application/json\'"}'
    );
  });

  it("keeps the empty JSON body response", async () => {
    const app = await buildPlain();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: "",
      headers: { "content-type": "application/json" }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.body).toBe(
      '{"statusCode":400,"code":"FST_ERR_CTP_EMPTY_JSON_BODY","error":"Bad Request","message":"Body cannot be empty when content-type is set to \'application/json\'"}'
    );
  });

  it("keeps the unsupported media type response", async () => {
    const app = await buildPlain();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: "x",
      headers: { "content-type": "text/weird" }
    });
    await app.close();

    expect(response.statusCode).toBe(415);
    expect(response.body).toBe(
      '{"statusCode":415,"code":"FST_ERR_CTP_INVALID_MEDIA_TYPE","error":"Unsupported Media Type","message":"Unsupported Media Type"}'
    );
  });

  it("keeps the sensible notFound response", async () => {
    const app = await buildPlain();
    const response = await app.inject({ method: "GET", url: "/v1/members/does-not-exist" });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('{"statusCode":404,"error":"Not Found","message":"member not found"}');
  });

  it("keeps the unknown route 404 response", async () => {
    const app = await buildPlain();
    const response = await app.inject({ method: "GET", url: "/no/such/route" });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('{"message":"Route GET:/no/such/route not found","error":"Not Found","statusCode":404}');
  });
});
