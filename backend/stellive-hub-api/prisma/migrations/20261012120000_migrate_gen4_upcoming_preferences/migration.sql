UPDATE "NotificationPreference"
  SET "generationId" = 'gen4'
  WHERE "generationId" = 'gen4-upcoming';

DELETE FROM "NotificationPreference"
  WHERE "memberId" = 'gen4-placeholder';
