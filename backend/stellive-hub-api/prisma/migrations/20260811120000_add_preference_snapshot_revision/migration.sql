-- CreateTable
CREATE TABLE "NotificationPreferenceSnapshot" (
    "deviceId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreferenceSnapshot_pkey" PRIMARY KEY ("deviceId")
);

-- Backfill an initial revision for every existing preference snapshot.
INSERT INTO "NotificationPreferenceSnapshot" ("deviceId", "revision", "updatedAt")
SELECT "deviceId", 0, MAX("updatedAt")
FROM "NotificationPreference"
GROUP BY "deviceId";

-- CreateIndex
CREATE INDEX "NotificationPreference_deviceId_idx" ON "NotificationPreference"("deviceId");
