import 'dotenv/config';
import { PrismaClient, Accion, CategoriaTipo } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Carta {
  categorias: { nombre: string; tipo: CategoriaTipo; orden: number }[];
  insumos: {
    id: string;
    nombre: string;
    categoria: string;
    unidadMedida: string;
    stockActual: number;
    stockMinimo: number;
    costoUnitario: number;
  }[];
  productos: {
    id: string;
    sku: string;
    nombre: string;
    categoria: string;
    precio: number;
    isAvailable: boolean;
    isPopular: boolean;
    descripcion: string | null;
    iconoEmoji: string | null;
    receta: { insumoId: string; cantidad: number }[];
  }[];
}

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

async function main() {
  // El seed BORRA todas las tablas (pedidos, caja, productos, usuarios...) y carga la
  // carta real desde seed-data/carta.json. Solo debe correr sobre una base vacía, o a
  // propósito con SEED_FORCE=1.
  const existentes = await prisma.producto.count();
  if (existentes > 0 && process.env.SEED_FORCE !== '1') {
    console.error(
      `⛔ La base ya tiene ${existentes} productos. El seed borraría TODOS los datos (ventas, caja, usuarios). Si es lo que quieres, ejecútalo con SEED_FORCE=1.`,
    );
    process.exit(1);
  }

  console.log('🌱 Iniciando carga de datos semilla (Seed) para En que la Negra POS...');

  // 1. Limpiar base de datos (orden respeta dependencias FK)
  await prisma.pago.deleteMany();
  await prisma.orderItemExtra.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.table.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.movimientoStock.deleteMany();
  await prisma.cierreCaja.deleteMany();
  await prisma.cajaSesion.deleteMany();
  await prisma.recetaItem.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.insumo.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolPermiso.deleteMany();
  await prisma.rol.deleteMany();
  await prisma.permiso.deleteMany();
  await prisma.modulo.deleteMany();

  // 2. Módulos del sistema (uno por página del POS)
  const modulosData = [
    { clave: 'dashboard', nombre: 'Dashboard', orden: 1 },
    { clave: 'mesas', nombre: 'Mesas', orden: 2 },
    { clave: 'productos', nombre: 'Productos', orden: 3 },
    { clave: 'pedidos', nombre: 'Pedidos', orden: 4 },
    { clave: 'pagos', nombre: 'Pagos', orden: 5 },
    { clave: 'inventario', nombre: 'Inventario', orden: 6 },
    { clave: 'historial', nombre: 'Historial', orden: 7 },
  ];

  const modulos = new Map<string, { id: string }>();
  for (const m of modulosData) {
    const modulo = await prisma.modulo.create({ data: m });
    modulos.set(m.clave, modulo);
  }

  // 3. Permisos = (módulo x acción) para cada módulo
  const permisos = new Map<string, { id: string }>();
  for (const [clave, modulo] of modulos) {
    for (const accion of Object.values(Accion)) {
      const permiso = await prisma.permiso.create({
        data: { moduloId: modulo.id, accion },
      });
      permisos.set(`${clave}:${accion}`, permiso);
    }
  }

  // 4. Roles: Jefa (acceso total) y Mesonero (atención de mesas y comandas)
  const rolJefe = await prisma.rol.create({
    data: { nombre: 'Jefe', descripcion: 'Acceso total al sistema POS' },
  });
  const rolEmpleado = await prisma.rol.create({
    data: { nombre: 'Empleado', descripcion: 'Mozo/mesonero: mesas, pedidos, pagos y consulta de inventario' },
  });

  // Jefa: VER + CREAR + EDITAR + ELIMINAR en todos los módulos
  await prisma.rolPermiso.createMany({
    data: [...permisos.values()].map((p) => ({ rolId: rolJefe.id, permisoId: p.id })),
  });

  // Mesonero: acceso operativo (sin Dashboard ni Historial, inventario solo lectura)
  const permisosEmpleado = [
    'mesas:VER', 'mesas:CREAR', 'mesas:EDITAR',
    'productos:VER',
    'pedidos:VER', 'pedidos:CREAR', 'pedidos:EDITAR',
    'pagos:VER', 'pagos:CREAR',
    'inventario:VER',
  ];
  await prisma.rolPermiso.createMany({
    data: permisosEmpleado.map((key) => ({
      rolId: rolEmpleado.id,
      permisoId: permisos.get(key)!.id,
    })),
  });

  console.log('🔐 Módulos, permisos y roles (Jefe/Empleado) creados.');

  // 5. Crear Usuarios (Jefa y Mesonero)
  const hashedPasswordAdmin = await bcrypt.hash('123456', 10);
  const hashedPasswordEmpleado = await bcrypt.hash('123456', 10);

  const jefeUser = await prisma.user.create({
    data: {
      name: 'La Negra (Jefa)',
      username: 'admin',
      password: hashedPasswordAdmin,
      rolId: rolJefe.id,
      turn: 'Turno Completo • Lun - Dom',
    },
  });

  const empleadoUser = await prisma.user.create({
    data: {
      name: 'Carlos (Mesonero)',
      username: 'empleado',
      password: hashedPasswordEmpleado,
      rolId: rolEmpleado.id,
      turn: 'Turno Completo • Lun - Dom',
    },
  });

  console.log(`👤 Usuarios creados: ${jefeUser.name} (Jefa) y ${empleadoUser.name} (Mesonero)`);

  // 6. Mesas del salón (Dine-in)
  const mesasData = [
    { number: 1, capacity: 2 },
    { number: 2, capacity: 5 },
    { number: 3, capacity: 4 },
    { number: 4, capacity: 4 },
    { number: 5, capacity: 2 },
    { number: 6, capacity: 4 },
    { number: 7, capacity: 4 },
    { number: 8, capacity: 2 },
    { number: 9, capacity: 2 },
  ];
  await prisma.table.createMany({ data: mesasData });
  console.log(`🍽️  ${mesasData.length} Mesas del salón creadas.`);

  // 7-9. Carta real: categorías, insumos, productos y recetas (BOM) desde
  // prisma/seed-data/carta.json. Para actualizarla tras cambiar la carta en el POS:
  // npm run carta:exportar
  const carta = JSON.parse(
    readFileSync(join(__dirname, 'seed-data', 'carta.json'), 'utf8'),
  ) as Carta;

  const categoriaId = new Map<string, string>();
  for (const c of carta.categorias) {
    const cat = await prisma.categoria.create({ data: c });
    categoriaId.set(`${c.tipo}:${c.nombre}`, cat.id);
  }
  console.log(`🗂️  ${carta.categorias.length} Categorías creadas.`);

  await prisma.insumo.createMany({
    data: carta.insumos.map(({ categoria, ...insumo }) => ({
      ...insumo,
      categoriaId: categoriaId.get(`${CategoriaTipo.INSUMO}:${categoria}`)!,
    })),
  });
  console.log(`📦 ${carta.insumos.length} Insumos cargados.`);

  for (const { receta, categoria, ...producto } of carta.productos) {
    await prisma.producto.create({
      data: {
        ...producto,
        categoriaId: categoriaId.get(`${CategoriaTipo.PRODUCTO}:${categoria}`)!,
        recetaItems: {
          create: receta.map((r) => ({
            insumoId: r.insumoId,
            cantidadRequerida: r.cantidad,
          })),
        },
      },
    });
  }
  console.log(`🍽️  ${carta.productos.length} Productos y Recetas (BOM) creados.`);

  // 10. Turno de caja inicial abierto para que el sistema esté listo para demostración
  await prisma.cajaSesion.create({
    data: {
      estado: 'ABIERTA',
      montoInicial: 150.00,
      usuarioAperturaId: jefeUser.id,
      usuarioApertura: 'La Negra (Jefa)',
      notasApertura: 'Fondo de sencillo inicial para apertura de turno',
    },
  });
  console.log('💵 Caja inicial abierta con fondo de S/ 150.00.');

  console.log('✅ Carga de datos de la base de datos completada exitosamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error durante el seed de la base de datos:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
