-- La tabla Cliente nunca se usó: los pedidos guardan el nombre en "customer".
-- Se elimina junto con la columna Order.clienteId que apuntaba a ella.
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_clienteId_fkey";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "clienteId";
DROP TABLE IF EXISTS "Cliente";
