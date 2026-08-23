import type { PushTargetDevice } from "./pushSender.js";
import { serviceAnnouncementScopes } from "./serviceAnnouncement.js";

export interface LegacyServiceTopicCleanupSummary {
  scanned: number;
  cleaned: number;
  failed: number;
  retried: number;
}

export async function cleanupLegacyServiceTopics(input: {
  devices: { listPushTargetsPage(input: { cursor?: string; limit: number }): Promise<{ items: PushTargetDevice[]; nextCursor: string | null }> };
  fcmClient: { setTopicSubscriptions(input: { token: string; topics: readonly string[]; enabled: boolean }): Promise<{ status: string }> };
  pageSize?: number;
  maxAttempts?: number;
}): Promise<LegacyServiceTopicCleanupSummary> {
  const summary: LegacyServiceTopicCleanupSummary = { scanned: 0, cleaned: 0, failed: 0, retried: 0 };
  let cursor: string | undefined;
  const maxAttempts = Math.max(1, Math.trunc(input.maxAttempts ?? 3));
  do {
    const page = await input.devices.listPushTargetsPage({ cursor, limit: input.pageSize ?? 500 });
    for (const device of page.items) {
      summary.scanned += 1;
      let cleaned = false;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (attempt > 1) summary.retried += 1;
        try {
          const result = await input.fcmClient.setTopicSubscriptions({
            token: device.pushToken,
            topics: serviceAnnouncementScopes,
            enabled: false,
          });
          if (result.status === "synced" || result.status === "disabled") {
            cleaned = true;
            break;
          }
        } catch {
          // Retry without exposing a token in logs or metrics.
        }
      }
      if (cleaned) summary.cleaned += 1;
      else summary.failed += 1;
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return summary;
}
