import { X, ClipboardList, User, Utensils, MessageSquareText } from "lucide-react";
import { type Order } from "../store/usePosStore";

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Detalle de Comanda {order.code}</h3>
              <p className="text-xs text-slate-400">
                {order.fecha} • {order.hora}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase mb-1">
                <User className="w-3.5 h-3.5" /> Cliente / Mesa
              </div>
              <div className="text-sm font-bold text-slate-900">{order.customer}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo / Pago</div>
              <div className="text-sm font-bold text-slate-900">
                {order.type} • {order.paymentMethod}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Utensils className="w-4 h-4" /> Productos del pedido
            </h4>

            {order.items.map((item, idx) => {
              // Las cremas se guardan con precio 0, los agregados con precio > 0
              const cremasDelItem = (item.extras || []).filter((e) => e.precioExtra === 0);
              const agregadosDelItem = (item.extras || []).filter((e) => e.precioExtra > 0);

              return (
                <div
                  key={idx}
                  className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-sm">
                      {item.cantidad}x {item.nombre}
                    </div>
                    <div className="font-extrabold text-slate-900 text-sm">
                      S/ {(item.precio * item.cantidad).toFixed(2)}
                    </div>
                  </div>

                  {item.notas && item.notas.trim() !== "" && (
                    <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <MessageSquareText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-amber-900 font-medium italic">
                        "{item.notas}"
                      </span>
                    </div>
                  )}

                  {cremasDelItem.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Cremas / Aderezos
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cremasDelItem.map((crema, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20"
                          >
                            {crema.insumo?.nombre || "Crema/Aderezo"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {agregadosDelItem.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Agregados
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {agregadosDelItem.map((agregado, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-700 border border-blue-500/20"
                          >
                            {agregado.insumo?.nombre || "Agregado"} +S/{agregado.precioExtra.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!item.notas || item.notas.trim() === "") &&
                    cremasDelItem.length === 0 &&
                    agregadosDelItem.length === 0 && (
                      <div className="text-[11px] text-slate-400 italic">
                        Sin personalización
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
            <span className="text-xs font-bold text-amber-900">Total del Pedido</span>
            <span className="text-xl font-extrabold text-amber-900">
              S/ {order.total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}