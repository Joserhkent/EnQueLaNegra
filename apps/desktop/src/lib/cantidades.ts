import { formatUnidad } from "./utils";

// Unidad grande para escribir más cómodo: se compra "5 kg", no "5000 g".
const UNIDAD_GRANDE: Record<string, { nombre: string; factor: number }> = {
  g: { nombre: "kg", factor: 1000 },
  ml: { nombre: "L", factor: 1000 },
};

export const unidadGrande = (unidad: string) => UNIDAD_GRANDE[unidad] ?? null;

// Acepta coma o punto decimal: el teclado del celular en español escribe "2,5".
// Devuelve null si está vacío o no es un número.
export const leerNumero = (texto: string): number | null => {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

// "3200 g" -> "3.2 kg"; "72 tajada" -> "72 tajadas"
export const formatCantidad = (cantidad: number, unidad: string) => {
  const grande = unidadGrande(unidad);
  if (grande && Math.abs(cantidad) >= grande.factor) {
    return `${redondear(cantidad / grande.factor)} ${grande.nombre}`;
  }
  return `${redondear(cantidad)} ${formatUnidad(unidad, cantidad)}`;
};
