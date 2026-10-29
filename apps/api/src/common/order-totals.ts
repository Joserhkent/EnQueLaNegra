interface ItemExtra {
  precioExtra?: number | null;
  cantidad?: number | null;
}

// Los extras son por unidad del plato: 2 arepas con "queso extra" cobran el extra 2 veces.
// Misma regla que el carrito del frontend y que el descuento de inventario.
export function itemLineTotal(
  precio: number,
  cantidad: number,
  extras: ItemExtra[] = [],
): number {
  const extrasPorUnidad = extras.reduce(
    (sum, e) => sum + (e.precioExtra ?? 0) * (e.cantidad ?? 1),
    0,
  );
  return round2((precio + extrasPorUnidad) * cantidad);
}

// IGV Perú 18%: el total ya incluye IGV.
export function splitIgv(total: number) {
  const totalRedondeado = round2(total);
  const subtotal = round2(totalRedondeado / 1.18);
  return {
    total: totalRedondeado,
    subtotal,
    igv: round2(totalRedondeado - subtotal),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
