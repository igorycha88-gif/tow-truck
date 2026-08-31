-- Логирование согласия на обработку ПД (152-ФЗ, ЧТЗ_Неактивная_кнопка_до_согласия.md):
-- фиксируем момент согласия. Существующие заявки отправлялись с обязательным
-- чекбоксом согласия → бэкфилл consentAt = createdAt.

ALTER TABLE "Order" ADD COLUMN "consentAt" TIMESTAMP(3);

UPDATE "Order" SET "consentAt" = "createdAt";

ALTER TABLE "Order" ALTER COLUMN "consentAt" SET NOT NULL;
