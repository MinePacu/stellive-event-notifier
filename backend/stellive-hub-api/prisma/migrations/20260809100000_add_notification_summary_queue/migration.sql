CREATE TABLE "NotificationSummaryBucket" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "deliverAfter" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationSummaryBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationSummaryItem" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationSummaryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationSummaryBucket_deviceId_topicKey_windowStart_key"
ON "NotificationSummaryBucket"("deviceId", "topicKey", "windowStart");
CREATE INDEX "NotificationSummaryBucket_status_deliverAfter_idx"
ON "NotificationSummaryBucket"("status", "deliverAfter");
CREATE INDEX "NotificationSummaryBucket_lockedAt_idx"
ON "NotificationSummaryBucket"("lockedAt");
CREATE UNIQUE INDEX "NotificationSummaryItem_bucketId_eventId_key"
ON "NotificationSummaryItem"("bucketId", "eventId");
CREATE UNIQUE INDEX "NotificationSummaryItem_deviceId_eventId_key"
ON "NotificationSummaryItem"("deviceId", "eventId");
CREATE INDEX "NotificationSummaryItem_bucketId_status_idx"
ON "NotificationSummaryItem"("bucketId", "status");

ALTER TABLE "NotificationSummaryItem"
ADD CONSTRAINT "NotificationSummaryItem_bucketId_fkey"
FOREIGN KEY ("bucketId") REFERENCES "NotificationSummaryBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
