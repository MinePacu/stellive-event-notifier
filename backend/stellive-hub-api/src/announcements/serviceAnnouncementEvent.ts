import type { AdminServiceAnnouncement } from "./serviceAnnouncementRepository.js";
import type { PlatformEvent } from "../types.js";
import { SERVICE_ANNOUNCEMENT_TARGETING_POLICY_VERSION } from "./serviceAnnouncementTargetPolicy.js";

export function buildServiceAnnouncementEvent(
  announcement: AdminServiceAnnouncement,
  dispatchId: string,
  now: Date,
): PlatformEvent {
  const id = `service-announcement:${announcement.id}:r${announcement.attentionRevision}:${dispatchId}`;
  return {
    id,
    source: "service_announcement",
    type: "service_announcement",
    memberId: "stellive-official",
    generationId: "official",
    title: announcement.title,
    body: announcement.summary || announcement.body,
    platformUrl: announcement.externalUrl || undefined,
    appDeepLink: announcement.appDeepLink || `stellivehub://announcements/${announcement.id}`,
    occurredAt: now.toISOString(),
    receivedAt: now.toISOString(),
    dedupeKey: id,
    rawPayload: {
      announcementId: announcement.id,
      dispatchId,
      targetPlatforms: announcement.targetPlatforms,
      minimumAppVersion: announcement.minimumAppVersion,
      maximumAppVersion: announcement.maximumAppVersion,
      targetingPolicyVersion: SERVICE_ANNOUNCEMENT_TARGETING_POLICY_VERSION,
      severity: announcement.severity,
      type: announcement.type,
    },
    realtimeEligible: false,
    deliveryMode: "standard",
  };
}
