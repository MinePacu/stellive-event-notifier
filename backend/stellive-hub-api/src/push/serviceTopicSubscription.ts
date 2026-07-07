import type { UserNotificationPreference } from "../types.js";
import type { PushTargetDevice } from "./pushSender.js";
import { serviceAnnouncementScopes } from "./serviceAnnouncement.js";

export type ServiceTopicSyncResult = {
  status: "synced" | "disabled" | "transient_failure" | "token_missing";
  failedTopics?: string[];
};

export function serviceAnnouncementsEnabled(preferences: UserNotificationPreference[]): boolean {
  const global = preferences
    .filter((preference) => preference.scope === "global")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (global?.enabled === false) return false;
  return global?.serviceAnnouncementsEnabled !== false;
}

export class ServiceTopicSubscriptionService {
  constructor(private readonly dependencies: {
    fcmClient: {
      setTopicSubscriptions(input: { token: string; topics: readonly string[]; enabled: boolean }): Promise<ServiceTopicSyncResult>;
    };
    devices: { findPushTarget(deviceId: string): Promise<PushTargetDevice | undefined> };
    preferences: { listForDevice(deviceId: string): Promise<UserNotificationPreference[]> };
  }) {}

  syncToken(input: { token: string; preferences: UserNotificationPreference[] }): Promise<ServiceTopicSyncResult> {
    return this.dependencies.fcmClient.setTopicSubscriptions({
      token: input.token,
      topics: serviceAnnouncementScopes,
      enabled: serviceAnnouncementsEnabled(input.preferences)
    });
  }

  async syncDevice(input: { deviceId: string; preferences?: UserNotificationPreference[] }): Promise<ServiceTopicSyncResult> {
    const device = await this.dependencies.devices.findPushTarget(input.deviceId);
    if (!device) return { status: "token_missing" };
    const preferences = input.preferences ?? await this.dependencies.preferences.listForDevice(input.deviceId);
    return this.syncToken({ token: device.pushToken, preferences });
  }
}
