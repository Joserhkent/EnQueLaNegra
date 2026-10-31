import type { Agregado, Insumo } from "../store/usePosStore";

// Agregados que se pueden ofrecer ahora: activos y con stock para al menos uno.
// Si no, el carrito los mostraría con precio pero el backend rechazaría la tanda.
export function agregadosDisponibles(agregados: Agregado[], insumos: Insumo[]) {
  const stock = new Map(insumos.map((i) => [i.id, i.stockActual]));
  return agregados.filter((a) => a.activo && (stock.get(a.insumoId) ?? 0) >= a.consumo);
}

// Precio por unidad del plato de los agregados elegidos (se guardan por nombre en el carrito)
export const precioAgregados = (elegidos: string[], agregados: Agregado[]) =>
  elegidos.reduce((sum, nombre) => sum + (agregados.find((a) => a.nombre === nombre)?.precio ?? 0), 0);

// Extras para el pedido; el servidor completa el precio y el consumo desde el agregado
export const extrasDeAgregados = (elegidos: string[], agregados: Agregado[]) =>
  elegidos.flatMap((nombre) => {
    const a = agregados.find((x) => x.nombre === nombre);
    return a ? [{ insumoId: a.insumoId, agregadoId: a.id, cantidad: 1, precioExtra: a.precio }] : [];
  });
