import type { FcmClient, PushSendResult } from "./fcmClient.js";

export const serviceAnnouncementScopes = [
  "service_all",
  "service_incident",
  "service_maintenance",
  "service_version_update"
] as const;

export type ServiceAnnouncementScope = (typeof serviceAnnouncementScopes)[number];

export interface ServiceAnnouncementInput {
  scope: ServiceAnnouncementScope;
  title: string;
  body: string;
  appDeepLink: string;
  platformUrl: string;
}

const topicByScope: Record<ServiceAnnouncementScope, string> = {
  service_all: "service_all",
  service_incident: "service_incident",
  service_maintenance: "service_maintenance",
  service_version_update: "service_version_update"
};

export function serviceAnnouncementTopic(scope: ServiceAnnouncementScope): string {
  return topicByScope[scope];
}

export function isServiceAnnouncementScope(value: unknown): value is ServiceAnnouncementScope {
  return typeof value === "string" && serviceAnnouncementScopes.includes(value as ServiceAnnouncementScope);
}

export class ServiceAnnouncementSender {
  constructor(
    private readonly fcmClient: FcmClient,
    private readonly log?: { record(input: {
      source: string;
      operation: string;
      method: string;
      url: string;
      resultStatus: "ok" | "rate_limited" | "auth_required" | "unknown_error";
      rateLimited?: boolean;
      errorCode?: string;
      errorReason?: string;
      requestedAt: Date;
      completedAt: Date;
    }): Promise<void> },
    private readonly now: () => Date = () => new Date()
  ) {}

  async send(input: ServiceAnnouncementInput): Promise<PushSendResult> {
    const requestedAt = this.now();
    const result = await this.fcmClient.sendToTopic({
      topic: serviceAnnouncementTopic(input.scope),
      title: input.title,
      body: input.body,
      appDeepLink: input.appDeepLink,
      platformUrl: input.platformUrl
    });
    const rateLimited = result.providerErrorCode === "fcm_rate_limited" || result.providerErrorCode === "messaging/quota-exceeded";
    const resultStatus = result.status === "sent"
      ? "ok"
      : rateLimited
        ? "rate_limited"
        : result.status === "disabled"
          ? "auth_required"
          : "unknown_error";
    await this.log?.record({
      source: "fcm",
      operation: `service_announcement:${input.scope}`,
      method: "POST",
      url: "https://fcm.googleapis.com/v1/messages:send",
      resultStatus,
      rateLimited,
      errorCode: result.providerErrorCode,
      errorReason: result.reason,
      requestedAt,
      completedAt: this.now()
    });
    return result;
  }
}
