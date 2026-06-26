import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

async function buildRouteApp() {
  return buildApp({
    env: routeEnv,
    useProcessEnv: false,
  });
}

describe("song read routes", () => {
  it("returns mobile song facets with only supported generation filters", async () => {
    const app = await buildRouteApp();
    const response = await app.inject({ method: "GET", url: "/v1/songs/facets" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=60");
    expect(response.json().generationFilters.map((filter: { id: string }) => filter.id)).toEqual(["all", "gen1", "gen2", "gen3"]);
  });

  it("rejects unsupported mobile song generation filters", async () => {
    const app = await buildRouteApp();
    const response = await app.inject({ method: "GET", url: "/v1/songs?generationId=gamja" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "unsupported_song_generation_filter" });
  });

  it("rejects internal unknown song type for mobile list filters", async () => {
    const app = await buildRouteApp();
    const response = await app.inject({ method: "GET", url: "/v1/songs?type=unknown" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "unsupported_song_type_filter" });
  });

  it("returns cached mobile song list DTOs without calling YouTube", async () => {
    const app = await buildRouteApp();
    const response = await app.inject({ method: "GET", url: "/v1/songs?generationId=gen2&type=cover&limit=10" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=30");
    expect(response.json()).toMatchObject({
      items: [],
      nextCursor: null,
      serverTime: expect.any(String),
    });
  });
});
