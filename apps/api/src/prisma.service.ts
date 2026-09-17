import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Ancla siempre a la carpeta apps/api (donde vive .env), nunca a process.cwd() ni a un
// número fijo de "..": según cómo se ejecute, __dirname cae en src/ (ts-node), dist/src/
// (build normal, que preserva la subcarpeta src) o dist/ (bundle plano) — un solo ".."
// fijo se rompe en alguno de esos casos. Subimos el árbol hasta encontrar el .env real.
function findApiRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, '.env'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const API_ROOT = findApiRoot(__dirname);

function readDatabaseUrlFromEnvFile(): string | undefined {
  try {
    const contents = fs.readFileSync(path.join(API_ROOT, '.env'), 'utf-8');
    return contents.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1];
  } catch {
    return undefined;
  }
}

function resolveDatabasePath(): string {
  const raw =
    process.env.DATABASE_URL ?? readDatabaseUrlFromEnvFile() ?? 'file:./en_que_la_negra.db';
  return path.resolve(API_ROOT, raw.replace(/^file:/, ''));
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaBetterSqlite3({ url: resolveDatabasePath() });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
