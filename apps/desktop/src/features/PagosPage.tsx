import { useState } from "react";
import { usePosStore } from "../store/usePosStore";
import {
  QrCode,
  Receipt,
  Lock,
  CheckCircle2,
  Search,
  Calculator,
  X,
  Coins
} from "lucide-react";

export default function PagosPage() {
  const { pedidos, cerrarCaja } = usePosStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"hoy" | "semana" | "mes" | "custom">("hoy");
  const [customDate, setCustomDate] = useState<string>("");

  // Vuelto Calculator Modal
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [orderAmount, setOrderAmount] = useState<string | number>("");
  const [cashReceived, setCashReceived] = useState<string | number>("");

  const numOrderAmount = typeof orderAmount === "number" ? orderAmount : (parseFloat(orderAmount) || 0);
  const numCashReceived = typeof cashReceived === "number" ? cashReceived : (parseFloat(cashReceived) || 0);
  const changeValue = Math.max(0, numCashReceived - numOrderAmount);

  // Cerrar Caja Modal
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [shiftNotes, setShiftNotes] = useState("");

  // Formatea una fecha a YYYY-MM-DD usando componentes LOCALES (no UTC) para evitar el desfase horario
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const getDateRange = () => {
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    if (dateFilter === "hoy") {
      return { start: todayStr, end: todayStr };
    }
    if (dateFilter === "semana") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { start: toLocalDateStr(start), end: todayStr };
    }
    if (dateFilter === "mes") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toLocalDateStr(start), end: todayStr };
    }
    if (dateFilter === "custom" && customDate) {
      return { start: customDate, end: customDate };
    }
    return { start: todayStr, end: todayStr };
  };

  const range = getDateRange();
  const validOrders = pedidos.filter((o) => o.status !== "cancelado");

  // Pedidos dentro del rango de fecha seleccionado (base para los KPIs y la tabla)
  const rangeOrders = validOrders.filter(
    (o) => !o.fecha || (o.fecha >= range.start && o.fecha <= range.end)
  );

  const totalSales = rangeOrders.reduce((acc, curr) => acc + curr.total, 0);

  // Normaliza el método de pago para comparar sin importar si viene como "Efectivo" (frontend)
  // o "EFECTIVO" / "YAPE_PLIN" (formato que devuelve el backend)
  const normalizePaymentMethod = (metodo: string) => metodo.toUpperCase().replace(/\s+/g, "_");

  const cashSales = rangeOrders.reduce((acc, o) => {
    const metodo = normalizePaymentMethod(o.paymentMethod);
    if (metodo === "EFECTIVO") return acc + o.total;
    if (metodo === "MIXTO") return acc + (o.montoEfectivo || 0);
    return acc;
  }, 0);

  const yapePlinSales = rangeOrders.reduce((acc, o) => {
    const metodo = normalizePaymentMethod(o.paymentMethod);
    if (metodo === "YAPE/PLIN" || metodo === "YAPE_PLIN") return acc + o.total;
    if (metodo === "MIXTO") return acc + (o.montoDigital || 0);
    return acc;
  }, 0);

  const filteredOrders = rangeOrders.filter((order) => {
    const matchesMethod = methodFilter === "all" || order.paymentMethod === methodFilter;
    const matchesSearch =
      order.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMethod && matchesSearch;
  });

  const handleConfirmCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    cerrarCaja("Administrador", shiftNotes || "Cierre de turno correcto");
    setIsCloseShiftOpen(false);
    setShiftNotes("");
    alert("¡Caja de turno cerrada con éxito!");
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Pagos & Caja POS</h1>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5" /> Turno En Curso
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Arqueo de caja, desglose por métodos de pago, calculadora de vuelto y cierre de turno.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-3 rounded-2xl text-xs transition"
          >
            <Calculator className="w-4 h-4 text-slate-500" />
            Calculadora Vuelto
          </button>

          <button
            onClick={() => setIsCloseShiftOpen(true)}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-md shadow-rose-600/20 transition active:scale-95 shrink-0"
          >
            <Lock className="w-4 h-4" />
            Cerrar Caja de Turno
          </button>
        </div>
      </div>

      {/* Turn Breakdown KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Collected */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Cobrado</span>
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-400">S/ {totalSales.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block font-medium">
              {rangeOrders.length} transacciones registradas
            </span>
          </div>
        </div>

        {/* Efectivo */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Efectivo en Caja</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">S/ {cashSales.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {((cashSales / (totalSales || 1)) * 100).toFixed(0)}% del total
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Yape / Plin */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">Yape / Plin</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">S/ {yapePlinSales.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {((yapePlinSales / (totalSales || 1)) * 100).toFixed(0)}% del total
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table: Payments Feed */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Transacciones de Pago</h2>
            <p className="text-xs text-slate-500">Listado de cobros asociados a las comandas de la caja</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Payment Method Filter */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 text-xs font-semibold">
              {[
                { key: "all", label: "Todos" },
                { key: "Efectivo", label: "Efectivo" },
                { key: "Yape/Plin", label: "Yape/Plin" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMethodFilter(m.key)}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    methodFilter === m.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por comanda o cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-48 sm:w-60"
              />
            </div>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {[
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Esta Semana" },
            { key: "mes", label: "Este Mes" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setDateFilter(f.key as "hoy" | "semana" | "mes");
                setCustomDate("");
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition border ${
                dateFilter === f.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}

          {/* Selector de fecha específica */}
          <div className="flex items-center gap-1">
            <input
              id="custom-date-input-pagos"
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter(e.target.value ? "custom" : "hoy");
              }}
              onClick={(e) => {
                (e.target as HTMLInputElement).showPicker?.();
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                dateFilter === "custom"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-4">Código Comanda</th>
                <th className="py-4 px-4">Cliente</th>
                <th className="py-4 px-4">Método de Pago</th>
                <th className="py-4 px-4">Monto Cobrado</th>
                <th className="py-4 px-4 text-center">Estado del Pago</th>
                <th className="py-4 px-4 text-center">Fecha</th>
                <th className="py-4 px-4 text-right">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    No se encontraron cobros registrados con ese filtro.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-extrabold text-slate-900 text-sm">
                      {order.code}
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-800">
                      {order.customer}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-xl font-bold text-xs">
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-extrabold text-slate-900 text-base">
                      S/ {order.total.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pagado
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                      {order.fecha}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-400 font-mono text-[11px]">
                      {order.hora}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CALCULATOR MODAL */}
      {isCalculatorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Calculadora de Vuelto POS</h3>
                  <p className="text-xs text-slate-400">Calculo exacto para pagos en efectivo</p>
                </div>
              </div>
              <button
                onClick={() => setIsCalculatorOpen(false)}
                className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Monto de la Comanda (S/.)</label>
                <input
                  type="number"
                  step="0.50"
                  placeholder="0.00"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Efectivo Recibido del Cliente (S/.)</label>
                <input
                  type="number"
                  step="0.50"
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Preset Cash Buttons */}
              <div className="flex gap-2">
                {[10, 20, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCashReceived(val)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-amber-500/20 rounded-xl text-xs font-bold text-slate-800 transition"
                  >
                    S/ {val}
                  </button>
                ))}
              </div>

              {/* Vuelto Result */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Vuelto a Entregar</span>
                <div className="text-3xl font-extrabold text-emerald-700 mt-1">
                  S/ {changeValue.toFixed(2)}
                </div>
              </div>

              <button
                onClick={() => setIsCalculatorOpen(false)}
                className="w-full py-3 bg-slate-900 text-white font-bold rounded-2xl text-xs transition"
              >
                Cerrar Calculadora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CERRAR CAJA MODAL */}
      {isCloseShiftOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Cierre de Caja Diario (Turno Noche)</h3>
                  <p className="text-xs text-slate-400">Consolidación diaria de ventas, efectivo en caja y cobros digitales</p>
                </div>
              </div>
              <button
                onClick={() => setIsCloseShiftOpen(false)}
                className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCloseShift} className="p-6 space-y-5">
              {/* Summary Preview */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Recaudado:</span>
                  <strong className="text-slate-900 text-sm font-extrabold">S/ {totalSales.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Efectivo en Caja:</span>
                  <span className="font-bold text-emerald-700">S/ {cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Yape / Plin:</span>
                  <span className="font-bold text-purple-700">S/ {yapePlinSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-800">
                  <span>Total Pedidos Atendidos:</span>
                  <span>{rangeOrders.length} comanda(s)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Notas / Observaciones del Cierre</label>
                <textarea
                  rows={3}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Ej: Cuadre de caja exacto. Se deja S/ 100 de sencillo en caja."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftOpen(false)}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-rose-600/20 transition"
                >
                  Confirmar y Guardar Cierre de Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}