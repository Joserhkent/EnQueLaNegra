import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Solo contra una base de prueba local: sin TEST_DATABASE_URL se salta
const TEST_DB = process.env.TEST_DATABASE_URL;
const describeSiHayBase =
  TEST_DB && !/supabase|pooler/i.test(TEST_DB) ? describe : describe.skip;

describeSiHayBase('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.DATABASE_URL = TEST_DB;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          status: string;
          database: { productosCarta: number };
        };
        expect(body.status).toBe('online');
        expect(body.database.productosCarta).toBeGreaterThan(0);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
