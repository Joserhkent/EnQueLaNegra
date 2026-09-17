import { X, Printer } from "lucide-react";
import { type Order } from "../store/usePosStore";

export type TicketMode = "boleta" | "precuenta" | "comanda";

interface TicketReceiptModalProps {
  order: Order | null;
  mode?: TicketMode;
  onClose: () => void;
}

const MODE_META: Record<TicketMode, { title: string; screenLabel: string; printLabel: string }> = {
  boleta: { title: "BOLETA DE VENTA", screenLabel: "Boleta Térmica POS", printLabel: "Imprimir Boleta POS" },
  precuenta: { title: "PRE-CUENTA", screenLabel: "Pre-Cuenta (no fiscal)", printLabel: "Imprimir Pre-Cuenta" },
  comanda: { title: "COMANDA DE COCINA", screenLabel: "Comanda de Cocina", printLabel: "Imprimir Comanda" },
};

export default function TicketReceiptModal({ order, mode = "boleta", onClose }: TicketReceiptModalProps) {
  if (!order) return null;

  const meta = MODE_META[mode];
  const isComanda = mode === "comanda";
  const isMesa = order.type === "Mesa" || !!order.tableId || !!order.table;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      {/* Thermal Printer Media Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-ticket, #printable-ticket * {
            visibility: visible !important;
          }
          #printable-ticket {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            max-width: 78mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            font-family: monospace, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            background: #ffffff !important;
          }
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:w-full print:max-w-none print:p-0">

        {/* Screen Header (Hidden on Print) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm">{meta.screenLabel}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Ticket Receipt Area */}
        <div id="printable-ticket" className="p-6 bg-amber-50/30 text-slate-900 font-mono text-xs space-y-4 print:p-2 print:bg-white">

          {/* Header & Logo */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 p-1 border border-slate-800 flex items-center justify-center overflow-hidden mb-1 print:hidden text-2xl">
              🌽
            </div>
            <h2 className="font-black text-base tracking-tight text-slate-900 uppercase">En que la Negra</h2>
            <p className="text-[10px] font-sans text-slate-600 font-medium">Sabor Venezolano de Siempre</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">{meta.title}</p>
          </div>

          {/* Ticket Metadata */}
          <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-400">
            <div className="flex justify-between font-bold">
              <span>COMANDA:</span>
              <span className="text-amber-700 font-extrabold">{order.code}</span>
            </div>
            <div className="flex justify-between">
              <span>FECHA / HORA:</span>
              <span>{order.fecha} {order.hora}</span>
            </div>
            {isMesa && order.table?.number && (
              <div className="flex justify-between">
                <span>MESA:</span>
                <span className="font-bold">N° {order.table.number}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>CLIENTE:</span>
              <span className="font-bold">{order.customer}</span>
            </div>
            <div className="flex justify-between">
              <span>SERVICIO:</span>
              <span>{order.type}</span>
            </div>
            {order.user?.name && (
              <div className="flex justify-between">
                <span>ATENDIDO POR:</span>
                <span className="font-bold">{order.user.name}</span>
              </div>
            )}
          </div>

          {/* Items Breakdown Table */}
          <div className="space-y-2 pb-3 border-b border-dashed border-slate-400">
            <div className="flex justify-between font-bold text-[10px] uppercase text-slate-500 pb-1">
              <span>CANT / PRODUCTO</span>
              {!isComanda && <span>TOTAL</span>}
            </div>

            {order.items.map((item, idx) => {
              const extrasTotal = (item.extras || []).reduce(
                (sum, e) => sum + e.precioExtra * e.cantidad,
                0
              );
              const lineTotal = item.precio * item.cantidad + extrasTotal;

              const cremasDelItem = (item.extras || []).filter((e) => e.precioExtra === 0);
              const agregadosDelItem = (item.extras || []).filter((e) => e.precioExtra > 0);

              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between items-start text-[11px]">
                    <div className="pr-2">
                      <div className="font-bold text-slate-900">
                        {item.cantidad}x {item.nombre}
                      </div>
                      {!isComanda && (
                        <div className="text-[9px] text-slate-500">@ ${item.precio.toFixed(2)} c/u</div>
                      )}
                    </div>
                    {!isComanda && (
                      <span className="font-extrabold shrink-0">
                        ${lineTotal.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {item.notas && item.notas.trim() !== "" && (
                    <div className="text-[9px] text-slate-600 italic pl-2">
                      • Nota: {item.notas}
                    </div>
                  )}

                  {cremasDelItem.map((crema, i) => (
                    <div key={`crema-${i}`} className="text-[9px] text-slate-600 pl-2">
                      • {crema.insumo?.nombre || "Salsa/Aderezo"}
                    </div>
                  ))}

                  {agregadosDelItem.map((agregado, i) => (
                    <div key={`agregado-${i}`} className="flex justify-between text-[9px] text-slate-600 pl-2">
                      <span>+ {agregado.insumo?.nombre || "Agregado"}</span>
                      {!isComanda && <span>${agregado.precioExtra.toFixed(2)}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Payment & Totals Breakdown (oculto en la comanda de cocina) */}
          {!isComanda && (
            <div className="space-y-1.5 pt-1 text-[11px]">
              <div className="flex justify-between items-center text-sm font-black pt-1">
                <span>{mode === "precuenta" ? "TOTAL ESTIMADO:" : "TOTAL A PAGAR:"}</span>
                <span className="text-slate-950 text-base font-extrabold">${order.total.toFixed(2)}</span>
              </div>

              {mode === "boleta" && (
                <>
                  <div className="flex justify-between text-[10px] text-slate-700 border-t border-slate-300 pt-2">
                    <span>FORMA DE PAGO:</span>
                    <span className="font-bold uppercase text-slate-900">{order.paymentMethod}</span>
                  </div>

                  {order.paymentMethod === "Mixto" && (
                    <div className="bg-slate-100 p-2 rounded-xl text-[10px] space-y-0.5 mt-1 border border-slate-300">
                      <div className="flex justify-between text-slate-700">
                        <span>• En Yape / Plin:</span>
                        <span className="font-bold">${(order.montoDigital || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>• En Efectivo:</span>
                        <span className="font-bold">${(order.montoEfectivo || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {mode === "precuenta" && (
                <p className="text-[9px] text-slate-500 italic pt-1">
                  Este documento es informativo, no reemplaza la boleta fiscal final.
                </p>
              )}
            </div>
          )}

          {/* Footer Message */}
          <div className="text-center pt-3 border-t border-dashed border-slate-400 space-y-1 text-[10px] text-slate-600">
            {isComanda ? (
              <p className="font-bold text-slate-900">🔥 Enviar a cocina</p>
            ) : (
              <>
                <p className="font-bold text-slate-900">¡Gracias por su preferencia! 🌽</p>
                <p className="text-[9px] text-slate-500">Conserve su comprobante de pago</p>
              </>
            )}
            <p className="text-[8px] text-slate-400 font-sans">En que la Negra POS System</p>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Printer className="w-4 h-4" /> {meta.printLabel}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
