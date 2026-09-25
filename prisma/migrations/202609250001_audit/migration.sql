ALTER TABLE "InventoryAdjustment" ADD COLUMN "actorSessionId" TEXT;
CREATE TABLE "AuditEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "shopId" TEXT NOT NULL,
 "category" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "subject" TEXT NOT NULL,
 "source" TEXT NOT NULL,
 "actor" TEXT NOT NULL,
 "details" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AuditEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuditEvent_shopId_category_createdAt_idx" ON "AuditEvent"("shopId", "category", "createdAt");
