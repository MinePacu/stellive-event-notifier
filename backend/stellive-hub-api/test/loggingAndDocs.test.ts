import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { serializeRequestForLog } from "../src/logging/requestSerializer.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_LIVE_POLLING_ENABLED: "false"
};

describe("request log serializer", () => {
  const request = {
    method: "GET",
    url: "/v1/preferences?deviceId=device_abc&hub.verify_token=secret&code=oauth&state=xyz",
    headers: { "accept-version": "1.0.0" },
    host: "api.example.test",
    ip: "203.0.113.7",
    socket: { remotePort: 4321 }
  };

  it("strips the query string but keeps the path and the default fields", () => {
    const serialized = serializeRequestForLog(request);
    const text = JSON.stringify(serialized);

    expect(text).not.toContain("device_abc");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("oauth");
    expect(text).not.toContain("xyz");
    expect(serialized.url).toBe("/v1/preferences?[redacted]");
    expect(serialized).toMatchObject({
      method: "GET",
      version: "1.0.0",
      host: "api.example.test",
      remoteAddress: "203.0.113.7",
      remotePort: 4321
    });
  });

  it("leaves urls without a query untouched", () => {
    expect(serializeRequestForLog({ ...request, url: "/health" }).url).toBe("/health");
  });
});

describe("swagger docs exposure", () => {
  it("does not register /docs in production", async () => {
    const app = await buildApp({ env: { ...baseEnv, NODE_ENV: "production" }, useProcessEnv: false });
    for (const url of ["/docs", "/docs/json"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(404);
    }
    await app.close();
  });

  it.each(["development", "test"])("serves /docs/json when NODE_ENV is %s", async (nodeEnv) => {
    const app = await buildApp({ env: { ...baseEnv, NODE_ENV: nodeEnv }, useProcessEnv: false });
    const response = await app.inject({ method: "GET", url: "/docs/json" });
    await app.close();
    expect(response.statusCode).toBe(200);
  });
});
