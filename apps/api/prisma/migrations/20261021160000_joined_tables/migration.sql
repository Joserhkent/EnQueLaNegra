ALTER TABLE "Table"
ADD COLUMN IF NOT EXISTS "joinedToId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Table_joinedToId_fkey'
      AND conrelid = '"Table"'::regclass
  ) THEN
    ALTER TABLE "Table"
    ADD CONSTRAINT "Table_joinedToId_fkey"
    FOREIGN KEY ("joinedToId") REFERENCES "Table"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Table_joinedToId_idx" ON "Table"("joinedToId");

UPDATE "Table"
SET "capacity" = CASE "number"
  WHEN 1 THEN 2
  WHEN 2 THEN 5
  WHEN 3 THEN 4
  WHEN 4 THEN 4
  WHEN 5 THEN 2
  WHEN 6 THEN 4
  WHEN 7 THEN 4
  WHEN 8 THEN 2
  WHEN 9 THEN 2
  ELSE "capacity"
END
WHERE "number" BETWEEN 1 AND 9;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Table" AS extra_table
    WHERE extra_table."number" > 9
      AND (
        extra_table."status"::text <> 'AVAILABLE'
        OR extra_table."currentOrderId" IS NOT NULL
        OR extra_table."joinedToId" IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM "Table" AS joined_table
          WHERE joined_table."joinedToId" = extra_table."id"
        )
      )
  ) THEN
    RAISE EXCEPTION
      'No se pueden retirar las mesas mayores a 9: alguna sigue ocupada, tiene una cuenta abierta o pertenece a un grupo. Libera o cobra esas mesas y vuelve a ejecutar la migracion.';
  END IF;

  UPDATE "Order" AS historical_order
  SET "tableId" = NULL
  FROM "Table" AS extra_table
  WHERE historical_order."tableId" = extra_table."id"
    AND extra_table."number" > 9;

  DELETE FROM "Table"
  WHERE "number" > 9;
END $$;
