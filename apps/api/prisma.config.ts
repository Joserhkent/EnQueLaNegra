import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node prisma/seed.ts",
  },
  // Las migraciones necesitan la conexión DIRECTA (no la del pooler transaccional),
  // que sí soporta los locks/DDL que usa Prisma Migrate. En runtime, la app se conecta
  // con DATABASE_URL (pooler) a través del adapter en PrismaService.
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
