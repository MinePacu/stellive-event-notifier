CREATE TABLE "ServiceAnnouncement" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "publicationState" TEXT NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "targetPlatforms" JSONB NOT NULL,
  "minimumAppVersion" TEXT,
  "maximumAppVersion" TEXT,
  "appDeepLink" TEXT,
  "externalUrl" TEXT,
  "actionLabel" TEXT,
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushStatus" TEXT NOT NULL DEFAULT 'not_requested',
  "pushSentAt" TIMESTAMP(3),
  "attentionRevision" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAnnouncementPushAttempt" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "attentionRevision" INTEGER NOT NULL,
  "topic" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "providerErrorCode" TEXT,
  "retryAfterMs" INTEGER,
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ServiceAnnouncementPushAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAnnouncementAuditLog" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceAnnouncementAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceAnnouncement_publicationState_publishedAt_idx" ON "ServiceAnnouncement"("publicationState", "publishedAt");
CREATE INDEX "ServiceAnnouncement_type_publicationState_idx" ON "ServiceAnnouncement"("type", "publicationState");
CREATE INDEX "ServiceAnnouncement_severity_publicationState_idx" ON "ServiceAnnouncement"("severity", "publicationState");
CREATE INDEX "ServiceAnnouncement_expiresAt_publicationState_idx" ON "ServiceAnnouncement"("expiresAt", "publicationState");
CREATE INDEX "ServiceAnnouncement_deletedAt_publicationState_idx" ON "ServiceAnnouncement"("deletedAt", "publicationState");
CREATE INDEX "ServiceAnnouncementPushAttempt_announcementId_requestedAt_idx" ON "ServiceAnnouncementPushAttempt"("announcementId", "requestedAt");
CREATE INDEX "ServiceAnnouncementPushAttempt_status_requestedAt_idx" ON "ServiceAnnouncementPushAttempt"("status", "requestedAt");
CREATE INDEX "ServiceAnnouncementPushAttempt_announcementId_attentionRevision_status_idx" ON "ServiceAnnouncementPushAttempt"("announcementId", "attentionRevision", "status");
CREATE INDEX "ServiceAnnouncementAuditLog_announcementId_createdAt_idx" ON "ServiceAnnouncementAuditLog"("announcementId", "createdAt");
CREATE INDEX "ServiceAnnouncementAuditLog_action_createdAt_idx" ON "ServiceAnnouncementAuditLog"("action", "createdAt");

ALTER TABLE "ServiceAnnouncementPushAttempt"
  ADD CONSTRAINT "ServiceAnnouncementPushAttempt_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "ServiceAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
