/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- respuestas HTTP sin tipar */
// Flujos completos del POS contra una base de PRUEBA (nunca la de producción):
// login, permisos, caja, mesas, tandas, pagos, cobro, para llevar, cocina e inventario.
//
// Requiere una base Postgres vacía preparada con:
//   TEST_DATABASE_URL=postgresql://... npm run test:flujos
// (el script aplica las migraciones y carga el seed antes de correr).
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';

const TEST_DB = process.env.TEST_DATABASE_URL;
const describeSiHayBase = TEST_DB ? describe : describe.skip;
if (TEST_DB && /supabase|pooler/i.test(TEST_DB)) {
  throw new Error(
    'TEST_DATABASE_URL apunta a Supabase: usa una base de prueba local',
  );
}

describeSiHayBase('Flujos del POS (e2e)', () => {
  let app: INestApplication;
  let db: Pool;
  let jefe: string;
  let empleado: string;
  let prod: { id: string; sku: string; nombre: string; precio: number };
  let prod2: { id: string; sku: string; nombre: string; precio: number };
  let receta: { insumoId: string; cantidadRequerida: number }[];
  let mesas: { id: string; number: number }[];
  const extra = { insumoId: 'platano_maduro', cantidad: 1, precioExtra: 0.75 };

  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    token?: string,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())[method](`/api${path}`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return body ? req.send(body) : req;
  };
  const q = async <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => (await db.query(sql, params)).rows as T[];
  const stock = async (id: string) =>
    (
      await q<{ s: number }>(
        'select "stockActual" s from "Insumo" where id=$1',
        [id],
      )
    )[0].s;
  const item = (p: typeof prod, cantidad = 1, extras?: object[]) => ({
    productoId: p.id,
    sku: p.sku,
    nombre: p.nombre,
    precio: p.precio,
    cantidad,
    extras,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    // PrismaService lee DATABASE_URL al construirse, así que basta fijarla aquí
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // Misma configuración que main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    db = new Pool({ connectionString: TEST_DB });

    [prod] =
      await q(`select id,sku,nombre,precio from "Producto" p where "isAvailable"
      and exists (select 1 from "RecetaItem" r where r."productoId"=p.id) order by sku limit 1`);
    [prod2] = await q(
      `select id,sku,nombre,precio from "Producto" where "isAvailable" and id<>$1 order by sku limit 1`,
      [prod.id],
    );
    receta = await q(
      'select "insumoId","cantidadRequerida" from "RecetaItem" where "productoId"=$1',
      [prod.id],
    );
    mesas = await q(
      `select id,number from "Table" where status='AVAILABLE' order by number`,
    );
  });

  afterAll(async () => {
    await db?.end();
    await app?.close();
  });

  it('login: rechaza contraseña incorrecta y entrega el rol', async () => {
    await api('post', '/auth/login', undefined, {
      username: 'admin',
      password: 'mala',
    }).expect(401);
    const a = await api('post', '/auth/login', undefined, {
      username: 'admin',
      password: '123456',
    }).expect(201);
    const e = await api('post', '/auth/login', undefined, {
      username: 'empleado',
      password: '123456',
    }).expect(201);
    expect(a.body.user.role).toBe('jefe');
    expect(e.body.user.role).toBe('empleado');
    jefe = a.body.accessToken;
    empleado = e.body.accessToken;
    const me = await api('get', '/auth/me', empleado).expect(200);
    expect(me.body.password).toBeUndefined();
  });

  it('todas las lecturas piden token', async () => {
    for (const ruta of [
      '/productos',
      '/insumos',
      '/tables',
      '/pedidos',
      '/categorias',
      '/caja/estado',
    ]) {
      await api('get', ruta).expect(401);
      await api('get', ruta, empleado).expect(200);
    }
  });

  it('caja: no se abre dos veces ni con monto negativo', async () => {
    // El seed deja una caja abierta
    await api('post', '/caja/abrir', empleado, { montoInicial: 100 }).expect(
      400,
    );
    await api('post', '/caja/abrir', empleado, { montoInicial: -5 }).expect(
      400,
    );
  });

  it('mesa: dos aperturas simultáneas crean una sola cuenta', async () => {
    const [r1, r2] = await Promise.all([
      api('post', `/tables/${mesas[0].id}/open`, empleado, {}),
      api('post', `/tables/${mesas[0].id}/open`, empleado, {}),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 400]);
    const [{ c }] = await q<{ c: number }>(
      `select count(*)::int c from "Order" where "tableId"=$1 and status='OPEN'`,
      [mesas[0].id],
    );
    expect(c).toBe(1);
  });

  it('tanda: cobra extras por unidad y descuenta stock', async () => {
    const antes = await stock(receta[0].insumoId);
    const r = await api('post', `/tables/${mesas[0].id}/items`, empleado, {
      items: [item(prod, 2, [extra])],
    }).expect(201);
    expect(r.body.currentOrder.total).toBeCloseTo((prod.precio + 0.75) * 2, 2);
    const esperado =
      receta[0].cantidadRequerida * 2 +
      (receta[0].insumoId === extra.insumoId ? 2 : 0);
    expect(antes - (await stock(receta[0].insumoId))).toBeCloseTo(esperado, 5);
  });

  it('tanda: usa el precio del catálogo y valida los datos', async () => {
    const r = await api('post', `/tables/${mesas[0].id}/items`, empleado, {
      items: [{ ...item(prod2), precio: 0.01 }],
    }).expect(201);
    const agregado = r.body.currentOrder.items.find(
      (i: { ronda: number }) => i.ronda === 2,
    );
    expect(agregado.precio).toBe(prod2.precio);
    await api('post', `/tables/${mesas[0].id}/items`, empleado, {
      items: [{ ...item(prod), cantidad: 0 }],
    }).expect(400);
    await api('post', `/tables/${mesas[0].id}/items`, empleado, {
      items: [{ ...item(prod), productoId: 'NO_EXISTE', sku: 'NO_EXISTE' }],
    }).expect(400);
    await api('post', `/tables/${mesas[0].id}/items`, empleado, {
      items: [],
    }).expect(400);
  });

  it('pagos parciales: sin MIXTO, sin pasarse del saldo y sin bajar la cuenta', async () => {
    const mesa = mesas[0].id;
    await api('post', `/tables/${mesa}/partial-payment`, empleado, {
      paymentMethod: 'EFECTIVO',
      monto: 5,
    }).expect(201);
    await api('post', `/tables/${mesa}/partial-payment`, empleado, {
      paymentMethod: 'MIXTO',
      monto: 1,
    }).expect(400);
    await api('post', `/tables/${mesa}/partial-payment`, empleado, {
      paymentMethod: 'EFECTIVO',
      monto: 9999,
    }).expect(400);

    const { body } = await api('get', '/tables', empleado);
    const cuenta = body.find((t: { id: string }) => t.id === mesa).currentOrder;
    const pagado = cuenta.pagos.reduce(
      (s: number, p: { monto: number }) => s + p.monto,
      0,
    );
    const resta = Math.round((cuenta.total - pagado - 0.5) * 100) / 100;
    await api('post', `/tables/${mesa}/partial-payment`, empleado, {
      paymentMethod: 'YAPE_PLIN',
      monto: resta,
    }).expect(201);
    // Ahora quitar cualquier ítem dejaría la cuenta por debajo de lo pagado
    await api(
      'delete',
      `/tables/${mesa}/items/${cuenta.items[0].id}`,
      empleado,
    ).expect(400);
  });

  it('no se cierra la caja ni se "entrega" la cuenta desde Pedidos con la mesa abierta', async () => {
    await api('post', '/caja/cerrar', empleado, { efectivoReal: 0 }).expect(
      400,
    );
    const { body } = await api('get', '/tables', empleado);
    const orderId = body.find(
      (t: { id: string }) => t.id === mesas[0].id,
    ).currentOrderId;
    await api('patch', `/pedidos/${orderId}/status`, empleado, {
      status: 'ENTREGADO',
    }).expect(400);
  });

  it('cobro mixto exacto cierra la cuenta y libera la mesa', async () => {
    const mesa = mesas[0].id;
    const { body } = await api('get', '/tables', empleado);
    const cuenta = body.find((t: { id: string }) => t.id === mesa).currentOrder;
    const pagado = cuenta.pagos.reduce(
      (s: number, p: { monto: number }) => s + p.monto,
      0,
    );
    const resta = Math.round((cuenta.total - pagado) * 100) / 100;
    await api('post', `/tables/${mesa}/checkout`, empleado, {
      paymentMethod: 'MIXTO',
      montoEfectivo: 0.1,
      montoDigital: 0.1,
    }).expect(400);
    const ef = Math.round((resta / 2) * 100) / 100;
    const r = await api('post', `/tables/${mesa}/checkout`, empleado, {
      paymentMethod: 'MIXTO',
      montoEfectivo: ef,
      montoDigital: Math.round((resta - ef) * 100) / 100,
    }).expect(201);
    expect(r.body.status).toBe('ENTREGADO');
    const [{ s }] = await q<{ s: number }>(
      'select sum(monto) s from "Pago" where "orderId"=$1',
      [cuenta.id],
    );
    expect(s).toBeCloseTo(cuenta.total, 2);
    const [t] = await q<{ status: string }>(
      'select status from "Table" where id=$1',
      [mesa],
    );
    expect(t.status).toBe('AVAILABLE');
  });

  it('quitar el único ítem libera la mesa y repone el stock', async () => {
    const mesa = mesas[1].id;
    await api('post', `/tables/${mesa}/open`, empleado, {}).expect(201);
    const antes = await stock(receta[0].insumoId);
    const r = await api('post', `/tables/${mesa}/items`, empleado, {
      items: [item(prod)],
    }).expect(201);
    const d = await api(
      'delete',
      `/tables/${mesa}/items/${r.body.currentOrder.items[0].id}`,
      empleado,
    ).expect(200);
    expect(d.body.status).toBe('AVAILABLE');
    expect(await stock(receta[0].insumoId)).toBeCloseTo(antes, 5);
  });

  it('unir y separar mesas', async () => {
    const j = await api('post', `/tables/${mesas[2].id}/join`, empleado, {
      tableIds: [mesas[3].id],
    }).expect(201);
    expect(j.body.joinedTables).toHaveLength(1);
    await api('post', `/tables/${mesas[3].id}/open`, empleado, {}).expect(400);
    await api('post', `/tables/${mesas[2].id}/unjoin`, empleado).expect(201);
  });

  it('para llevar: valida mixto, tolera código repetido y pasa por cocina', async () => {
    const items = [item(prod, 2, [extra])];
    const total = (prod.precio + 0.75) * 2;
    await api('post', '/pedidos', empleado, {
      type: 'LLEVAR',
      paymentMethod: 'MIXTO',
      montoEfectivo: 1,
      montoDigital: 1,
      items,
    }).expect(400);
    const p = await api('post', '/pedidos', empleado, {
      code: '#ORD-E2E',
      type: 'LLEVAR',
      paymentMethod: 'MIXTO',
      montoEfectivo: 1,
      montoDigital: Math.round((total - 1) * 100) / 100,
      items,
    }).expect(201);
    expect(p.body.total).toBeCloseTo(total, 2);
    const stockAntes = await stock(receta[0].insumoId);
    const dup = await api('post', '/pedidos', empleado, {
      code: '#ORD-E2E',
      type: 'LLEVAR',
      paymentMethod: 'EFECTIVO',
      items,
    }).expect(201);
    expect(dup.body.code).not.toBe('#ORD-E2E');

    await api(
      'patch',
      `/pedidos/${p.body.id}/items/${p.body.items[0].id}/kitchen-status`,
      empleado,
      { kitchenStatus: 'IN_KITCHEN' },
    ).expect(200);
    await api('patch', `/pedidos/${p.body.id}/status`, empleado, {
      status: 'LISTO',
    }).expect(200);
    await api('patch', `/pedidos/${dup.body.id}/status`, empleado, {
      status: 'CANCELADO',
    }).expect(200);
    // Cancelado en preparación: el stock vuelve a como estaba
    expect(await stock(receta[0].insumoId)).toBeCloseTo(stockAntes, 5);
    await api('patch', `/pedidos/${dup.body.id}/status`, empleado, {
      status: 'ENTREGADO',
    }).expect(400);
  });

  it('permisos: el empleado opera pero no administra el catálogo', async () => {
    await api('post', '/productos', empleado, {
      id: 'x',
      sku: 'x',
      categoria: 'Arepas',
      nombre: 'x',
      precio: 1,
    }).expect(403);
    await api(
      'patch',
      `/productos/${prod2.id}/toggle-availability`,
      empleado,
    ).expect(200);
    await api(
      'patch',
      `/productos/${prod2.id}/toggle-availability`,
      empleado,
    ).expect(200);
    await api('post', `/insumos/${receta[0].insumoId}/movimiento`, empleado, {
      cantidad: 1,
      tipo: 'entrada',
      motivo: 'e2e',
    }).expect(201);
    await api('delete', `/insumos/${receta[0].insumoId}`, empleado).expect(403);
    await api('delete', `/tables/${mesas[4].id}`, empleado).expect(403);
    await api('delete', `/insumos/${extra.insumoId}`, jefe).expect(400);
  });

  it('cierre de caja cuadrado', async () => {
    const { body } = await api('get', '/caja/estado', empleado).expect(200);
    const r = body.resumenActual;
    expect(r.efectivoVentas + r.yapePlin + r.tarjeta).toBeCloseTo(
      r.totalVendido,
      2,
    );
    const c = await api('post', '/caja/cerrar', empleado, {
      efectivoReal: r.efectivoEsperado,
    }).expect(201);
    expect(c.body.diferencia).toBe(0);
  });
});
