import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { ServiceAnnouncementSender, serviceAnnouncementTopic, type ServiceAnnouncementInput } from "../src/push/serviceAnnouncement.js";

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token"
};

describe("service announcement topics", () => {
  it("records provider-level delivery metadata without payload or token data", async () => {
    const logs: unknown[] = [];
    const sender = new ServiceAnnouncementSender(
      { async sendToTopic() { return { status: "sent", providerMessageId: "message-1" }; } } as never,
      { async record(input) { logs.push(input); } },
      () => new Date("2026-07-06T00:00:00.000Z")
    );

    await sender.send({ scope: "service_all", title: "공지", body: "서비스 공지", appDeepLink: "stellivehub://announcements/1", platformUrl: "" });

    expect(logs).toEqual([expect.objectContaining({
      source: "fcm",
      operation: "service_announcement:service_all",
      resultStatus: "ok",
      requestedAt: new Date("2026-07-06T00:00:00.000Z")
    })]);
    expect(JSON.stringify(logs)).not.toContain("서비스 공지");
  });

  it.each(["service_all", "service_incident", "service_maintenance", "service_version_update"] as const)(
    "maps allowlisted scope %s to an internal topic",
    (scope) => expect(serviceAnnouncementTopic(scope)).toBe(scope)
  );

  it("requires internal auth and rejects arbitrary or user-fanout fields", async () => {
    const sent: ServiceAnnouncementInput[] = [];
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: {
        dependencies: {
          serviceAnnouncements: { async send(input) { sent.push(input); return { status: "sent" }; } }
        }
      }
    });
    const valid = { scope: "service_all", title: "공지", body: "서비스 공지", appDeepLink: "stellivehub://announcements/1", platformUrl: "" };

    expect((await app.inject({ method: "POST", url: "/v1/internal/notifications/service-announcements", payload: valid })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/internal/notifications/service-announcements", headers: { authorization: "Bearer internal-test-token" }, payload: { ...valid, scope: "member_1" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/internal/notifications/service-announcements", headers: { authorization: "Bearer internal-test-token" }, payload: { ...valid, memberId: "member-1" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/internal/notifications/service-announcements", headers: { authorization: "Bearer internal-test-token" }, payload: valid })).statusCode).toBe(200);
    expect(sent).toEqual([valid]);
    await app.close();
  });
});
