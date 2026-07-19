WITH ranked_primary AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "hubEventId"
            ORDER BY "sortOrder" ASC, "startsAt" ASC, "createdAt" ASC, "id" ASC
        ) AS priority
    FROM "HubEventScheduleItem"
    WHERE "isPrimary" = TRUE AND "cancelledAt" IS NULL
)
UPDATE "HubEventScheduleItem" AS schedule_item
SET "isPrimary" = FALSE
FROM ranked_primary
WHERE schedule_item."id" = ranked_primary."id"
  AND ranked_primary.priority > 1;

CREATE UNIQUE INDEX "HubEventScheduleItem_one_active_primary"
ON "HubEventScheduleItem" ("hubEventId")
WHERE "isPrimary" = TRUE AND "cancelledAt" IS NULL;

CREATE TABLE "HubEventExternalLink" (
    "id" TEXT NOT NULL,
    "hubEventId" TEXT,
    "scheduleItemId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubEventExternalLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HubEventExternalLink_exactly_one_owner" CHECK (
        ("hubEventId" IS NOT NULL AND "scheduleItemId" IS NULL)
        OR ("hubEventId" IS NULL AND "scheduleItemId" IS NOT NULL)
    )
);

ALTER TABLE "HubEventExternalLink"
ADD CONSTRAINT "HubEventExternalLink_hubEventId_fkey"
FOREIGN KEY ("hubEventId") REFERENCES "HubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubEventExternalLink"
ADD CONSTRAINT "HubEventExternalLink_scheduleItemId_fkey"
FOREIGN KEY ("scheduleItemId") REFERENCES "HubEventScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "HubEventExternalLink_hubEventId_sortOrder_idx"
ON "HubEventExternalLink"("hubEventId", "sortOrder");

CREATE INDEX "HubEventExternalLink_scheduleItemId_sortOrder_idx"
ON "HubEventExternalLink"("scheduleItemId", "sortOrder");

CREATE UNIQUE INDEX "HubEventExternalLink_hubEventId_url_key"
ON "HubEventExternalLink"("hubEventId", "url")
WHERE "hubEventId" IS NOT NULL;

CREATE UNIQUE INDEX "HubEventExternalLink_scheduleItemId_url_key"
ON "HubEventExternalLink"("scheduleItemId", "url")
WHERE "scheduleItemId" IS NOT NULL;

INSERT INTO "HubEventExternalLink" (
    "id", "hubEventId", "kind", "label", "url", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    'legacy_parent_purchase_' || event."id",
    event."id",
    'purchase',
    NULL,
    BTRIM(event."purchaseUrl"),
    0,
    event."createdAt",
    event."updatedAt"
FROM "HubEvent" AS event
WHERE event."purchaseUrl" IS NOT NULL AND BTRIM(event."purchaseUrl") <> '';

INSERT INTO "HubEventExternalLink" (
    "id", "hubEventId", "kind", "label", "url", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    'legacy_parent_ticket_' || event."id",
    event."id",
    'ticket',
    NULL,
    BTRIM(event."ticketUrl"),
    1,
    event."createdAt",
    event."updatedAt"
FROM "HubEvent" AS event
WHERE event."ticketUrl" IS NOT NULL
  AND BTRIM(event."ticketUrl") <> ''
  AND NOT EXISTS (
      SELECT 1 FROM "HubEventExternalLink" AS link
      WHERE link."hubEventId" = event."id" AND link."url" = BTRIM(event."ticketUrl")
  );

INSERT INTO "HubEventExternalLink" (
    "id", "hubEventId", "kind", "label", "url", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    'legacy_parent_source_' || event."id",
    event."id",
    'source',
    NULLIF(BTRIM(event."sourceLabel"), ''),
    BTRIM(event."sourceUrl"),
    2,
    event."createdAt",
    event."updatedAt"
FROM "HubEvent" AS event
WHERE BTRIM(event."sourceUrl") <> ''
  AND NOT EXISTS (
      SELECT 1 FROM "HubEventExternalLink" AS link
      WHERE link."hubEventId" = event."id" AND link."url" = BTRIM(event."sourceUrl")
  );

INSERT INTO "HubEventExternalLink" (
    "id", "scheduleItemId", "kind", "label", "url", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    'legacy_schedule_action_' || schedule_item."id",
    schedule_item."id",
    CASE schedule_item."kind"
        WHEN 'sales_open' THEN 'purchase'
        WHEN 'ticket_open' THEN 'ticket'
        WHEN 'deadline' THEN 'reservation'
        WHEN 'main_window' THEN 'reservation'
        WHEN 'announcement' THEN 'source'
        ELSE 'content'
    END,
    NULL,
    BTRIM(schedule_item."actionUrl"),
    0,
    schedule_item."createdAt",
    schedule_item."updatedAt"
FROM "HubEventScheduleItem" AS schedule_item
WHERE schedule_item."actionUrl" IS NOT NULL AND BTRIM(schedule_item."actionUrl") <> '';

INSERT INTO "HubEventExternalLink" (
    "id", "scheduleItemId", "kind", "label", "url", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    'legacy_schedule_source_' || schedule_item."id",
    schedule_item."id",
    'source',
    NULLIF(BTRIM(schedule_item."sourceLabel"), ''),
    BTRIM(schedule_item."sourceUrl"),
    1,
    schedule_item."createdAt",
    schedule_item."updatedAt"
FROM "HubEventScheduleItem" AS schedule_item
WHERE schedule_item."sourceUrl" IS NOT NULL
  AND BTRIM(schedule_item."sourceUrl") <> ''
  AND NOT EXISTS (
      SELECT 1 FROM "HubEventExternalLink" AS link
      WHERE link."scheduleItemId" = schedule_item."id" AND link."url" = BTRIM(schedule_item."sourceUrl")
  );
