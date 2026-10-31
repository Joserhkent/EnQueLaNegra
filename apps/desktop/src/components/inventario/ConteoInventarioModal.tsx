import { useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { usePosStore, type Insumo } from "../../store/usePosStore";
import {
  factorDe,
  formatCantidad,
  formatConPresentacion,
  leerNumero,
  opcionPreferida,
  opcionesUnidad,
  type OpcionUnidad,
} from "../../lib/cantidades";
import CantidadInput from "./CantidadInput";

type Conteo = { valor: string; clave: OpcionUnidad["clave"] };

const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Props = {
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
};

/**
 * Conteo de inventario: se escribe lo que hay de verdad y el sistema muestra la
 * diferencia con lo que esperaba. Se puede contar por partes (una categoría a la
 * vez); solo se guardan los insumos que se llenaron.
 */
export default function ConteoInventarioModal({ onClose, onGuardado }: Props) {
  const { insumos, registrarLoteStock } = usePosStore();
  const [categoria, setCategoria] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [conteos, setConteos] = useState<Record<string, Conteo>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const categorias = useMemo(
    () => ["Todas", ...[...new Set(insumos.map((i) => i.categoria || "Sin categoría"))].sort()],
    [insumos]
  );

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return insumos
      .filter((i) => categoria === "Todas" || (i.categoria || "Sin categoría") === categoria)
      .filter((i) => !q || sinTildes(i.nombre).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [insumos, categoria, busqueda]);

  const conteoDe = (i: Insumo): Conteo =>
    // Se cuenta en latas o bolsas si tiene presentación; si no, en kg o L
    conteos[i.id] ?? { valor: "", clave: opcionPreferida(i) };

  const contado = (i: Insumo) => {
    const c = conteos[i.id];
    if (!c) return null;
    const n = leerNumero(c.valor);
    return n === null ? null : n * factorDe(i, c.clave);
  };

  const llenos = insumos.filter((i) => contado(i) !== null);
  const conDiferencia = llenos.filter((i) => Math.abs((contado(i) ?? 0) - i.stockActual) > 1e-9);

  const guardar = async () => {
    if (llenos.length === 0) {
      setError("Escribe lo que contaste de al menos un insumo.");
      return;
    }
    setGuardando(true);
    setError(null);
    const fallo = await registrarLoteStock(
      "ajuste",
      llenos.map((i) => ({ insumoId: i.id, cantidad: contado(i)! }))
    );
    setGuardando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    onGuardado(
      conDiferencia.length
        ? `Conteo guardado: ${llenos.length} contados, ${conDiferencia.length} con diferencia.`
        : `Conteo guardado: ${llenos.length} contados, todo cuadra.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-lg shadow-xl border border-slate-200 flex flex-col max-h-dvh sm:max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Contar inventario</h3>
            <p className="text-xs text-slate-500">
              Escribe lo que hay. Puedes contar solo una parte; lo vacío no cambia.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar insumo"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-md text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap border transition ${
                  categoria === c
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {visibles.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Sin insumos con ese filtro.</p>
          ) : (
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {visibles.map((i) => {
                const c = conteoDe(i);
                const n = contado(i);
                const diff = n === null ? null : n - i.stockActual;
                return (
                  <li key={i.id} className="p-3 grid grid-cols-[1fr_9.5rem] sm:grid-cols-[1fr_11rem] items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{i.nombre}</p>
                      <p className="text-xs text-slate-500">
                        Sistema: {formatConPresentacion(i.stockActual, i)}
                        {diff !== null && Math.abs(diff) > 1e-9 && (
                          <span className={`ml-1.5 font-bold ${diff < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                            {diff < 0 ? "falta " : "sobra "}
                            {formatCantidad(Math.abs(diff), i.unidadMedida)}
                          </span>
                        )}
                        {diff !== null && Math.abs(diff) <= 1e-9 && (
                          <span className="ml-1.5 font-bold text-emerald-700">cuadra</span>
                        )}
                      </p>
                    </div>
                    <CantidadInput
                      opciones={opcionesUnidad(i)}
                      clave={c.clave}
                      valor={c.valor}
                      onValor={(valor) => setConteos((prev) => ({ ...prev, [i.id]: { ...c, valor } }))}
                      onClave={(clave) => setConteos((prev) => ({ ...prev, [i.id]: { ...c, clave } }))}
                      placeholder="—"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 space-y-3">
          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <p className="hidden sm:block flex-1 text-xs text-slate-500">
              {llenos.length} contados · {conDiferencia.length} con diferencia
            </p>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || llenos.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-bold"
            >
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              {llenos.length > 0 ? `Guardar conteo (${llenos.length})` : "Guardar conteo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
