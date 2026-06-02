import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("live status route", () => {
  it("returns a startedAt timestamp for current CHZZK live entries", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/live-status" });
    await app.close();

    expect(response.statusCode).toBe(200);
    const statuses = response.json();
    const live = statuses.find((status: { memberId: string }) => status.memberId === "ayatsuno-yuni");

    expect(live).toMatchObject({ isLive: true, platform: "chzzk" });
    expect(live.startedAt).toBe("2026-06-02T09:00:00.000Z");
  });
});
