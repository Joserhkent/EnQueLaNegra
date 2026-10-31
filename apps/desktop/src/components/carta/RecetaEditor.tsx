import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { usePosStore, type Insumo } from "../../store/usePosStore";
import { formatCantidad, opcionesUnidad, tienePresentacion } from "../../lib/cantidades";
import { cantidadBaseLinea, type LineaReceta } from "../../lib/receta";
import CantidadInput from "../inventario/CantidadInput";

const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Props = {
  lineas: LineaReceta[];
  onChange: (lineas: LineaReceta[]) => void;
  precio: number;
  error?: string | null;
};

/**
 * Receta del plato: lista de ingredientes con cantidad y unidad, más el costo
 * del plato y qué parte del precio se va en ingredientes (food cost).
 */
export default function RecetaEditor({ lineas, onChange, precio, error }: Props) {
  const insumos = usePosStore((s) => s.insumos);
  const [busqueda, setBusqueda] = useState("");
  const porId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);

  const resultados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    if (!q) return [];
    const yaEstan = new Set(lineas.map((l) => l.insumoId));
    return insumos
      .filter((i) => !yaEstan.has(i.id) && sinTildes(i.nombre).includes(q))
      .slice(0, 6);
  }, [busqueda, insumos, lineas]);

  const agregar = (insumo: Insumo) => {
    // Con porción o lata se piensa en porciones; si no, en gramos/ml/unidades
    onChange([...lineas, { insumoId: insumo.id, valor: "", clave: tienePresentacion(insumo) ? "pres" : "base" }]);
    setBusqueda("");
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
      <div>
        <p className="text-xs font-bold text-slate-700">Receta</p>
        <p className="text-[11px] text-slate-500">Lo que se descuenta del inventario por cada plato vendido.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (resultados[0]) agregar(resultados[0]);
            }
          }}
          placeholder="Agregar ingrediente: pollo, queso, harina…"
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
        {resultados.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100">
            {resultados.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => agregar(i)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-amber-50"
                >
                  <span className="text-xs font-semibold text-slate-900">{i.nombre}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">{i.categoria}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {busqueda.trim() && resultados.length === 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            No hay insumos con «{busqueda.trim()}». Créalo primero en Inventario.
          </p>
        )}
      </div>

      {lineas.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 py-4 text-center text-[11px] text-slate-500">
          Sin ingredientes: este plato no descuenta nada del inventario.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md">
          {lineas.map((l) => {
            const i = porId.get(l.insumoId);
            const base = cantidadBaseLinea(i, l);
            const costo = costoLinea(l);
            return (
              <li key={l.insumoId} className="grid grid-cols-[1fr_8.5rem_auto] items-center gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{i?.nombre ?? l.insumoId}</p>
                  <p className="text-[11px] text-slate-500">
                    {i && base && l.clave !== "base" ? `${formatCantidad(base, i.unidadMedida)} · ` : ""}
                    {costo !== null ? `S/ ${costo.toFixed(2)}` : base ? "sin costo" : "falta cantidad"}
                  </p>
                </div>
                {i ? (
                  <CantidadInput
                    opciones={opcionesUnidad(i)}
                    clave={l.clave}
                    valor={l.valor}
                    onValor={(valor) => cambiar(l.insumoId, { valor })}
                    onClave={(clave) => cambiar(l.insumoId, { clave })}
                    autoFocus={!l.valor}
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
