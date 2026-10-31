import { useEffect, useMemo, useState } from "react";
import { usePosStore, type Producto } from "../store/usePosStore";

// Categoría que agrupa las porciones sueltas
const CATEGORIA_EXTRAS = "Agregados";

// Respaldo si la categoría aún no cargó: bebidas/porciones sin agregados ni notas.
// Lo que manda es la casilla "Lleva agregados" de cada categoría (aceptaAgregados).
const CATEGORIAS_SIN_PERSONALIZACION = new Set([
  CATEGORIA_EXTRAS,
  "Batidos",
  "Jugos",
  "Refrescos",
  "Bebidas en lata",
  "Gaseosas y otras bebidas",
]);

export const getCategoriaNombre = (prod: Producto): string => {
  const categoria = prod.categoria as unknown;
  if (typeof categoria === "object" && categoria !== null && "nombre" in categoria) {
    return String((categoria as { nombre?: unknown }).nombre || "");
  }
  return String(categoria || "");
};

export const labelCategoria = (nombre: string): string =>
  nombre === CATEGORIA_EXTRAS ? "Porciones Extras" : nombre;

export const permitePersonalizacion = (nombre: string): boolean => {
  const categoria = usePosStore
    .getState()
    .categorias.find((c) => c.tipo === "PRODUCTO" && c.nombre === nombre);
  if (categoria && typeof categoria.aceptaAgregados === "boolean") return categoria.aceptaAgregados;
  return !CATEGORIAS_SIN_PERSONALIZACION.has(nombre);
};

// Pestañas del menú derivadas de la base de datos: solo categorías que tienen al
// menos un producto disponible, en el orden definido en la tabla Categoria.
// Así un cambio de carta (categorías nuevas, renombradas o vacías) se refleja solo.
export function useMenuCategories(productos: Producto[]) {
  const categorias = usePosStore((s) => s.categorias);
  const fetchCategorias = usePosStore((s) => s.fetchCategorias);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (categorias.length === 0) fetchCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = useMemo(() => {
    const conProductos = new Set(
      productos.filter((p) => p.isAvailable).map(getCategoriaNombre).filter(Boolean),
    );
    const orden = new Map(
      categorias.filter((c) => c.tipo === "PRODUCTO").map((c) => [c.nombre, c.orden ?? 0]),
    );
    // El orden lo decide la jefa en "Categorías" (Agregados queda al final por defecto)
    return [...conProductos].sort(
      (a, b) => (orden.get(a) ?? 1e9) - (orden.get(b) ?? 1e9) || a.localeCompare(b),
    );
  }, [productos, categorias]);

  const activeCategory = tabs.includes(selected) ? selected : (tabs[0] ?? "");
  return { tabs, activeCategory, setSelectedCategory: setSelected };
}
