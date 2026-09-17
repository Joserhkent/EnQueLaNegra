// Unidades que son símbolos/abreviaturas y nunca se pluralizan (ej. "ml", no "mls").
const UNIDADES_INVARIABLES = new Set(['ml', 'g', 'kg', 'l']);

// Plurales irregulares que la regla vocal/consonante no produce bien (acentos que se
// pierden al pluralizar, ej. "porción" -> "porciones", no "porciónes").
const PLURALES_IRREGULARES: Record<string, string> = {
  porción: 'porciones',
};

const VOCALES = new Set(['a', 'e', 'i', 'o', 'u', 'á', 'é', 'í', 'ó', 'ú']);

// Misma lógica que apps/desktop/src/lib/utils.ts: pluraliza una unidad de medida
// (unidad, porción, ml, laminado, vaso...) respetando reglas reales del español.
export function formatUnidad(unidad: string, cantidad: number): string {
  const base = (unidad || '').trim();
  if (!base) return '';

  const esPlural = cantidad !== 1;
  if (!esPlural || UNIDADES_INVARIABLES.has(base.toLowerCase())) {
    return base;
  }

  const irregular = PLURALES_IRREGULARES[base.toLowerCase()];
  if (irregular) return irregular;

  const ultimaLetra = base.slice(-1).toLowerCase();
  return VOCALES.has(ultimaLetra) ? `${base}s` : `${base}es`;
}
