ALTER TABLE "HubEventScheduleItem"
ADD COLUMN "title" TEXT;

UPDATE "HubEventScheduleItem"
SET "title" = "label"
WHERE "title" IS NULL OR BTRIM("title") = '';
