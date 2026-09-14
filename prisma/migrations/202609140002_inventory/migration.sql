-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "operationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "operationToken" TEXT;

-- AlterTable
ALTER TABLE "InventoryAdjustment" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';


-- Historical rows predate pending requests and represent completed operations.
UPDATE "InventoryAdjustment" SET "status" = 'APPLIED';
