import { X } from "lucide-react";
import type { Agregado, Producto } from "../../store/usePosStore";

type Props = {
  producto: Producto;
  agregados: Agregado[];
  cantidad: number;
  notas: string;
  agregadosSeleccionados: string[];
  textoConfirmar: string;
  onCantidadChange: (cantidad: number) => void;
  onNotasChange: (notas: string) => void;
  onToggleAgregado: (agregado: string) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
};

export default function PersonalizarPedidoModal({
  producto,
  agregados,
  cantidad,
  notas,
  agregadosSeleccionados,
  textoConfirmar,
  onCantidadChange,
  onNotasChange,
  onToggleAgregado,
  onCancelar,
  onConfirmar,
}: Props) {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-xl border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] text-amber-400 font-extrabold">Personalizar pedido</div>
            <h3 className="font-bold text-base mt-1">{producto.iconoEmoji} {producto.nombre}</h3>
          </div>
          <button type="button" onClick={onCancelar} aria-label="Cerrar personalización" className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border-slate-200">
            <span className="text-xs font-bold text-slate-700">Cantidad</span>
            <div className="flex items-center gap-3 bg-white border-slate-200 rounded-md p-1">
              <button type="button" onClick={() => onCantidadChange(Math.max(1, cantidad - 1))} aria-label="Disminuir cantidad" className="w-7 h-7 rounded-lg font-bold text-slate-700 hover:bg-rose-100">-</button>
              <span className="w-5 text-center text-sm font-extrabold text-slate-900">{cantidad}</span>
              <button type="button" onClick={() => onCantidadChange(cantidad + 1)} aria-label="Aumentar cantidad" className="w-7 h-7 rounded-lg font-bold text-slate-700 hover:bg-emerald-100">+</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Descripción / indicaciones (incluye las cremas aquí)</label>
            <textarea rows={4} value={notas} onChange={(event) => onNotasChange(event.target.value)} placeholder="Ej: sin cebolla, con mayonesa, ketchup y queso cheddar..." className="w-full px-3 py-3 bg-slate-50 border-slate-200 rounded-md text-base font-medium text-slate-900 focus:outline-none focus:border-amber-500 resize-y" />
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 mb-1.5">Agregados</div>
            <div className="flex flex-wrap gap-1.5">
              {agregados.map((agregado) => (
                <button key={agregado.nombre} type="button" onClick={() => onToggleAgregado(agregado.nombre)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition ${agregadosSeleccionados.includes(agregado.nombre) ? "bg-blue-500 text-white border-blue-500" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
                  {agregado.nombre} +S/{agregado.precio.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={onCancelar} className="py-3 bg-white border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition">Cancelar</button>
            <button type="button" onClick={onConfirmar} className="py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition">{textoConfirmar}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
