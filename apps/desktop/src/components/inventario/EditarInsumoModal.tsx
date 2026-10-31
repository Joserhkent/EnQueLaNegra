import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { usePosStore, type Insumo } from "../../store/usePosStore";
import {
  factorDe,
  leerNumero,
  nombreOpcion,
  opcionPreferida,
  opcionesUnidad,
  type OpcionUnidad,
} from "../../lib/cantidades";
import CantidadInput from "./CantidadInput";

type Props = {
  insumo: Insumo;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
};

// Para mostrar 650 g como "5" latas sin arrastrar decimales de más
const aTexto = (n: number, decimales = 4) => (n ? String(Number(n.toFixed(decimales))) : "");

/**
 * Ajustes del insumo (solo jefa): cómo se compra (presentación), el mínimo y el
 * costo. Todo se escribe en la unidad cómoda y se guarda en la del sistema, que
 * es la que usan las recetas.
 */
export default function EditarInsumoModal({ insumo, onClose, onGuardado }: Props) {
  const { updateInsumo } = usePosStore();
  const claveInicial = opcionPreferida(insumo);
  const factorInicial = factorDe(insumo, claveInicial);

  const [presNombre, setPresNombre] = useState(insumo.presentacionNombre ?? "");
  // Cuánto trae: en kg si es grande, si no en la unidad del insumo
  const opcionesTrae = opcionesUnidad({ unidadMedida: insumo.unidadMedida });
  const [traeClave, setTraeClave] = useState<OpcionUnidad["clave"]>(
    insumo.presentacionCantidad && insumo.presentacionCantidad >= 1000 && opcionesTrae.length > 1 ? "grande" : "base"
  );
  const [traeValor, setTraeValor] = useState(
    aTexto((insumo.presentacionCantidad ?? 0) / factorDe(insumo, traeClave === "grande" ? "grande" : "base"))
  );

  const traeBase = (() => {
    const n = leerNumero(traeValor);
    return n === null ? null : n * (opcionesTrae.find((o) => o.clave === traeClave)?.factor ?? 1);
  })();
  // El insumo tal como quedaría, para ofrecer latas en el mínimo y el costo
  const borrador = {
    unidadMedida: insumo.unidadMedida,
    presentacionNombre: presNombre.trim() || null,
    presentacionCantidad: presNombre.trim() && traeBase ? traeBase : null,
  };
  const opciones = opcionesUnidad(borrador);

  const minInicial = aTexto(insumo.stockMinimo / factorInicial);
  const costoInicial = aTexto(insumo.costoUnitario * factorInicial, 2);
  const [minClave, setMinClave] = useState(claveInicial);
  const [minValor, setMinValor] = useState(minInicial);
  const [costoClave, setCostoClave] = useState(claveInicial);
  const [costoValor, setCostoValor] = useState(costoInicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const costoOpcion = opciones.find((o) => o.clave === costoClave) ?? opciones[0];
  const siguienteCosto = opciones[(opciones.indexOf(costoOpcion) + 1) % opciones.length];

  const guardar = async () => {
    if (presNombre.trim() && !traeBase) {
      setError(`Escribe cuánto trae 1 ${presNombre.trim()}.`);
      return;
    }
    const minimo = leerNumero(minValor) ?? 0;
    const costo = leerNumero(costoValor) ?? 0;
    // Lo que no se tocó no se manda: el redondeo de la pantalla no debe mover el valor guardado
    // (si cambió lo que trae la lata y se escribió en latas, también cuenta como tocado)
    const presCambio = borrador.presentacionCantidad !== (insumo.presentacionCantidad ?? null);
    const minTocado = minValor !== minInicial || minClave !== claveInicial || (presCambio && minClave === "pres");
    const costoTocado =
      costoValor !== costoInicial || costoClave !== claveInicial || (presCambio && costoClave === "pres");
    setGuardando(true);
    setError(null);
    const fallo = await updateInsumo(insumo.id, {
      presentacionNombre: borrador.presentacionNombre,
      presentacionCantidad: borrador.presentacionCantidad,
      ...(minTocado ? { stockMinimo: minimo * factorDe(borrador, minClave) } : {}),
      ...(costoTocado ? { costoUnitario: costo / costoOpcion.factor } : {}),
    });
    setGuardando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    onGuardado(`${insumo.nombre} actualizado.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-lg shadow-xl border border-slate-200 flex flex-col max-h-dvh sm:max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-900 truncate">{insumo.nombre}</h3>
            <p className="text-xs text-slate-500">
              Las recetas siguen en {insumo.unidadMedida}. Esto solo cambia cómo se compra y se cuenta.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-700">Cómo se compra (opcional)</legend>
            <p className="text-[11px] text-slate-500">
              Ej. lata de 130 g, bolsa de 1 kg. Así se puede recibir y contar en latas o bolsas.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-600">Se compra por</span>
                <input
                  type="text"
                  value={presNombre}
                  onChange={(e) => setPresNombre(e.target.value)}
                  placeholder="lata, bolsa…"
                  maxLength={30}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-600">
                  1 {presNombre.trim() || "presentación"} trae
                </span>
                <CantidadInput
                  opciones={opcionesTrae}
                  clave={traeClave}
                  valor={traeValor}
                  onValor={setTraeValor}
                  onClave={setTraeClave}
                />
              </label>
            </div>
          </fieldset>

          <label className="block space-y-1">
            <span className="block text-xs font-bold text-slate-700">Stock mínimo</span>
            <span className="block text-[11px] text-slate-500">Por debajo de esto el insumo sale en alerta.</span>
            <CantidadInput
              opciones={opciones}
              clave={minClave}
              valor={minValor}
              onValor={setMinValor}
              onClave={setMinClave}
            />
          </label>

          <label className="block space-y-1">
            <span className="block text-xs font-bold text-slate-700">Costo</span>
            <div className="flex items-stretch rounded-md border border-slate-300 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
              <span className="px-2.5 flex items-center border-r border-slate-200 text-xs font-semibold text-slate-500">S/</span>
              <input
                type="text"
                inputMode="decimal"
                value={costoValor}
                onChange={(e) => setCostoValor(e.target.value)}
                placeholder="0.00"
                className="w-full min-w-0 px-2.5 py-2 text-right text-sm font-bold text-slate-900 outline-none"
              />
              {opciones.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setCostoClave(siguienteCosto.clave)}
                  title={`Cambiar a por ${nombreOpcion(siguienteCosto, 1)}`}
                  className="shrink-0 max-w-[7.5rem] truncate px-2.5 border-l border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-r-md"
                >
                  por {nombreOpcion(costoOpcion, 1)} ⇄
                </button>
              ) : (
                <span className="shrink-0 px-2.5 flex items-center border-l border-slate-200 text-xs font-semibold text-slate-500">
                  por {nombreOpcion(costoOpcion, 1)}
                </span>
              )}
            </div>
          </label>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 space-y-3">
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
              disabled={guardando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-sm font-bold"
            >
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
