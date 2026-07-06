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
  constructor(private readonly fcmClient: FcmClient) {}

  send(input: ServiceAnnouncementInput): Promise<PushSendResult> {
    return this.fcmClient.sendToTopic({
      topic: serviceAnnouncementTopic(input.scope),
      title: input.title,
      body: input.body,
      appDeepLink: input.appDeepLink,
      platformUrl: input.platformUrl
    });
  }
}
