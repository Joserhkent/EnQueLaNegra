// Agregados que se cobran aparte por plato. Cada uno debe existir como insumo con el
// mismo nombre: así se descuenta su stock y se guarda como extra del ítem.
export const AGREGADOS_DISPONIBLES = [
  { nombre: "Queso Amarillo", precio: 0.75 },
  { nombre: "Plátano Maduro", precio: 0.75 },
  { nombre: "Carne Mechada", precio: 1.50 },
  { nombre: "Pollo Desmechado", precio: 1.50 },
  { nombre: "Tocineta", precio: 1.00 },
  { nombre: "Chicharrón", precio: 1.00 },
];

const normalizar = (s: string) => s.trim().toLowerCase();

// Solo se ofrecen los agregados que tienen su insumo en inventario. Si no, el carrito
// los mostraba con precio pero al enviar se descartaban sin cobrarse.
export function agregadosConInsumo(insumos: { nombre: string }[]) {
  const nombres = new Set(insumos.map((i) => normalizar(i.nombre)));
  return AGREGADOS_DISPONIBLES.filter((a) => nombres.has(normalizar(a.nombre)));
}
