import type { Producto } from "../store/usePosStore";

type InsumoStock = { id: string; stockActual: number };

// Un producto está sin stock si algún insumo de su receta no alcanza para una
// unidad. Es solo un aviso en pantalla: el backend es quien bloquea la venta.
export function productoSinStock(producto: Producto, insumos: InsumoStock[]): boolean {
  return (producto.receta ?? []).some((insumoId) => {
    const insumo = insumos.find((i) => i.id === insumoId);
    const necesita = producto.recetaCantidades?.[insumoId] ?? 1;
    return insumo !== undefined && insumo.stockActual < necesita;
  });
}
