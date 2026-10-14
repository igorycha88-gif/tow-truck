-- ADR-014: трекинг пути клиента v2 — nullable-колонки, обратно совместимо.
-- Visit: сессии/визитор/просмотр, переходы, UTM, устройство, время на странице.
ALTER TABLE "Visit" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "Visit" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "Visit" ADD COLUMN "viewId" TEXT;
ALTER TABLE "Visit" ADD COLUMN "fromPage" TEXT;
ALTER TABLE "Visit" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "Visit" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "Visit" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "Visit" ADD COLUMN "device" TEXT;
ALTER TABLE "Visit" ADD COLUMN "dwellMs" INTEGER;

-- CreateIndex (ADR-014: сессии и визиторы)
CREATE INDEX "Visit_sessionId_idx" ON "Visit"("sessionId");
CREATE INDEX "Visit_visitorId_createdAt_idx" ON "Visit"("visitorId", "createdAt");

-- CreateIndex (уникальный ключ leave-обновления dwellMs)
CREATE UNIQUE INDEX "Visit_viewId_key" ON "Visit"("viewId");

-- ClickEvent: связка клика с сессией (воронка) и разрез по устройству (ADR-014).
ALTER TABLE "ClickEvent" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "ClickEvent" ADD COLUMN "device" TEXT;
