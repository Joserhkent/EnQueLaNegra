import { useMemo, useState } from "react";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import { usePosStore, type Insumo } from "../../store/usePosStore";
import { formatCantidad, tienePresentacion } from "../../lib/cantidades";
import { formatUnidad } from "../../lib/utils";
import { cantidadBaseLinea, opcionesReceta, type LineaReceta } from "../../lib/receta";
import CantidadInput from "../inventario/CantidadInput";

const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Cómo se mide el insumo en una receta: "g", "unidad", "g · porción 150 g"
const medida = (i: Insumo) =>
  tienePresentacion(i)
    ? `${i.unidadMedida} · ${i.presentacionNombre} ${formatCantidad(i.presentacionCantidad!, i.unidadMedida)}`
    : formatUnidad(i.unidadMedida, 1);

type Props = {
  lineas: LineaReceta[];
  onChange: (lineas: LineaReceta[]) => void;
  precio: number;
  error?: string | null;
};

/**
 * Receta del plato: se eligen los ingredientes por categoría (o buscando), se
 * escribe cuánto lleva cada uno y se ve el costo del plato frente al precio.
 */
export default function RecetaEditor({ lineas, onChange, precio, error }: Props) {
  const insumos = usePosStore((s) => s.insumos);
  const porId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const categorias = useMemo(
    () => [...new Set(insumos.map((i) => i.categoria || "Sin categoría"))].sort((a, b) => a.localeCompare(b)),
    [insumos]
  );
  const [categoria, setCategoria] = useState<string | null>(null);
  const categoriaActual = categoria ?? categorias[0] ?? "";

  const enReceta = useMemo(() => new Set(lineas.map((l) => l.insumoId)), [lineas]);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return insumos
      .filter((i) => (q ? sinTildes(i.nombre).includes(q) : (i.categoria || "Sin categoría") === categoriaActual))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [insumos, busqueda, categoriaActual]);

  const alternar = (insumo: Insumo) => {
    if (enReceta.has(insumo.id)) {
      onChange(lineas.filter((l) => l.insumoId !== insumo.id));
      return;
    }
    // Con porción o lata se piensa en porciones; si no, en su unidad (g, ml, tajada…)
    onChange([...lineas, { insumoId: insumo.id, valor: "", clave: tienePresentacion(insumo) ? "pres" : "base" }]);
  };

  const cambiar = (insumoId: string, cambios: Partial<LineaReceta>) =>
    onChange(lineas.map((l) => (l.insumoId === insumoId ? { ...l, ...cambios } : l)));

  const costoLinea = (l: LineaReceta) => {
    const i = porId.get(l.insumoId);
    const base = cantidadBaseLinea(i, l);
    return i && base && i.costoUnitario > 0 ? base * i.costoUnitario : null;
  };

  const costoTotal = lineas.reduce((acc, l) => acc + (costoLinea(l) ?? 0), 0);
  const sinCosto = lineas.filter(
    (l) => cantidadBaseLinea(porId.get(l.insumoId), l) !== null && costoLinea(l) === null
  ).length;
  const pct = precio > 0 ? (costoTotal / precio) * 100 : null;
  const colorPct =
    pct === null ? "text-slate-500" : pct <= 35 ? "text-emerald-700" : pct <= 45 ? "text-amber-700" : "text-rose-700";

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-700">Receta</p>
          <p className="text-[11px] text-slate-500">Lo que se descuenta del inventario por cada plato vendido.</p>
        </div>
        {!eligiendo && (
          <button
            type="button"
            onClick={() => setEligiendo(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar ingrediente
          </button>
        )}
      </div>

      {eligiendo && (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-2.5 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Buscar (opcional)"
                className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEligiendo(false);
                setBusqueda("");
              }}
              className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
            >
              Listo
            </button>
          </div>

          {!busqueda.trim() && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap border transition ${
                    categoriaActual === c
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {visibles.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-slate-500">
              No hay insumos con «{busqueda.trim()}». Créalo primero en Inventario.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto">
              {visibles.map((i) => {
                const marcado = enReceta.has(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => alternar(i)}
                    className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-left transition ${
                      marcado ? "bg-amber-50 border-amber-500" : "bg-white border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center ${
                        marcado ? "bg-amber-500 border-amber-500 text-slate-950" : "border-slate-300"
                      }`}
                    >
                      {marcado && <Check className="w-3 h-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-slate-900 leading-tight">{i.nombre}</span>
                      <span className="block text-[10px] text-slate-500">{medida(i)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {lineas.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 py-4 text-center text-[11px] text-slate-500">
          Sin ingredientes: este plato no descuenta nada del inventario.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white">
          {lineas.map((l) => {
            const i = porId.get(l.insumoId);
            const base = cantidadBaseLinea(i, l);
            const costo = costoLinea(l);
            return (
              <li key={l.insumoId} className="grid grid-cols-[1fr_8.5rem_auto] items-center gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{i?.nombre ?? l.insumoId}</p>
                  <p className={`text-[11px] ${base ? "text-slate-500" : "text-amber-700 font-semibold"}`}>
                    {i && base && l.clave !== "base" ? `${formatCantidad(base, i.unidadMedida)} · ` : ""}
                    {costo !== null ? `S/ ${costo.toFixed(2)}` : base ? "sin costo" : "escribe cuánto lleva"}
                  </p>
                </div>
                {i ? (
                  <CantidadInput
                    opciones={opcionesReceta(i)}
                    clave={l.clave}
                    valor={l.valor}
                    onValor={(valor) => cambiar(l.insumoId, { valor })}
                    onClave={(clave) => cambiar(l.insumoId, { clave })}
                  />
                ) : (
                  <span className="text-[11px] text-rose-600">Insumo borrado</span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(lineas.filter((x) => x.insumoId !== l.insumoId))}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  aria-label={`Quitar ${i?.nombre ?? "ingrediente"}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {lineas.length > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-center">
          <div>
            <p className="text-[10px] font-semibold text-slate-500">Costo del plato</p>
            <p className="text-sm font-bold text-slate-900">S/ {costoTotal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500">Ganancia</p>
            <p className="text-sm font-bold text-slate-900">{precio > 0 ? `S/ ${(precio - costoTotal).toFixed(2)}` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500">Costo / precio</p>
            <p className={`text-sm font-bold ${colorPct}`}>{pct !== null ? `${pct.toFixed(0)}%` : "—"}</p>
          </div>
          {sinCosto > 0 && (
            <p className="col-span-3 text-[10px] text-slate-500">
              {sinCosto} {sinCosto === 1 ? "ingrediente sin costo" : "ingredientes sin costo"}: el costo real es mayor.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
      )}
    </div>
  );
}
