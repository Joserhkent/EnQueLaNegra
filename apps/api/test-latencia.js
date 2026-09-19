require('dotenv').config();
const { Pool } = require('pg');

async function medir() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Conectando...');
  const t0 = Date.now();
  await pool.query('SELECT 1');
  console.log(`Primera consulta (incluye conexión): ${Date.now() - t0}ms`);

  for (let i = 1; i <= 5; i++) {
    const t1 = Date.now();
    await pool.query('SELECT 1');
    console.log(`Consulta ${i}: ${Date.now() - t1}ms`);
  }

  await pool.end();
}

medir();