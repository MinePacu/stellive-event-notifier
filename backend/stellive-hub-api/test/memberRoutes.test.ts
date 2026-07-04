import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { Member } from "../src/types.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("member routes", () => {
  it("shares one hydrated member snapshot across list and detail reads", async () => {
    const hydrateMembers = vi.fn(async (members: Member[]) => members.map((member) => ({
      ...member,
      profileImageUrl: `https://yt.example/${member.id}.jpg`,
    })));
    const app = await buildApp({
      useProcessEnv: false,
      appRoutes: { dependencies: { memberProfileImages: { hydrateMembers } } },
    });
    apps.push(app);

    const firstList = await app.inject({ method: "GET", url: "/v1/members" });
    const secondList = await app.inject({ method: "GET", url: "/v1/members" });
    const detail = await app.inject({ method: "GET", url: "/v1/members/ayatsuno-yuni" });

    expect(firstList.statusCode).toBe(200);
    expect(secondList.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().profileImageUrl).toBe("https://yt.example/ayatsuno-yuni.jpg");
    expect(hydrateMembers).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing not-found response for unknown member IDs", async () => {
    const hydrateMembers = vi.fn(async (members: Member[]) => members);
    const app = await buildApp({
      useProcessEnv: false,
      appRoutes: { dependencies: { memberProfileImages: { hydrateMembers } } },
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/v1/members/not-a-member" });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe("member not found");
  });
});
