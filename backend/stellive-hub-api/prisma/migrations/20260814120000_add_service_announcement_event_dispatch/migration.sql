ALTER TABLE "ServiceAnnouncementPushAttempt"
  ADD COLUMN "eventId" TEXT;

ALTER TABLE "ServiceAnnouncementPushAttempt"
  ALTER COLUMN "topic" DROP NOT NULL;

CREATE UNIQUE INDEX "ServiceAnnouncementPushAttempt_eventId_key"
  ON "ServiceAnnouncementPushAttempt"("eventId");
