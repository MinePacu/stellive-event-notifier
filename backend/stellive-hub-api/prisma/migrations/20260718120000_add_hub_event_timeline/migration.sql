ALTER TABLE "HubEvent"
ADD COLUMN "scheduleMode" TEXT NOT NULL DEFAULT 'single_window';

CREATE TABLE "HubEventScheduleItem" (
    "id" TEXT NOT NULL,
    "hubEventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timePrecision" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "actionUrl" TEXT,
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "notificationEligible" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubEventScheduleItem_pkey" PRIMARY KEY ("id")
);

INSERT INTO "HubEventScheduleItem" (
    "id",
    "hubEventId",
    "kind",
    "label",
    "startsAt",
    "endsAt",
    "timePrecision",
    "timezone",
    "notificationEligible",
    "isPrimary",
    "sortOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_' || "id",
    "id",
    'main_window',
    '행사 일정',
    COALESCE("startsAt", "endsAt", "announcedAt", "createdAt"),
    CASE WHEN "startsAt" IS NULL THEN NULL ELSE "endsAt" END,
    'datetime',
    'Asia/Seoul',
    "notificationEligible",
    true,
    0,
    "createdAt",
    "updatedAt"
FROM "HubEvent";

CREATE INDEX "HubEventScheduleItem_hubEventId_sortOrder_idx"
ON "HubEventScheduleItem"("hubEventId", "sortOrder");

CREATE INDEX "HubEventScheduleItem_hubEventId_startsAt_idx"
ON "HubEventScheduleItem"("hubEventId", "startsAt");

CREATE INDEX "HubEventScheduleItem_startsAt_idx"
ON "HubEventScheduleItem"("startsAt");

CREATE INDEX "HubEventScheduleItem_cancelledAt_idx"
ON "HubEventScheduleItem"("cancelledAt");

ALTER TABLE "HubEventScheduleItem"
ADD CONSTRAINT "HubEventScheduleItem_hubEventId_fkey"
FOREIGN KEY ("hubEventId") REFERENCES "HubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
