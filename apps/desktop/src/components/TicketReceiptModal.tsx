import { X, Printer } from "lucide-react";
import { type Order, usePosStore } from "../store/usePosStore";

export type TicketMode = "boleta" | "precuenta" | "comanda";

interface TicketReceiptModalProps {
  order: Order | null;
  mode?: TicketMode;
  /** Número de mesa opcional: fuerza mostrar "MESA N° X" aunque el pedido
   *  venga sin la relación `table` resuelta desde el backend. */
  mesaNumero?: number | null;
  /** Si se indica, la comanda de cocina imprime SOLO los ítems de esa ronda
   *  (tanda), no toda la cuenta acumulada de la mesa. */
  soloRonda?: number | null;
  onClose: () => void;
}

const MODE_META: Record<TicketMode, { title: string; screenLabel: string; printLabel: string }> = {
  boleta: { title: "BOLETA DE VENTA", screenLabel: "Boleta Térmica POS", printLabel: "Imprimir Boleta POS" },
  precuenta: { title: "PRE-CUENTA", screenLabel: "Pre-Cuenta (no fiscal)", printLabel: "Imprimir Pre-Cuenta" },
  comanda: { title: "COMANDA DE COCINA", screenLabel: "Comanda de Cocina", printLabel: "Imprimir Comanda" },
};

export default function TicketReceiptModal({ order, mode = "boleta", mesaNumero, soloRonda, onClose }: TicketReceiptModalProps) {
  // La descripción del producto no viaja en el OrderItem; se resuelve contra el
  // catálogo por SKU. Solo importa para la comanda de cocina (el detalle de
  // preparación), en la boleta se imprime igual que siempre.
  // El hook va antes de cualquier return para respetar las reglas de React.
  const productos = usePosStore((s) => s.productos);
  const mesas = usePosStore((s) => s.mesas);

  if (!order) return null;

  const meta = MODE_META[mode];
  const isComanda = mode === "comanda";
  const isMesa = order.type === "Mesa" || !!order.tableId || !!order.table;

  // Número de mesa: prioridad al prop explícito, luego a la relación del pedido
  // y como última opción se busca la mesa en el store por su tableId (cubre los
  // casos donde el backend no anida `table` dentro del pedido).
  const numeroMesa =
    mesaNumero ??
    order.table?.number ??
    (order.tableId ? mesas.find((m) => m.id === order.tableId)?.number : undefined);

  const descripcionDe = (sku: string) =>
    productos.find((p) => p.sku === sku)?.descripcion?.trim() || "";

  // La mesa es acumulativa (cada tanda suma una ronda). Cuando cocina pide el
  // ticket de una tanda puntual, se filtran solo los ítems de esa ronda: lo que
  // ya se envió antes no se vuelve a imprimir.
  const itemsAImprimir =
    isComanda && soloRonda != null
      ? order.items.filter((i) => (i.ronda ?? 1) === soloRonda)
      : order.items;

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
            <img src="/logo.jpg" alt="En que la Negra" className="w-32 mx-auto mb-1 print:hidden" />
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
            {/* Número de mesa GRANDE y destacado: es lo primero que cocina debe ver */}
            {isComanda && numeroMesa ? (
              <div className="text-center py-2 bg-slate-900 text-white rounded-lg -mx-1">
                <div className="text-[9px] uppercase tracking-widest text-amber-400 font-bold">MESA</div>
                <div className="text-2xl font-black leading-none">N° {numeroMesa}</div>
                {soloRonda != null && (
                  <div className="text-[9px] uppercase tracking-widest text-amber-300 font-bold mt-0.5">
                    TANDA {soloRonda} · SOLO ESTOS ÍTEMS
                  </div>
                )}
              </div>
            ) : (
              isMesa && numeroMesa && (
                <div className="flex justify-between">
                  <span>MESA:</span>
                  <span className="font-bold">N° {numeroMesa}</span>
                </div>
              )
            )}
            {!isComanda && (
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-bold">{order.customer}</span>
              </div>
            )}
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
              <span>{isComanda ? "PEDIDO (COCINA)" : "CANT / PRODUCTO"}</span>
              {!isComanda && <span>TOTAL</span>}
            </div>

            {itemsAImprimir.map((item, idx) => {
              // Los extras se cobran por unidad del plato (igual que en el backend)
              const extrasTotal =
                (item.extras || []).reduce(
                  (sum, e) => sum + e.precioExtra * e.cantidad,
                  0
                ) * item.cantidad;
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
                        <div className="text-[9px] text-slate-500">@ S/ {item.precio.toFixed(2)} c/u</div>
                      )}
                    </div>
                    {!isComanda && (
                      <span className="font-extrabold shrink-0">
                        S/ {lineTotal.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {isComanda && descripcionDe(item.sku) && (
                    <div className="text-[10px] text-slate-800 pl-2 leading-snug">
                      • {descripcionDe(item.sku)}
                    </div>
                  )}

                  {/* Nota del mesero: aquí escriben las cremas/salsas a mano
                      ("con mayonesa, ketchup y sin cebolla"), se imprime tal cual */}
                  {item.notas && item.notas.trim() !== "" && (
                    <div className="text-[10px] font-bold text-slate-900 italic pl-2">
                      • {item.notas.trim()}
                    </div>
                  )}

                  {cremasDelItem.length > 0 && (
                    <div className="text-[9px] text-slate-500 uppercase font-bold pl-2 pt-0.5">Cremas / Salsas:</div>
                  )}
                  {cremasDelItem.map((crema, i) => (
                    <div key={`crema-${i}`} className="text-[10px] font-semibold text-slate-800 pl-3">
                      + {crema.insumo?.nombre || "Salsa/Aderezo"}{crema.cantidad > 1 ? ` x${crema.cantidad}` : ""}
                    </div>
                  ))}

                  {agregadosDelItem.length > 0 && (
                    <div className="text-[9px] text-slate-500 uppercase font-bold pl-2 pt-0.5">Agregados:</div>
                  )}
                  {agregadosDelItem.map((agregado, i) => (
                    <div key={`agregado-${i}`} className="flex justify-between text-[10px] font-semibold text-slate-800 pl-3">
                      <span>+ {agregado.insumo?.nombre || "Agregado"}{agregado.cantidad > 1 ? ` x${agregado.cantidad}` : ""}</span>
                      {!isComanda && <span>S/ {agregado.precioExtra.toFixed(2)}</span>}
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
                <span className="text-slate-950 text-base font-extrabold">S/ {order.total.toFixed(2)}</span>
              </div>

              {mode === "precuenta" && (order.pagos?.length ?? 0) > 0 && (() => {
                const pagado = (order.pagos || []).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
                const saldo = Math.max(0, order.total - pagado);
                return (
                  <div className="bg-blue-50 p-2 rounded-xl text-[10px] space-y-0.5 mt-1 border-blue-200">
                    <div className="flex justify-between text-emerald-700"><span>• Pagado:</span><span className="font-bold">S/ {pagado.toFixed(2)}</span></div>
                    <div className="flex justify-between text-blue-800"><span>• Saldo pendiente:</span><span className="font-bold">S/ {saldo.toFixed(2)}</span></div>
                  </div>
                );
              })()}

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
                        <span className="font-bold">S/ {(order.montoDigital || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>• En Efectivo:</span>
                        <span className="font-bold">S/ {(order.montoEfectivo || 0).toFixed(2)}</span>
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
              <p className="font-bold text-slate-900">🔥 COMANDA DE COCINA — PREPARAR PEDIDO</p>
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
