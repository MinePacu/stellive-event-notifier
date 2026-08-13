BEGIN;

-- A push token is an installation credential and may have only one active owner.
-- Remove unusable tokens first without changing their existing status.
UPDATE "Device"
SET
  "deviceToken" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "deviceToken" IS NOT NULL
  AND "tokenStatus" <> 'active';

-- Existing active duplicates cannot be tied to a physical installation with
-- certainty. Keep the most recently observed row using a deterministic order.
WITH ranked_tokens AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "deviceToken"
      ORDER BY
        "updatedAt" DESC,
        "lastSeenAt" DESC NULLS LAST,
        "createdAt" DESC,
        "id" ASC
    ) AS owner_rank
  FROM "Device"
  WHERE "deviceToken" IS NOT NULL
    AND "tokenStatus" = 'active'
)
UPDATE "Device" AS device
SET
  "deviceToken" = NULL,
  "tokenStatus" = 'missing',
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_tokens
WHERE device."id" = ranked_tokens."id"
  AND ranked_tokens.owner_rank > 1;

CREATE UNIQUE INDEX "Device_deviceToken_key" ON "Device"("deviceToken");

COMMIT;
