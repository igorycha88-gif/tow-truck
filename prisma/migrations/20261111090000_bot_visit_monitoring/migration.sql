-- ADR-016: мониторинг посещений поисковыми ботами (nginx → BotVisit → Grafana).
-- Таблицу наполняет python-шиппер deploy/bots-shipper/ (VPS, cron), приложение
-- её не использует. Идемпотентность: id = md5(ts|ip|method|path|ua), шиппер
-- вставляет через COPY ... ON CONFLICT DO NOTHING.

CREATE TABLE "BotVisit" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "botName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "ip" TEXT,
    "method" TEXT,
    "path" TEXT NOT NULL,
    "query" TEXT,
    "status" INTEGER,
    "referer" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "BotVisit_pkey" PRIMARY KEY ("id")
);

-- Чтение Grafana: временные ряды, вендоры, имена ботов, страницы обхода.
CREATE INDEX "BotVisit_ts_idx" ON "BotVisit"("ts");
CREATE INDEX "BotVisit_botName_ts_idx" ON "BotVisit"("botName", "ts");
CREATE INDEX "BotVisit_vendor_ts_idx" ON "BotVisit"("vendor", "ts");
CREATE INDEX "BotVisit_path_ts_idx" ON "BotVisit"("path", "ts");
