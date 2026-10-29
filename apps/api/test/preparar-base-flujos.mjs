// Deja la base de TEST_DATABASE_URL vacía, con las migraciones aplicadas y el seed
// cargado, para que test/flujos.e2e-spec.ts arranque siempre desde el mismo estado.
// BORRA TODO lo que haya en esa base: nunca la apuntes a Supabase.
import { execSync } from 'node:child_process';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error('⛔ Define TEST_DATABASE_URL con una base Postgres de prueba (local).');
  process.exit(1);
}
if (/supabase|pooler/i.test(url)) {
  console.error('⛔ TEST_DATABASE_URL apunta a Supabase: usa una base de prueba local.');
  process.exit(1);
}

const db = new pg.Client({ connectionString: url });
await db.connect();
await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
await db.end();

const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit', env });
