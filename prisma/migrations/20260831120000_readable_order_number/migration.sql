-- Читаемый номер заявки (ADR-013): сквозной счётчик через PG sequence.
-- Отображаемый номер = formatOrderNumber(createdAt, number) → ГГГГММДД-N.
-- Детерминированно: существующие заявки получают номера 1..K по порядку создания,
-- счётчик продолжается с K+1.

ALTER TABLE "Order" ADD COLUMN "number" INTEGER;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn FROM "Order"
)
UPDATE "Order" o
SET "number" = ordered.rn
FROM ordered
WHERE o.id = ordered.id;

CREATE SEQUENCE "Order_number_seq" AS INTEGER START WITH 1;
SELECT setval('"Order_number_seq"', COALESCE((SELECT MAX("number") FROM "Order"), 0) + 1, false);

ALTER TABLE "Order" ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "number" SET DEFAULT nextval('"Order_number_seq"');
ALTER SEQUENCE "Order_number_seq" OWNED BY "Order"."number";
ALTER TABLE "Order" ADD CONSTRAINT "Order_number_key" UNIQUE ("number");
