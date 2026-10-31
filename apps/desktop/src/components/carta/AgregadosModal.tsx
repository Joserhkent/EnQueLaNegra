import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { usePosStore, type Agregado } from "../../store/usePosStore";
import { formatCantidad, leerNumero, tienePresentacion } from "../../lib/cantidades";
import { cantidadBaseLinea, lineaDesdeCantidad, opcionesReceta, type LineaReceta } from "../../lib/receta";
import CantidadInput from "../inventario/CantidadInput";

type Borrador = { id: string | null; nombre: string; precio: string; linea: LineaReceta | null; activo: boolean };

const VACIO: Borrador = { id: null, nombre: "", precio: "", linea: null, activo: true };

/**
 * Agregados que se cobran aparte en un plato ("+ tocineta S/ 2"). La jefa pone
 * el precio y cuánto del insumo gasta cada uno, para que el stock cuadre.
 */
export default function AgregadosModal({ onClose }: { onClose: () => void }) {
  const { agregados, insumos, guardarAgregado, borrarAgregado } = usePosStore();
  const porId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, typeof insumos>();
    for (const i of [...insumos].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
      const c = i.categoria || "Sin categoría";
      grupos.set(c, [...(grupos.get(c) ?? []), i]);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [insumos]);

  const editar = (a: Agregado) => {
    setError(null);
    setBorrador({
      id: a.id,
      nombre: a.nombre,
      precio: String(a.precio),
      linea: lineaDesdeCantidad(porId.get(a.insumoId), a.insumoId, a.consumo),
      activo: a.activo,
    });
  };

  const elegirInsumo = (insumoId: string) => {
    const insumo = porId.get(insumoId);
    if (!borrador || !insumo) return;
    setBorrador({
      ...borrador,
      // El nombre sale del insumo si aún no se escribió uno
      nombre: borrador.nombre || insumo.nombre,
      linea: { insumoId, valor: "", clave: tienePresentacion(insumo) ? "pres" : "base" },
    });
  };

  const insumoBorrador = borrador?.linea ? porId.get(borrador.linea.insumoId) : undefined;
  const consumoBorrador = borrador?.linea ? cantidadBaseLinea(insumoBorrador, borrador.linea) : null;
  const costoBorrador =
    insumoBorrador && consumoBorrador && insumoBorrador.costoUnitario > 0
      ? consumoBorrador * insumoBorrador.costoUnitario
      : null;

  const guardar = async () => {
    if (!borrador) return;
    const precio = leerNumero(borrador.precio);
    if (!borrador.nombre.trim()) return setError("Escribe el nombre del agregado.");
    if (!borrador.linea) return setError("Elige de qué insumo sale.");
    if (!consumoBorrador) return setError("Escribe cuánto lleva cada agregado.");
    if (precio === null) return setError("Escribe el precio.");
    setGuardando(true);
    setError(null);
    const fallo = await guardarAgregado(borrador.id, {
      nombre: borrador.nombre.trim(),
      precio,
      insumoId: borrador.linea.insumoId,
      consumo: consumoBorrador,
      activo: borrador.activo,
    });
    setGuardando(false);
    if (fallo) return setError(fallo);
    setBorrador(null);
  };

  const alternarActivo = async (a: Agregado) => {
    const fallo = await guardarAgregado(a.id, { activo: !a.activo });
    if (fallo) setError(fallo);
  };

  const borrar = async (a: Agregado) => {
    const fallo = await borrarAgregado(a.id);
    if (fallo) setError(fallo);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-lg shadow-xl border border-slate-200 flex flex-col max-h-dvh sm:max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Agregados</h3>
            <p className="text-xs text-slate-500">Lo que se cobra aparte en un plato. Solo los activos se ofrecen al pedir.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {borrador ? (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="block text-xs font-bold text-slate-700">Sale del insumo</span>
                <select
                  value={borrador.linea?.insumoId ?? ""}
                  onChange={(e) => elegirInsumo(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-900 bg-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="" disabled>
                    Elige el insumo…
                  </option>
                  {porCategoria.map(([cat, lista]) => (
                    <optgroup key={cat} label={cat}>
                      {lista.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="block text-xs font-bold text-slate-700">Nombre en la carta</span>
                  <input
                    type="text"
                    value={borrador.nombre}
                    onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                    maxLength={40}
                    placeholder="Ej. Tocineta"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-bold text-slate-700">Precio</span>
                  <div className="flex items-stretch rounded-md border border-slate-300 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
                    <span className="px-2.5 flex items-center border-r border-slate-200 text-xs font-semibold text-slate-500">S/</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={borrador.precio}
                      onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })}
                      placeholder="0.00"
                      className="w-full min-w-0 px-2.5 py-2 text-right text-sm font-bold text-slate-900 outline-none rounded-r-md"
                    />
                  </div>
                </label>
              </div>

              {borrador.linea && insumoBorrador && (
                <label className="block space-y-1">
                  <span className="block text-xs font-bold text-slate-700">Cuánto lleva cada uno</span>
                  <CantidadInput
                    opciones={opcionesReceta(insumoBorrador)}
                    clave={borrador.linea.clave}
                    valor={borrador.linea.valor}
                    onValor={(valor) => setBorrador({ ...borrador, linea: { ...borrador.linea!, valor } })}
                    onClave={(clave) => setBorrador({ ...borrador, linea: { ...borrador.linea!, clave } })}
                  />
                  <span className="block text-[11px] text-slate-500">
                    {consumoBorrador
                      ? `Descuenta ${formatCantidad(consumoBorrador, insumoBorrador.unidadMedida)} de ${insumoBorrador.nombre}` +
                        (costoBorrador !== null ? ` · te cuesta S/ ${costoBorrador.toFixed(2)}` : "")
                      : "Se descuenta del inventario cada vez que se vende."}
                  </span>
                </label>
              )}

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={borrador.activo}
                  onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
                Activo (se ofrece al pedir)
              </label>
            </div>
          ) : agregados.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Todavía no hay agregados.</p>
          ) : (
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {agregados.map((a) => {
                const insumo = porId.get(a.insumoId);
                return (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${a.activo ? "text-slate-900" : "text-slate-400"}`}>
                        {a.nombre} <span className="font-semibold">· S/ {a.precio.toFixed(2)}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {insumo ? `${formatCantidad(a.consumo, insumo.unidadMedida)} de ${insumo.nombre}` : "Insumo borrado"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => alternarActivo(a)}
                      className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                        a.activo
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                      title={a.activo ? "Dejar de ofrecerlo" : "Volver a ofrecerlo"}
                    >
                      {a.activo ? "Activo" : "Apagado"}
                    </button>
                    <button
                      type="button"
                      onClick={() => editar(a)}
                      className="p-2 rounded-md border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                      aria-label={`Editar ${a.nombre}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => borrar(a)}
                      className="p-2 rounded-md border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      aria-label={`Borrar ${a.nombre}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
          {borrador ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBorrador(null);
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-sm font-bold"
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar agregado
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setBorrador(VACIO);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold"
            >
              <Plus className="w-4 h-4" /> Nuevo agregado
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
