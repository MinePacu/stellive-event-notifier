import type { SummaryNotificationRepository } from "./summaryNotificationRepository.js";
import type { DeliveryAttemptRepository } from "../repositories/deliveryAttemptRepository.js";
import type PlatformEventRepository from "../repositories/platformEventRepository.js";

export interface SummaryNotificationBackfillResult {
  candidates: number;
  enqueued: number;
  missingEvents: number;
}

export async function backfillRecentSkippedSummaries(
  dependencies: {
    deliveryAttempts: Pick<DeliveryAttemptRepository, "listRecentSkippedSummaryCandidates">;
    platformEvents: Pick<PlatformEventRepository, "findById">;
    summaries: Pick<SummaryNotificationRepository, "enqueue">;
  },
  input: { now?: Date; limit?: number } = {}
): Promise<SummaryNotificationBackfillResult> {
  const now = input.now ?? new Date();
  const candidates = await dependencies.deliveryAttempts.listRecentSkippedSummaryCandidates({
    since: new Date(now.getTime() - 10 * 60_000),
    until: now,
    limit: input.limit
  });
  let enqueued = 0;
  let missingEvents = 0;
  for (const candidate of candidates) {
    const event = await dependencies.platformEvents.findById(candidate.eventId);
    if (!event) {
      missingEvents += 1;
      continue;
    }
    const result = await dependencies.summaries.enqueue({
      event,
      deviceId: candidate.deviceId,
      evaluatedAt: candidate.attemptedAt
    });
    if (result.created) enqueued += 1;
  }
  return { candidates: candidates.length, enqueued, missingEvents };
}
