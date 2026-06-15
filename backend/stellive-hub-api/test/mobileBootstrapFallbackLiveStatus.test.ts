import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

describe("mobile bootstrap fallback live status", () => {
  it("includes liveStatus rows when the fallback bootstrap path is used", async () => {
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          liveStatus: {
            listDiagnostics: async () => [
              {
                memberId: "yuzuha-riko",
                generationId: "gen3",
                platform: "chzzk" as const,
                isLive: true,
                title: "집에 오락기계 하나 샀습니다",
                viewerCount: 5149,
                startedAt: "2026-06-15T07:06:04.000Z",
                platformUrl: "https://chzzk.naver.com/live/8fd39bb8de623317de90654718638b10",
                lastCheckedAt: "2026-06-15T08:00:00.000Z",
                sourceVerificationState: "verified" as const,
              },
            ],
          },
        },
      },
    });

    const response = await app.inject({ method: "GET", url: "/v1/bootstrap?platform=android" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      liveStatus: [
        {
          memberId: "yuzuha-riko",
          isLive: true,
          viewerCount: 5149,
          sourceVerificationState: "verified",
        },
      ],
    });
  });

  it("serializes an empty liveStatus array instead of omitting the field", async () => {
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          liveStatus: {
            listDiagnostics: async () => [],
          },
        },
      },
    });

    const response = await app.inject({ method: "GET", url: "/v1/bootstrap?platform=ios" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("liveStatus", []);
  });
});
