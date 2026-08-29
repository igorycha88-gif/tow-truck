-- AlterTable
ALTER TABLE "ClickEvent" ADD COLUMN     "city" TEXT,
ADD COLUMN     "eventType" TEXT NOT NULL DEFAULT 'click_phone',
ADD COLUMN     "referer" TEXT,
ADD COLUMN     "service" TEXT;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "city" TEXT,
ADD COLUMN     "referer" TEXT;

-- CreateIndex
CREATE INDEX "ClickEvent_eventType_createdAt_idx" ON "ClickEvent"("eventType", "createdAt");

