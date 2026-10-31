import { useMemo, useState } from "react";
import { Loader2, Search, Trash2, X } from "lucide-react";
import { usePosStore, type Insumo } from "../../store/usePosStore";
import {
  factorDe,
  formatConPresentacion,
  formatCosto,
  leerNumero,
  opcionPreferida,
  opcionesUnidad,
  type OpcionUnidad,
} from "../../lib/cantidades";
import CantidadInput from "./CantidadInput";

type Linea = {
  insumo: Insumo;
  cantidad: string;
  clave: OpcionUnidad["clave"];
  costoTotal: string;
};

const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Props = {
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
};

/**
 * Recibir mercadería: se arma la lista de lo que llegó (buscar, escribir cantidad
 * y, si se quiere, cuánto se pagó) y se guarda todo de una vez.
 */
export default function RecibirMercaderiaModal({ onClose, onGuardado }: Props) {
  const { insumos, registrarLoteStock } = usePosStore();
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const resultados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    if (!q) return [];
    const yaEstan = new Set(lineas.map((l) => l.insumo.id));
    return insumos
      .filter((i) => !yaEstan.has(i.id) && sinTildes(i.nombre).includes(q))
      .slice(0, 6);
  }, [busqueda, insumos, lineas]);

  const agregar = (insumo: Insumo) => {
    // Se compra por presentación (latas, bolsas) o, si no tiene, por kilo o litro
    setLineas((prev) => [
      { insumo, cantidad: "", clave: opcionPreferida(insumo), costoTotal: "" },
      ...prev,
    ]);
    setBusqueda("");
    setError(null);
  };

  const cambiar = (id: string, cambios: Partial<Linea>) =>
    setLineas((prev) => prev.map((l) => (l.insumo.id === id ? { ...l, ...cambios } : l)));

  // Cantidad en la unidad del sistema (g, ml, unidad…)
  const cantidadBase = (l: Linea) => {
    const n = leerNumero(l.cantidad);
    return n === null ? null : n * factorDe(l.insumo, l.clave);
  };

  const listas = lineas.filter((l) => (cantidadBase(l) ?? 0) > 0);

  const guardar = async () => {
    if (listas.length === 0) {
      setError("Escribe la cantidad que llegó de al menos un insumo.");
      return;
    }
    setGuardando(true);
    setError(null);
    const items = listas.map((l) => {
      const cantidad = cantidadBase(l)!;
      const total = leerNumero(l.costoTotal);
      return {
        insumoId: l.insumo.id,
        cantidad,
        ...(total !== null && total > 0 ? { costoUnitario: total / cantidad } : {}),
      };
    });
    const fallo = await registrarLoteStock("entrada", items, nota.trim() ? `Recepción: ${nota.trim()}` : undefined);
    setGuardando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    onGuardado(`Mercadería registrada: ${items.length} ${items.length === 1 ? "insumo" : "insumos"}.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-lg shadow-xl border border-slate-200 flex flex-col max-h-dvh sm:max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Recibir mercadería</h3>
            <p className="text-xs text-slate-500">Suma al stock lo que llegó. El costo es opcional.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && resultados[0]) agregar(resultados[0]);
              }}
              placeholder="Buscar insumo: pollo, harina, coca cola…"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-md text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
          {resultados.length > 0 && (
            <ul className="absolute left-5 right-5 mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100">
              {resultados.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => agregar(i)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-amber-50"
                  >
                    <span className="text-sm font-semibold text-slate-900">{i.nombre}</span>
                    <span className="text-xs text-slate-500 shrink-0">
                      hay {formatConPresentacion(i.stockActual, i)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busqueda.trim() && resultados.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">
              No hay insumos con «{busqueda.trim()}». Si es nuevo, créalo en «Nuevo insumo».
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lineas.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Busca cada insumo que llegó y escribe cuánto.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {lineas.map((l) => {
                const base = cantidadBase(l);
                const total = leerNumero(l.costoTotal);
                return (
                  <li key={l.insumo.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{l.insumo.nombre}</p>
                        <p className="text-xs text-slate-500">
                          Hay {formatConPresentacion(l.insumo.stockActual, l.insumo)}
                          {base ? ` · quedará ${formatConPresentacion(l.insumo.stockActual + base, l.insumo)}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLineas((prev) => prev.filter((x) => x.insumo.id !== l.insumo.id))}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        aria-label={`Quitar ${l.insumo.nombre}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="block text-[11px] font-bold text-slate-600">Llegó</span>
                        <CantidadInput
                          opciones={opcionesUnidad(l.insumo)}
                          clave={l.clave}
                          valor={l.cantidad}
                          onValor={(cantidad) => cambiar(l.insumo.id, { cantidad })}
                          onClave={(clave) => cambiar(l.insumo.id, { clave })}
                          autoFocus
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] font-bold text-slate-600">Pagaste en total (opcional)</span>
                        <div className="flex items-stretch rounded-md border border-slate-300 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
                          <span className="px-2.5 flex items-center border-r border-slate-200 text-xs font-semibold text-slate-500">S/</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={l.costoTotal}
                            onChange={(e) => cambiar(l.insumo.id, { costoTotal: e.target.value })}
                            placeholder="0.00"
                            className="w-full min-w-0 px-2.5 py-2 text-right text-sm font-bold text-slate-900 outline-none rounded-r-md"
                          />
                        </div>
                      </label>
                    </div>
                    {base && total ? (
                      <p className="text-[11px] text-slate-500 text-right">{formatCosto(total / base, l.insumo)}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 space-y-3">
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Proveedor o nota (opcional): Makro, mercado…"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || listas.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-sm font-bold"
            >
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              {listas.length > 0 ? `Guardar ${listas.length} ${listas.length === 1 ? "insumo" : "insumos"}` : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
