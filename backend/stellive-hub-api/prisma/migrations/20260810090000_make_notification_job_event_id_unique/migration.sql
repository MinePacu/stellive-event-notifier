-- Retain exactly one existing job per event without reviving a less advanced lifecycle.
-- Ties are deterministic so every deployment keeps the same survivor.
WITH ranked_jobs AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "eventId"
      ORDER BY
        CASE "status"
          WHEN 'completed' THEN 0
          WHEN 'locked' THEN 1
          WHEN 'queued' THEN 2
          WHEN 'failed' THEN 3
          ELSE 4
        END ASC,
        "attempts" DESC,
        "runAfter" ASC,
        "createdAt" ASC,
        "id" ASC
    ) AS duplicate_rank
  FROM "NotificationJob"
)
DELETE FROM "NotificationJob" AS job
USING ranked_jobs
WHERE job."id" = ranked_jobs."id"
  AND ranked_jobs.duplicate_rank > 1;

-- Recover only notifications that remain safe to enqueue automatically:
-- recent immediate events, plus future Hub schedule candidates regardless of age.
INSERT INTO "NotificationJob" (
  "id",
  "eventId",
  "priority",
  "status",
  "runAfter",
  "lockedAt",
  "lockedBy",
  "attempts",
  "lastError",
  "createdAt",
  "updatedAt"
)
SELECT
  'recovered_' || md5(event."id"),
  event."id",
  CASE WHEN event."realtimeEligible" THEN 1 ELSE 5 END,
  'queued',
  CASE
    WHEN event."source" = 'hub_event'
      AND COALESCE(event."metadata" ? 'scheduleItemId', FALSE)
      THEN event."occurredAt"
    ELSE CURRENT_TIMESTAMP
  END,
  NULL,
  NULL,
  0,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PlatformEvent" AS event
LEFT JOIN "NotificationJob" AS job ON job."eventId" = event."id"
WHERE job."id" IS NULL
  AND (
    (
      event."source" = 'hub_event'
      AND COALESCE(event."metadata" ? 'scheduleItemId', FALSE)
      AND event."occurredAt" > CURRENT_TIMESTAMP
    )
    OR (
      NOT (
        event."source" = 'hub_event'
        AND COALESCE(event."metadata" ? 'scheduleItemId', FALSE)
      )
      AND event."receivedAt" >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'
      AND event."receivedAt" <= CURRENT_TIMESTAMP
    )
  );

CREATE UNIQUE INDEX "NotificationJob_eventId_key"
ON "NotificationJob"("eventId");

DROP INDEX IF EXISTS "NotificationJob_eventId_idx";
