import type { Insumo } from "../store/usePosStore";
import { factorDe, leerNumero, opcionesUnidad, tienePresentacion, type OpcionUnidad } from "./cantidades";

// Cada ingrediente como se escribe en pantalla; al guardar se pasa a la unidad del insumo
export type LineaReceta = { insumoId: string; valor: string; clave: OpcionUnidad["clave"] };

const aTexto = (n: number) => String(Number(n.toFixed(3)));

// Se muestra en porciones o latas si la cantidad cae justa (1, 1½, 2…); si no, en g/ml/unidad
export const lineaDesdeCantidad = (insumo: Insumo | undefined, insumoId: string, cantidad: number): LineaReceta => {
  if (insumo && tienePresentacion(insumo)) {
    const n = cantidad / insumo.presentacionCantidad!;
    if (Math.abs(n * 4 - Math.round(n * 4)) < 1e-6) return { insumoId, valor: aTexto(n), clave: "pres" };
  }
  return { insumoId, valor: cantidad ? aTexto(cantidad) : "", clave: "base" };
};

export const cantidadBaseLinea = (insumo: Insumo | undefined, linea: LineaReceta) => {
  const n = leerNumero(linea.valor);
  if (n === null || n <= 0) return null;
  return insumo ? n * factorDe(insumo, linea.clave) : n;
};

// En una receta se piensa en g, ml, unidades o en la porción/lata del insumo;
// kg y L sirven para comprar y contar, no para un plato.
export const opcionesReceta = (insumo: Insumo) => opcionesUnidad(insumo).filter((o) => o.clave !== "grande");
