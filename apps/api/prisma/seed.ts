import 'dotenv/config';
import { PrismaClient, Accion, CategoriaTipo } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaBetterSqlite3({ url: 'en_que_la_negra.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
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
    { number: 2, capacity: 2 },
    { number: 3, capacity: 2 },
    { number: 4, capacity: 2 },
    { number: 5, capacity: 4 },
    { number: 6, capacity: 4 },
    { number: 7, capacity: 4 },
    { number: 8, capacity: 4 },
    { number: 9, capacity: 4 },
    { number: 10, capacity: 6 },
    { number: 11, capacity: 6 },
    { number: 12, capacity: 8 },
  ];
  await prisma.table.createMany({ data: mesasData });
  console.log(`🍽️  ${mesasData.length} Mesas del salón creadas.`);

  // 7. Categorías (separadas por tipo: INSUMO vs PRODUCTO)
  const categoriasInsumoData = [
    'Panes y Masas',
    'Carnes y Proteínas',
    'Quesos y Lácteos',
    'Verduras y Legumbres',
    'Papas',
    'Salsas y Aderezos',
  ];
  const categoriasProductoData = [
    'Arepas Tradicionales',
    'Empanadas',
    'Cachapas',
    'Patacones',
    'Comida Rápida',
    'Horneados',
    'Especiales de Fin de Semana',
    'Agregados',
  ];

  const categoriasInsumo = new Map<string, { id: string }>();
  for (const [i, nombre] of categoriasInsumoData.entries()) {
    const cat = await prisma.categoria.create({
      data: { nombre, tipo: CategoriaTipo.INSUMO, orden: i },
    });
    categoriasInsumo.set(nombre, cat);
  }

  const categoriasProducto = new Map<string, { id: string }>();
  for (const [i, nombre] of categoriasProductoData.entries()) {
    const cat = await prisma.categoria.create({
      data: { nombre, tipo: CategoriaTipo.PRODUCTO, orden: i },
    });
    categoriasProducto.set(nombre, cat);
  }

  // 8. Insumos base (BOM) — carnes, panes/masas, quesos, verduras, papas y salsas venezolanas
  const insumosData = [
    // Panes y Masas
    { id: 'masa_arepa', nombre: 'Harina de Maíz Precocida', unidadMedida: 'porción', stockActual: 60, stockMinimo: 40, costoUnitario: 0.30, categoria: 'Panes y Masas' },
    { id: 'masa_empanada', nombre: 'Masa para Empanada', unidadMedida: 'unidad', stockActual: 50, stockMinimo: 30, costoUnitario: 0.25, categoria: 'Panes y Masas' },
    { id: 'masa_cachapa', nombre: 'Maíz Tierno (Cachapa)', unidadMedida: 'porción', stockActual: 40, stockMinimo: 25, costoUnitario: 0.60, categoria: 'Panes y Masas' },
    { id: 'platano_verde', nombre: 'Plátano Verde (Patacón)', unidadMedida: 'unidad', stockActual: 35, stockMinimo: 20, costoUnitario: 0.40, categoria: 'Panes y Masas' },
    { id: 'pan_pepito', nombre: 'Pan Baguette (Pepito)', unidadMedida: 'unidad', stockActual: 40, stockMinimo: 20, costoUnitario: 0.60, categoria: 'Panes y Masas' },
    { id: 'pan_hamburguesa', nombre: 'Pan de Hamburguesa', unidadMedida: 'unidad', stockActual: 45, stockMinimo: 25, costoUnitario: 0.50, categoria: 'Panes y Masas' },
    { id: 'pan_arabe', nombre: 'Pan Árabe (Shawarma)', unidadMedida: 'unidad', stockActual: 35, stockMinimo: 20, costoUnitario: 0.50, categoria: 'Panes y Masas' },
    { id: 'pan_perro', nombre: 'Pan de Perro Caliente', unidadMedida: 'unidad', stockActual: 40, stockMinimo: 20, costoUnitario: 0.40, categoria: 'Panes y Masas' },
    { id: 'masa_pastelito', nombre: 'Masa Hojaldrada (Pastelito)', unidadMedida: 'unidad', stockActual: 50, stockMinimo: 25, costoUnitario: 0.30, categoria: 'Panes y Masas' },
    { id: 'pasta_lasagna', nombre: 'Pasta para Lasagna', unidadMedida: 'porción', stockActual: 20, stockMinimo: 10, costoUnitario: 1.20, categoria: 'Panes y Masas' },
    { id: 'arroz', nombre: 'Arroz Blanco', unidadMedida: 'porción', stockActual: 40, stockMinimo: 20, costoUnitario: 0.40, categoria: 'Panes y Masas' },

    // Carnes y Proteínas
    { id: 'pollo_desmechado', nombre: 'Pollo Desmechado', unidadMedida: 'porción', stockActual: 30, stockMinimo: 20, costoUnitario: 1.80, categoria: 'Carnes y Proteínas' },
    { id: 'carne_mechada', nombre: 'Carne Mechada', unidadMedida: 'porción', stockActual: 35, stockMinimo: 20, costoUnitario: 2.20, categoria: 'Carnes y Proteínas' },
    { id: 'carne_molida', nombre: 'Carne Molida', unidadMedida: 'porción', stockActual: 30, stockMinimo: 15, costoUnitario: 2.00, categoria: 'Carnes y Proteínas' },
    { id: 'carne_hamburguesa', nombre: 'Carne de Hamburguesa (patty)', unidadMedida: 'unidad', stockActual: 40, stockMinimo: 25, costoUnitario: 2.00, categoria: 'Carnes y Proteínas' },
    { id: 'carne_shawarma', nombre: 'Carne de Shawarma', unidadMedida: 'porción', stockActual: 25, stockMinimo: 15, costoUnitario: 2.50, categoria: 'Carnes y Proteínas' },
    { id: 'pollo_shawarma', nombre: 'Pollo para Shawarma', unidadMedida: 'porción', stockActual: 25, stockMinimo: 15, costoUnitario: 2.00, categoria: 'Carnes y Proteínas' },
    { id: 'jamon', nombre: 'Jamón Cocido', unidadMedida: 'porción', stockActual: 30, stockMinimo: 15, costoUnitario: 1.20, categoria: 'Carnes y Proteínas' },
    { id: 'salchicha', nombre: 'Salchicha Criolla', unidadMedida: 'unidad', stockActual: 30, stockMinimo: 15, costoUnitario: 1.00, categoria: 'Carnes y Proteínas' },
    { id: 'salchicha_perro', nombre: 'Salchicha Perro Caliente', unidadMedida: 'unidad', stockActual: 35, stockMinimo: 20, costoUnitario: 0.90, categoria: 'Carnes y Proteínas' },
    { id: 'tocino', nombre: 'Tocineta', unidadMedida: 'porción', stockActual: 20, stockMinimo: 15, costoUnitario: 1.10, categoria: 'Carnes y Proteínas' },
    { id: 'chicharron', nombre: 'Chicharrón', unidadMedida: 'porción', stockActual: 20, stockMinimo: 12, costoUnitario: 1.30, categoria: 'Carnes y Proteínas' },
    { id: 'chuleta_cerdo', nombre: 'Chuleta de Cerdo', unidadMedida: 'unidad', stockActual: 15, stockMinimo: 10, costoUnitario: 3.00, categoria: 'Carnes y Proteínas' },
    { id: 'mondongo', nombre: 'Mondongo', unidadMedida: 'porción', stockActual: 15, stockMinimo: 10, costoUnitario: 2.50, categoria: 'Carnes y Proteínas' },
    { id: 'costillas', nombre: 'Costillas de Res', unidadMedida: 'porción', stockActual: 15, stockMinimo: 10, costoUnitario: 2.80, categoria: 'Carnes y Proteínas' },
    { id: 'atun', nombre: 'Atún en Lata', unidadMedida: 'porción', stockActual: 25, stockMinimo: 15, costoUnitario: 1.00, categoria: 'Carnes y Proteínas' },
    { id: 'huevo', nombre: 'Huevo', unidadMedida: 'unidad', stockActual: 60, stockMinimo: 30, costoUnitario: 0.30, categoria: 'Carnes y Proteínas' },
    { id: 'carne_bolonesa', nombre: 'Salsa Boloñesa', unidadMedida: 'porción', stockActual: 20, stockMinimo: 10, costoUnitario: 1.50, categoria: 'Carnes y Proteínas' },

    // Quesos y Lácteos
    { id: 'queso_amarillo', nombre: 'Queso Amarillo', unidadMedida: 'laminado', stockActual: 30, stockMinimo: 40, costoUnitario: 0.50, categoria: 'Quesos y Lácteos' },
    { id: 'queso_blanco', nombre: 'Queso Blanco Fresco', unidadMedida: 'porción', stockActual: 30, stockMinimo: 20, costoUnitario: 0.45, categoria: 'Quesos y Lácteos' },
    { id: 'queso_telita', nombre: 'Queso Telita', unidadMedida: 'porción', stockActual: 25, stockMinimo: 20, costoUnitario: 0.70, categoria: 'Quesos y Lácteos' },
    { id: 'bechamel', nombre: 'Salsa Bechamel', unidadMedida: 'ml', stockActual: 2000, stockMinimo: 800, costoUnitario: 0.01, categoria: 'Quesos y Lácteos' },

    // Verduras y Legumbres
    { id: 'caraotas_negras', nombre: 'Caraotas Negras Refritas', unidadMedida: 'porción', stockActual: 40, stockMinimo: 20, costoUnitario: 0.60, categoria: 'Verduras y Legumbres' },
    { id: 'platano_maduro', nombre: 'Plátano Maduro', unidadMedida: 'unidad', stockActual: 30, stockMinimo: 15, costoUnitario: 0.40, categoria: 'Verduras y Legumbres' },
    { id: 'aguacate', nombre: 'Aguacate', unidadMedida: 'unidad', stockActual: 25, stockMinimo: 15, costoUnitario: 0.80, categoria: 'Verduras y Legumbres' },
    { id: 'repollo', nombre: 'Repollo Rallado', unidadMedida: 'porción', stockActual: 30, stockMinimo: 15, costoUnitario: 0.30, categoria: 'Verduras y Legumbres' },
    { id: 'ensalada_rusa', nombre: 'Ensalada Rusa', unidadMedida: 'porción', stockActual: 25, stockMinimo: 15, costoUnitario: 0.60, categoria: 'Verduras y Legumbres' },

    // Papas
    { id: 'papas_ralladas', nombre: 'Papitas Ralladas', unidadMedida: 'porción', stockActual: 40, stockMinimo: 20, costoUnitario: 0.40, categoria: 'Papas' },
    { id: 'papas_fritas', nombre: 'Papas Fritas', unidadMedida: 'porción', stockActual: 80, stockMinimo: 40, costoUnitario: 1.00, categoria: 'Papas' },

    // Salsas y Aderezos (cremas gratis + agregados pagos)
    { id: 'guasacaca', nombre: 'Guasacaca', unidadMedida: 'ml', stockActual: 2000, stockMinimo: 700, costoUnitario: 0.02, categoria: 'Salsas y Aderezos' },
    { id: 'salsa_ajo', nombre: 'Salsa de Ajo', unidadMedida: 'ml', stockActual: 1500, stockMinimo: 600, costoUnitario: 0.02, categoria: 'Salsas y Aderezos' },
    { id: 'mayonesa', nombre: 'Mayonesa', unidadMedida: 'ml', stockActual: 3000, stockMinimo: 1000, costoUnitario: 0.01, categoria: 'Salsas y Aderezos' },
    { id: 'ketchup', nombre: 'Ketchup', unidadMedida: 'ml', stockActual: 2500, stockMinimo: 800, costoUnitario: 0.01, categoria: 'Salsas y Aderezos' },
    { id: 'mostaza', nombre: 'Mostaza', unidadMedida: 'ml', stockActual: 2000, stockMinimo: 800, costoUnitario: 0.01, categoria: 'Salsas y Aderezos' },
    { id: 'picante_casero', nombre: 'Picante Casero', unidadMedida: 'ml', stockActual: 1200, stockMinimo: 500, costoUnitario: 0.02, categoria: 'Salsas y Aderezos' },
  ];

  for (const item of insumosData) {
    const { categoria, ...rest } = item;
    await prisma.insumo.create({
      data: { ...rest, categoriaId: categoriasInsumo.get(categoria)!.id },
    });
  }

  console.log(`📦 ${insumosData.length} Insumos cargados.`);

  // 9. Crear Productos con Recetas (BOM) — carta oficial de "En que la Negra"
  const productosData = [
    // Arepas Tradicionales
    { id: 'AR01', sku: 'AR01', nombre: 'Reina Pepiada', categoria: 'Arepas Tradicionales', precio: 4.00, isPopular: true, descripcion: 'Pollo desmechado con aguacate cremoso y aderezo de la casa.', iconoEmoji: '🥑', receta: ['masa_arepa', 'pollo_desmechado', 'aguacate'] },
    { id: 'AR02', sku: 'AR02', nombre: 'La Pelúa', categoria: 'Arepas Tradicionales', precio: 4.00, descripcion: 'Carne mechada guisada cubierta con queso amarillo rallado.', iconoEmoji: '🧀', receta: ['masa_arepa', 'carne_mechada', 'queso_amarillo'] },
    { id: 'AR03', sku: 'AR03', nombre: 'Pabellón', categoria: 'Arepas Tradicionales', precio: 4.50, isPopular: true, descripcion: 'Carne mechada, caraotas negras, tajadas de plátano maduro y queso.', iconoEmoji: '🇻🇪', receta: ['masa_arepa', 'carne_mechada', 'caraotas_negras', 'platano_maduro', 'queso_blanco'] },
    { id: 'AR04', sku: 'AR04', nombre: 'Catira', categoria: 'Arepas Tradicionales', precio: 3.50, descripcion: 'Pollo desmechado sazonado acompañado de queso amarillo.', iconoEmoji: '🐔', receta: ['masa_arepa', 'pollo_desmechado', 'queso_amarillo'] },
    { id: 'AR05', sku: 'AR05', nombre: 'Dominó', categoria: 'Arepas Tradicionales', precio: 3.00, descripcion: 'Caraotas negras refritas coronadas con queso blanco fresco.', iconoEmoji: '⚫', receta: ['masa_arepa', 'caraotas_negras', 'queso_blanco'] },
    { id: 'AR06', sku: 'AR06', nombre: 'Atún', categoria: 'Arepas Tradicionales', precio: 3.50, descripcion: 'Guiso de atún sazonado con cebollita y pimiento.', iconoEmoji: '🐟', receta: ['masa_arepa', 'atun'] },
    { id: 'AR07', sku: 'AR07', nombre: 'Jamón y Queso', categoria: 'Arepas Tradicionales', precio: 3.00, descripcion: 'Jamón cocido y queso derretido.', iconoEmoji: '🧈', receta: ['masa_arepa', 'jamon', 'queso_amarillo'] },
    { id: 'AR08', sku: 'AR08', nombre: 'Salchicha', categoria: 'Arepas Tradicionales', precio: 3.00, descripcion: 'Salchichas salteadas en salsa criolla especial.', iconoEmoji: '🌭', receta: ['masa_arepa', 'salchicha'] },
    { id: 'AR09', sku: 'AR09', nombre: 'Perico', categoria: 'Arepas Tradicionales', precio: 3.00, descripcion: 'Huevos revueltos preparados con sofrito criollo de tomate y cebolla.', iconoEmoji: '🍳', receta: ['masa_arepa', 'huevo'] },

    // Empanadas
    { id: 'EP01', sku: 'EP01', nombre: 'Empanada de Carne Molida', categoria: 'Empanadas', precio: 1.75, isPopular: true, descripcion: 'Empanada frita y crujiente rellena de carne molida.', iconoEmoji: '🥟', receta: ['masa_empanada', 'carne_molida'] },
    { id: 'EP02', sku: 'EP02', nombre: 'Empanada de Pollo', categoria: 'Empanadas', precio: 1.75, descripcion: 'Empanada frita y crujiente rellena de pollo desmechado.', iconoEmoji: '🥟', receta: ['masa_empanada', 'pollo_desmechado'] },
    { id: 'EP03', sku: 'EP03', nombre: 'Empanada de Queso', categoria: 'Empanadas', precio: 1.50, descripcion: 'Empanada frita y crujiente rellena de queso blanco.', iconoEmoji: '🧀', receta: ['masa_empanada', 'queso_blanco'] },
    { id: 'EP04', sku: 'EP04', nombre: 'Empanada de Jamón y Queso', categoria: 'Empanadas', precio: 1.75, descripcion: 'Empanada frita y crujiente rellena de jamón y queso.', iconoEmoji: '🥟', receta: ['masa_empanada', 'jamon', 'queso_amarillo'] },
    { id: 'EP05', sku: 'EP05', nombre: 'Empanada de Caraota y Queso', categoria: 'Empanadas', precio: 1.50, descripcion: 'Empanada frita y crujiente rellena de caraotas negras y queso.', iconoEmoji: '🫘', receta: ['masa_empanada', 'caraotas_negras', 'queso_blanco'] },
    { id: 'EP06', sku: 'EP06', nombre: 'Empanada de Salchicha', categoria: 'Empanadas', precio: 1.50, descripcion: 'Empanada frita y crujiente rellena de salchicha.', iconoEmoji: '🌭', receta: ['masa_empanada', 'salchicha'] },

    // Cachapas
    { id: 'CH01', sku: 'CH01', nombre: 'Cachapa Simple con Queso Telita', categoria: 'Cachapas', precio: 4.50, isPopular: true, descripcion: 'Torta de maíz dulce con auténtico queso telita fresco y mantequilla.', iconoEmoji: '🌽', receta: ['masa_cachapa', 'queso_telita'] },
    { id: 'CH02', sku: 'CH02', nombre: 'Cachapa Queso Telita y Chicharrón', categoria: 'Cachapas', precio: 6.00, descripcion: 'Queso tierno fundente con trozos crujientes de chicharrón.', iconoEmoji: '🥓', receta: ['masa_cachapa', 'queso_telita', 'chicharron'] },
    { id: 'CH03', sku: 'CH03', nombre: 'Cachapa Carne Mechada y Queso', categoria: 'Cachapas', precio: 6.50, descripcion: 'Jugosa carne desmechada con abundante queso.', iconoEmoji: '🥩', receta: ['masa_cachapa', 'carne_mechada', 'queso_telita'] },
    { id: 'CH04', sku: 'CH04', nombre: 'Cachapa Tocino y Queso Telita', categoria: 'Cachapas', precio: 6.00, descripcion: 'Tocino ahumado entrelazado con suave queso telita derretido.', iconoEmoji: '🥓', receta: ['masa_cachapa', 'tocino', 'queso_telita'] },

    // Patacones
    { id: 'PT01', sku: 'PT01', nombre: 'Patacón Relleno de Carne Mechada', categoria: 'Patacones', precio: 5.50, isPopular: true, descripcion: 'Tapas crocantes de plátano verde con carne mechada, vegetales, queso y salsas.', iconoEmoji: '🍌', receta: ['platano_verde', 'carne_mechada', 'queso_blanco'] },
    { id: 'PT02', sku: 'PT02', nombre: 'Patacón Relleno de Pollo', categoria: 'Patacones', precio: 5.00, descripcion: 'Tapas crocantes de plátano verde con pollo, vegetales, queso y salsas.', iconoEmoji: '🍌', receta: ['platano_verde', 'pollo_desmechado', 'queso_blanco'] },
    { id: 'PT03', sku: 'PT03', nombre: 'Patacón Relleno de Carne Molida', categoria: 'Patacones', precio: 5.00, descripcion: 'Tapas crocantes de plátano verde con carne molida, vegetales, queso y salsas.', iconoEmoji: '🍌', receta: ['platano_verde', 'carne_molida', 'queso_blanco'] },

    // Comida Rápida & Callejera
    { id: 'HB01', sku: 'HB01', nombre: 'Hamburguesa Simple', categoria: 'Comida Rápida', precio: 4.50, descripcion: 'Hamburguesa sencilla con papas fritas.', iconoEmoji: '🍔', receta: ['pan_hamburguesa', 'carne_hamburguesa', 'papas_fritas'] },
    { id: 'HB02', sku: 'HB02', nombre: 'Hamburguesa Full', categoria: 'Comida Rápida', precio: 6.50, isPopular: true, descripcion: 'Hamburguesa con queso, tocineta, huevo y papas fritas.', iconoEmoji: '🍔', receta: ['pan_hamburguesa', 'carne_hamburguesa', 'queso_amarillo', 'tocino', 'huevo', 'papas_fritas'] },
    { id: 'HB03', sku: 'HB03', nombre: 'Hamburguesa Mixta', categoria: 'Comida Rápida', precio: 6.00, descripcion: 'Hamburguesa con jamón, queso y papas fritas.', iconoEmoji: '🍔', receta: ['pan_hamburguesa', 'carne_hamburguesa', 'jamon', 'queso_amarillo', 'papas_fritas'] },
    { id: 'HB04', sku: 'HB04', nombre: 'Hamburguesa Doble Carne', categoria: 'Comida Rápida', precio: 7.50, descripcion: 'Doble carne, queso y papas fritas.', iconoEmoji: '🍔', receta: ['pan_hamburguesa', 'carne_hamburguesa', 'queso_amarillo', 'papas_fritas'] },
    { id: 'PP01', sku: 'PP01', nombre: 'Mini Pepito', categoria: 'Comida Rápida', precio: 3.50, descripcion: 'Pepito pequeño en baguette suave con carne mechada.', iconoEmoji: '🥖', receta: ['pan_pepito', 'carne_mechada'] },
    { id: 'PP02', sku: 'PP02', nombre: 'Pepito Full', categoria: 'Comida Rápida', precio: 6.50, isPopular: true, descripcion: 'Pepito completo con queso, huevo y papas fritas.', iconoEmoji: '🥖', receta: ['pan_pepito', 'carne_mechada', 'queso_amarillo', 'huevo', 'papas_fritas'] },
    { id: 'PP03', sku: 'PP03', nombre: 'Pepito Mixto', categoria: 'Comida Rápida', precio: 6.00, descripcion: 'Pepito con carne, jamón y queso.', iconoEmoji: '🥖', receta: ['pan_pepito', 'carne_mechada', 'jamon', 'queso_amarillo'] },
    { id: 'SH01', sku: 'SH01', nombre: 'Shawarma Simple', categoria: 'Comida Rápida', precio: 5.00, descripcion: 'Pan plano con pollo y salsa tártara de ajo.', iconoEmoji: '🌯', receta: ['pan_arabe', 'pollo_shawarma', 'salsa_ajo'] },
    { id: 'SH02', sku: 'SH02', nombre: 'Shawarma Full', categoria: 'Comida Rápida', precio: 6.50, isPopular: true, descripcion: 'Pan plano con pollo, carne, vegetales, salsa de ajo y papas.', iconoEmoji: '🌯', receta: ['pan_arabe', 'pollo_shawarma', 'carne_shawarma', 'salsa_ajo', 'papas_fritas'] },
    { id: 'PC01', sku: 'PC01', nombre: 'Perro Simple', categoria: 'Comida Rápida', precio: 2.50, descripcion: 'Perro caliente con repollo, papitas ralladas y salsas.', iconoEmoji: '🌭', receta: ['pan_perro', 'salchicha_perro', 'repollo', 'papas_ralladas'] },
    { id: 'PC02', sku: 'PC02', nombre: 'Perro Especial', categoria: 'Comida Rápida', precio: 3.50, descripcion: 'Perro caliente con queso, repollo, papitas ralladas y salsas.', iconoEmoji: '🌭', receta: ['pan_perro', 'salchicha_perro', 'repollo', 'papas_ralladas', 'queso_amarillo'] },
    { id: 'PC03', sku: 'PC03', nombre: 'Perripollo', categoria: 'Comida Rápida', precio: 4.00, isPopular: true, descripcion: 'Perro caliente con pollo desmechado, repollo, papitas ralladas y salsas.', iconoEmoji: '🌭', receta: ['pan_perro', 'salchicha_perro', 'pollo_desmechado', 'repollo', 'papas_ralladas'] },
    { id: 'PF01', sku: 'PF01', nombre: 'Porción de Papas Fritas', categoria: 'Comida Rápida', precio: 3.00, descripcion: 'Porción individual de papas fritas.', iconoEmoji: '🍟', receta: ['papas_fritas'] },

    // Especialidades del Horno y Fritura
    { id: 'HO01', sku: 'HO01', nombre: 'Pastelito de Carne', categoria: 'Horneados', precio: 1.50, descripcion: 'Masa hojaldrada crocante rellena de carne.', iconoEmoji: '🥐', receta: ['masa_pastelito', 'carne_molida'] },
    { id: 'HO02', sku: 'HO02', nombre: 'Pastelito de Pollo', categoria: 'Horneados', precio: 1.50, descripcion: 'Masa hojaldrada crocante rellena de pollo.', iconoEmoji: '🥐', receta: ['masa_pastelito', 'pollo_desmechado'] },
    { id: 'HO03', sku: 'HO03', nombre: 'Pastelito de Queso', categoria: 'Horneados', precio: 1.50, descripcion: 'Masa hojaldrada crocante rellena de queso.', iconoEmoji: '🥐', receta: ['masa_pastelito', 'queso_blanco'] },
    { id: 'HO04', sku: 'HO04', nombre: 'Lasagna', categoria: 'Horneados', precio: 7.00, isPopular: true, descripcion: 'Pasta artesanal con boloñesa, bechamel y queso gratinado.', iconoEmoji: '🍝', receta: ['pasta_lasagna', 'carne_bolonesa', 'bechamel', 'queso_amarillo'] },

    // Especiales de Fin de Semana
    { id: 'FS01', sku: 'FS01', nombre: 'Plato Chuleta (Sábado)', categoria: 'Especiales de Fin de Semana', precio: 7.50, descripcion: 'Chuleta con ensalada rusa y plátano frito.', iconoEmoji: '🍖', receta: ['chuleta_cerdo', 'ensalada_rusa', 'platano_maduro'] },
    { id: 'FS02', sku: 'FS02', nombre: 'Pabellón Criollo (Sábado)', categoria: 'Especiales de Fin de Semana', precio: 7.00, isPopular: true, descripcion: 'Arroz, caraotas negras, carne mechada y tajadas.', iconoEmoji: '🇻🇪', receta: ['arroz', 'caraotas_negras', 'carne_mechada', 'platano_maduro'] },
    { id: 'FS03', sku: 'FS03', nombre: 'Sopa de Mondongo (Domingo)', categoria: 'Especiales de Fin de Semana', precio: 5.50, descripcion: 'Sopa tradicional de mondongo.', iconoEmoji: '🍲', receta: ['mondongo'] },
    { id: 'FS04', sku: 'FS04', nombre: 'Sopa de Costillas (Domingo)', categoria: 'Especiales de Fin de Semana', precio: 5.50, descripcion: 'Sopa tradicional de costillas de res.', iconoEmoji: '🍲', receta: ['costillas'] },

    // Agregados (porciones extra, también usados como "agregados" pagos en el selector dinámico)
    { id: 'AGX01', sku: 'AGX01', nombre: 'Queso Extra (agregado)', categoria: 'Agregados', precio: 0.75, descripcion: 'Porción extra de queso amarillo.', iconoEmoji: '🧀', receta: ['queso_amarillo'] },
    { id: 'AGX02', sku: 'AGX02', nombre: 'Tajadas Extra (agregado)', categoria: 'Agregados', precio: 0.75, descripcion: 'Porción extra de plátano maduro frito.', iconoEmoji: '🍌', receta: ['platano_maduro'] },
    { id: 'AGX03', sku: 'AGX03', nombre: 'Carne Mechada Extra (agregado)', categoria: 'Agregados', precio: 1.50, descripcion: 'Porción extra de carne mechada.', iconoEmoji: '🥩', receta: ['carne_mechada'] },
    { id: 'AGX04', sku: 'AGX04', nombre: 'Pollo Extra (agregado)', categoria: 'Agregados', precio: 1.50, descripcion: 'Porción extra de pollo desmechado.', iconoEmoji: '🍗', receta: ['pollo_desmechado'] },
    { id: 'AGX05', sku: 'AGX05', nombre: 'Tocineta Extra (agregado)', categoria: 'Agregados', precio: 1.00, descripcion: 'Porción extra de tocineta.', iconoEmoji: '🥓', receta: ['tocino'] },
    { id: 'AGX06', sku: 'AGX06', nombre: 'Chicharrón Extra (agregado)', categoria: 'Agregados', precio: 1.00, descripcion: 'Porción extra de chicharrón.', iconoEmoji: '🧈', receta: ['chicharron'] },
  ];

  for (const prod of productosData) {
    const { receta, categoria, ...productoInfo } = prod;
    await prisma.producto.create({
      data: {
        ...productoInfo,
        categoriaId: categoriasProducto.get(categoria)!.id,
        recetaItems: {
          create: receta.map((insumoId) => ({
            insumoId,
            cantidadRequerida: 1.0,
          })),
        },
      },
    });
  }

  console.log(`🍽️  ${productosData.length} Productos y Recetas (BOM) creados.`);

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
