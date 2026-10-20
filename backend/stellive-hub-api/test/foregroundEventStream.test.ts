import { get, type ClientRequest, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

type App = Awaited<ReturnType<typeof buildApp>>;

const baseEnv = { DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub" };
let app: App | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function listen(enabled: boolean) {
  app = await buildApp({ env: { ...baseEnv, FOREGROUND_SSE_ENABLED: enabled }, useProcessEnv: false });
  await app.listen({ port: 0, host: "127.0.0.1" });
  return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}/v1/events/stream`;
}

// Resolves with the response and its first chunk (or full body when the server ends it).
function open(url: string): Promise<{ request: ClientRequest; response: IncomingMessage; body: string }> {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.once("data", (chunk: string) => {
        body += chunk;
        if (response.statusCode === 200) resolve({ request, response, body });
      });
      response.on("end", () => resolve({ request, response, body }));
    });
    request.on("error", reject);
  });
}

describe("GET /v1/events/stream", () => {
  it("does not exist when foreground SSE is disabled", async () => {
    app = await buildApp({ env: baseEnv, useProcessEnv: false });
    const response = await app.inject({ method: "GET", url: "/v1/events/stream" });
    expect(response.statusCode).toBe(404);
  });

  it("streams headers and a status event, caps streams per IP, and frees slots on disconnect", async () => {
    const url = await listen(true);

    const streams = [];
    for (let i = 0; i < 5; i += 1) streams.push(await open(url));
    expect(streams[0]!.response.statusCode).toBe(200);
    expect(streams[0]!.response.headers["content-type"]).toBe("text/event-stream");
    expect(streams[0]!.body).toMatch(/^event: status\ndata: \{/);

    const rejected = await open(url);
    expect(rejected.response.statusCode).toBe(429);
    expect(JSON.parse(rejected.body)).toEqual({ error: "realtime_capacity_reached" });

    streams[0]!.request.destroy();
    let reopened = await open(url);
    for (let attempt = 0; reopened.response.statusCode !== 200 && attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      reopened = await open(url);
    }
    expect(reopened.response.statusCode).toBe(200);
    // app.close() in afterEach must end the still-open streams instead of hanging.
  });
});
