-- CreateTable (см. ADR-002: трекинг визитов)
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "page" TEXT NOT NULL DEFAULT 'home',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_createdAt_idx" ON "Visit"("createdAt");

-- CreateIndex
CREATE INDEX "Visit_page_idx" ON "Visit"("page");
