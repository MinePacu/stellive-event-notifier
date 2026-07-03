import { hostname } from "node:os";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("health route", () => {
  it("identifies the API worker serving the request", async () => {
    const app = await buildApp({ useProcessEnv: false });

    const response = await app.inject({ method: "GET", url: "/health" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "stellive-hub-api",
      pid: process.pid,
      hostname: hostname(),
      uptimeSeconds: expect.any(Number),
      nodeEnv: "test",
      version: "0.1.0"
    });
  });
});
