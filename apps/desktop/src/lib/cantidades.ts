import { formatUnidad } from "./utils";

// Unidad grande para escribir más cómodo: se compra "5 kg", no "5000 g".
const UNIDAD_GRANDE: Record<string, { nombre: string; factor: number }> = {
  g: { nombre: "kg", factor: 1000 },
  ml: { nombre: "L", factor: 1000 },
};

export const unidadGrande = (unidad: string) => UNIDAD_GRANDE[unidad] ?? null;

type ConPresentacion = {
  unidadMedida: string;
  presentacionNombre?: string | null;
  presentacionCantidad?: number | null;
};

export const tienePresentacion = (i: ConPresentacion) =>
  Boolean(i.presentacionNombre && i.presentacionCantidad && i.presentacionCantidad > 0);

// Unidades en que se puede escribir una cantidad de un insumo, con cuánto vale
// cada una en la unidad del insumo. Ej. atún en g: g (1), kg (1000), lata (130).
export type OpcionUnidad = { clave: "base" | "grande" | "pres"; nombre: string; factor: number };

export const opcionesUnidad = (i: ConPresentacion): OpcionUnidad[] => {
  const opciones: OpcionUnidad[] = [{ clave: "base", nombre: i.unidadMedida, factor: 1 }];
  const grande = unidadGrande(i.unidadMedida);
  if (grande) opciones.push({ clave: "grande", nombre: grande.nombre, factor: grande.factor });
  if (tienePresentacion(i)) {
    opciones.push({ clave: "pres", nombre: i.presentacionNombre!.trim(), factor: i.presentacionCantidad! });
  }
  return opciones;
};

// Con la que conviene escribir: la presentación (latas, bolsas) si hay; si no, kg o L
export const opcionPreferida = (i: ConPresentacion): OpcionUnidad["clave"] => {
  const opciones = opcionesUnidad(i);
  return opciones[opciones.length - 1].clave;
};

export const factorDe = (i: ConPresentacion, clave: OpcionUnidad["clave"]) =>
  opcionesUnidad(i).find((o) => o.clave === clave)?.factor ?? 1;

export const nombreOpcion = (o: OpcionUnidad, cantidad: number) =>
  o.clave === "grande" ? o.nombre : formatUnidad(o.nombre, cantidad);

// Acepta coma o punto decimal: el teclado del celular en español escribe "2,5".
// Devuelve null si está vacío o no es un número.
export const leerNumero = (texto: string): number | null => {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const redondear = (n: number, decimales = 2) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

// "3200 g" -> "3.2 kg"; "72 tajada" -> "72 tajadas"
export const formatCantidad = (cantidad: number, unidad: string) => {
  const grande = unidadGrande(unidad);
  if (grande && Math.abs(cantidad) >= grande.factor) {
    return `${redondear(cantidad / grande.factor)} ${grande.nombre}`;
  }
  return `${redondear(cantidad)} ${formatUnidad(unidad, cantidad)}`;
};

// Igual, más la presentación cuando la hay: "650 g (5 latas)"
export const formatConPresentacion = (cantidad: number, i: ConPresentacion) => {
  const base = formatCantidad(cantidad, i.unidadMedida);
  if (!tienePresentacion(i)) return base;
  const n = redondear(cantidad / i.presentacionCantidad!, 1);
  return `${base} (${n} ${formatUnidad(i.presentacionNombre!.trim(), n)})`;
};

// Costo legible: por kg o L en vez de por gramo, o por presentación si la hay
export const formatCosto = (costoUnitario: number, i: ConPresentacion) => {
  if (tienePresentacion(i)) {
    return `S/ ${(costoUnitario * i.presentacionCantidad!).toFixed(2)} / ${i.presentacionNombre!.trim()}`;
  }
  const grande = unidadGrande(i.unidadMedida);
  if (grande) return `S/ ${(costoUnitario * grande.factor).toFixed(2)} / ${grande.nombre}`;
  return `S/ ${costoUnitario.toFixed(2)} / ${i.unidadMedida}`;
};
