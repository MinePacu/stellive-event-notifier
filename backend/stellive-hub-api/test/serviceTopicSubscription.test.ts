import { describe, expect, it } from "vitest";
import { ServiceTopicSubscriptionService, serviceAnnouncementsEnabled } from "../src/push/serviceTopicSubscription.js";
import type { UserNotificationPreference } from "../src/types.js";

function globalPreference(overrides: Partial<UserNotificationPreference> = {}): UserNotificationPreference {
  return {
    deviceId: "device-1",
    scope: "global",
    enabled: true,
    explicitOverride: true,
    tapAction: "open_app",
    deliveryMode: "standard",
    serviceAnnouncementsEnabled: true,
    updatedAt: "2026-07-06T00:00:00.000Z",
    ...overrides
  };
}

describe("service topic subscription policy", () => {
  it("defaults on but global off and explicit opt-out unsubscribe", () => {
    expect(serviceAnnouncementsEnabled([])).toBe(true);
    expect(serviceAnnouncementsEnabled([globalPreference({ enabled: false })])).toBe(false);
    expect(serviceAnnouncementsEnabled([globalPreference({ serviceAnnouncementsEnabled: false })])).toBe(false);
  });

  it("syncs all allowlisted service topics without exposing the token", async () => {
    const calls: unknown[] = [];
    const service = new ServiceTopicSubscriptionService({
      fcmClient: {
        async setTopicSubscriptions(input) {
          calls.push(input);
          return { status: "synced" as const };
        }
      },
      devices: { async findPushTarget() { return undefined; } },
      preferences: { async listForDevice() { return []; } }
    });

    const result = await service.syncToken({ token: "private-device-token", preferences: [] });

    expect(result).toEqual({ status: "synced" });
    expect(calls).toEqual([{
      token: "private-device-token",
      enabled: true,
      topics: ["service_all", "service_incident", "service_maintenance", "service_version_update"]
    }]);
    expect(JSON.stringify(result)).not.toContain("private-device-token");
  });

  it("uses the current device preference when reconciling an opted-out owner", async () => {
    const calls: unknown[] = [];
    const service = new ServiceTopicSubscriptionService({
      fcmClient: {
        async setTopicSubscriptions(input) {
          calls.push(input);
          return { status: "synced" as const };
        },
      },
      devices: {
        async findPushTarget() {
          return {
            deviceId: "device-1",
            platform: "android" as const,
            pushProvider: "fcm" as const,
            pushToken: "private-device-token",
            tokenStatus: "active" as const,
          };
        },
      },
      preferences: {
        async listForDevice() {
          return [globalPreference({ enabled: false })];
        },
      },
    });

    await expect(service.syncDevice({ deviceId: "device-1" })).resolves.toEqual({ status: "synced" });
    expect(calls).toEqual([expect.objectContaining({ enabled: false })]);
  });
});
