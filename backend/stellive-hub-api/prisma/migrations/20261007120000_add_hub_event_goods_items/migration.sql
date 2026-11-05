CREATE TABLE "HubEventGoodsItem" (
    "id" TEXT NOT NULL,
    "hubEventId" TEXT NOT NULL,
    "scheduleItemId" TEXT,
    "name" TEXT NOT NULL,
    "groupLabel" TEXT,
    "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceKrw" INTEGER,
    "priceNote" TEXT,
    "salesChannel" TEXT NOT NULL,
    "purchaseLimit" INTEGER,
    "limitNote" TEXT,
    "isBonus" BOOLEAN NOT NULL DEFAULT false,
    "purchaseUrl" TEXT,
    "image" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubEventGoodsItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HubEventGoodsItem_hubEventId_sortOrder_idx"
ON "HubEventGoodsItem"("hubEventId", "sortOrder");

CREATE INDEX "HubEventGoodsItem_scheduleItemId_idx"
ON "HubEventGoodsItem"("scheduleItemId");

ALTER TABLE "HubEventGoodsItem"
ADD CONSTRAINT "HubEventGoodsItem_hubEventId_fkey"
FOREIGN KEY ("hubEventId") REFERENCES "HubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubEventGoodsItem"
ADD CONSTRAINT "HubEventGoodsItem_scheduleItemId_fkey"
FOREIGN KEY ("scheduleItemId") REFERENCES "HubEventScheduleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
