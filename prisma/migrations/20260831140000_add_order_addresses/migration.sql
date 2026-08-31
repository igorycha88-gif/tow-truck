-- Блок «Адреса» в заявке (ЧТЗ_Блок_адресов_в_форме_заявки.md):
-- location заменяется на addressFrom (обязателен) + addressTo (необязателен).
-- Паттерн expand → backfill → contract: существующие заявки не теряются.

ALTER TABLE "Order" ADD COLUMN "addressFrom" TEXT;
ALTER TABLE "Order" ADD COLUMN "addressTo" TEXT;

UPDATE "Order"
SET "addressFrom" = COALESCE(NULLIF(TRIM("location"), ''), 'Не указан');

ALTER TABLE "Order" ALTER COLUMN "addressFrom" SET NOT NULL;
ALTER TABLE "Order" DROP COLUMN "location";
