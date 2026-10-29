import { useState, useEffect } from "react";
import { usePosStore, type Order } from "../store/usePosStore";
import {
  QrCode,
  Lock,
  Unlock,
  Search,
  Calculator,
  X,
  Coins,
  AlertCircle,
  TrendingUp,
  User,
  Receipt,
} from "lucide-react";

export default function PagosPage() {
  const { pedidos, cajaEstado, fetchCajaEstado, abrirCaja, cerrarCajaSesion, currentUser } = usePosStore();

  useEffect(() => {
    fetchCajaEstado();
  }, [fetchCajaEstado]);

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

  // Abrir Caja Modal
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState<string>("100");
  const [openingNotes, setOpeningNotes] = useState("");
  const [isSubmittingOpen, setIsSubmittingOpen] = useState(false);

  // Cerrar Caja Modal
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [countedCash, setCountedCash] = useState<string>("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

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

  // Cuánto entró en efectivo y cuánto en digital. Se suma desde los pagos registrados
  // (como hace el cierre de caja en el backend): una mesa puede tener abonos parciales
  // con distintos métodos, que no se ven en paymentMethod/montoEfectivo del pedido.
  const desglosePago = (o: Order) => {
    if (o.pagos && o.pagos.length > 0) {
      return o.pagos.reduce(
        (acc, p) =>
          normalizePaymentMethod(p.metodoPago) === "EFECTIVO"
            ? { ...acc, efectivo: acc.efectivo + p.monto }
            : { ...acc, digital: acc.digital + p.monto },
        { efectivo: 0, digital: 0 }
      );
    }
    const metodo = normalizePaymentMethod(o.paymentMethod);
    if (metodo === "EFECTIVO") return { efectivo: o.total, digital: 0 };
    if (metodo === "MIXTO") return { efectivo: o.montoEfectivo || 0, digital: o.montoDigital || 0 };
    return { efectivo: 0, digital: o.total };
  };

  const cashSales = rangeOrders.reduce((acc, o) => acc + desglosePago(o).efectivo, 0);
  const yapePlinSales = rangeOrders.reduce((acc, o) => acc + desglosePago(o).digital, 0);

  const filteredOrders = rangeOrders.filter((order) => {
    const matchesMethod = methodFilter === "all" || order.paymentMethod === methodFilter;
    const matchesSearch =
      order.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMethod && matchesSearch;
  });

  const isCajaOpen = Boolean(cajaEstado?.isOpen);
  const activeSession = cajaEstado?.sesion;
  const montoInicial = activeSession?.montoInicial ?? 0;
  const expectedCashInDrawer = montoInicial + cashSales;

  // Manejo de apertura de caja
  const handleConfirmOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      alert("Por favor ingresa un monto inicial válido (mayor o igual a 0).");
      return;
    }
    setIsSubmittingOpen(true);
    const ok = await abrirCaja(amount, openingNotes);
    setIsSubmittingOpen(false);
    if (ok) {
      setIsOpenShiftModalOpen(false);
      setOpeningNotes("");
    }
  };

  // Manejo de cierre de caja (arqueo)
  const handleOpenCloseModal = () => {
    setCountedCash(expectedCashInDrawer.toFixed(2));
    setShiftNotes("");
    setIsCloseShiftOpen(true);
  };

  const handleConfirmCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const counted = countedCash ? parseFloat(countedCash) : undefined;
    setIsSubmittingClose(true);
    const ok = await cerrarCajaSesion(counted, shiftNotes || "Cierre de turno correcto");
    setIsSubmittingClose(false);
    if (ok) {
      setIsCloseShiftOpen(false);
      setShiftNotes("");
      setCountedCash("");
    }
  };

  // Diferencia calculada en el modal de cierre
  const numCounted = countedCash !== "" ? parseFloat(countedCash) || 0 : expectedCashInDrawer;
  const diffCash = numCounted - expectedCashInDrawer;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Pagos & Caja POS</h1>
            {isCajaOpen ? (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <Unlock className="w-3.5 h-3.5" /> Caja Abierta ({activeSession?.usuarioApertura || "Turno activo"})
              </span>
            ) : (
              <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-semibold rounded-full flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Caja Cerrada
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Arqueo de caja, fondo inicial de cambio, desglose por métodos de pago y cierre de turno.
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

          {isCajaOpen ? (
            <button
              onClick={handleOpenCloseModal}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-md shadow-rose-600/20 transition active:scale-95 shrink-0"
            >
              <Lock className="w-4 h-4" />
              Cerrar Caja de Turno
            </button>
          ) : (
            <button
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-3 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 shrink-0 animate-pulse"
            >
              <Unlock className="w-4 h-4" />
              Abrir Caja de Turno
            </button>
          )}
        </div>
      </div>

      {/* Banner si la caja está cerrada */}
      {!isCajaOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-amber-950 text-sm">Caja cerrada actualmente</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Para registrar el fondo inicial de sencillo en gaveta y habilitar el arqueo del turno, abre la caja.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpenShiftModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs px-5 py-2.5 rounded-2xl shrink-0 transition"
          >
            Abrir Caja Ahora
          </button>
        </div>
      )}

      {/* Turn Breakdown KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total vendido: lo cobrado (efectivo + digital), mismo cálculo que el cierre de caja */}
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-900 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Total Vendido</span>
            <div className="text-2xl font-black text-white mt-1">S/ {(cashSales + yapePlinSales).toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {rangeOrders.length} {rangeOrders.length === 1 ? "pedido cobrado" : "pedidos cobrados"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Fondo Inicial / Base */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fondo Inicial (Base)</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              S/ {montoInicial.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {isCajaOpen ? `Apertura por ${activeSession?.usuarioApertura || "Cajero"}` : "Caja no abierta"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Unlock className="w-5 h-5" />
          </div>
        </div>

        {/* Ventas en Efectivo */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Ventas en Efectivo</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">S/ {cashSales.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {((cashSales / (totalSales || 1)) * 100).toFixed(0)}% del total facturado
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Total Esperado en Gaveta (Base + Efectivo) */}
        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total en Gaveta (Esperado)</span>
            <div className="text-2xl font-black text-emerald-950 mt-1">S/ {expectedCashInDrawer.toFixed(2)}</div>
            <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
              Base (S/ {montoInicial.toFixed(2)}) + Ventas (S/ {cashSales.toFixed(2)})
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Yape / Plin / Digital */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">Yape / Plin</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">S/ {yapePlinSales.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {((yapePlinSales / (totalSales || 1)) * 100).toFixed(0)}% del total facturado
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
                { key: "Mixto", label: "Mixto" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMethodFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    methodFilter === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date Range Filter */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 text-xs font-semibold">
              {[
                { key: "hoy", label: "Hoy" },
                { key: "semana", label: "7 días" },
                { key: "mes", label: "Este Mes" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setDateFilter(tab.key as typeof dateFilter);
                    setCustomDate("");
                  }}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    dateFilter === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Custom Date Picker */}
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter("custom");
              }}
              className="px-3 py-1.5 bg-slate-100 border border-slate-200/60 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por #ORD o cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-100 border border-slate-200/60 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-52"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-y border-slate-100">
              <tr>
                <th className="py-3 px-4">Comanda</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Método de Pago</th>
                <th className="py-3 px-4">Desglose</th>
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4 text-right">Total Cobrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    No se encontraron pagos registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isEfectivo = normalizePaymentMethod(order.paymentMethod) === "EFECTIVO";
                  const isYape =
                    normalizePaymentMethod(order.paymentMethod) === "YAPE/PLIN" ||
                    normalizePaymentMethod(order.paymentMethod) === "YAPE_PLIN";
                  const isMixto = normalizePaymentMethod(order.paymentMethod) === "MIXTO";

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-900 font-mono text-[11px]">
                        {order.code}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{order.customer}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isEfectivo
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isYape
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isEfectivo && <Coins className="w-3 h-3" />}
                          {isYape && <QrCode className="w-3 h-3" />}
                          {isMixto && "🔀"}
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {isMixto ? (
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <span>
                              Efectivo: <strong>S/ {desglosePago(order).efectivo.toFixed(2)}</strong>
                            </span>
                            <span>
                              Digital: <strong>S/ {desglosePago(order).digital.toFixed(2)}</strong>
                            </span>
                          </div>
                        ) : isEfectivo && (order.montoRecibido || order.vuelto) ? (
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            {order.montoRecibido && (
                              <span>
                                Recibido: <strong>S/ {order.montoRecibido.toFixed(2)}</strong>
                              </span>
                            )}
                            {order.vuelto && (
                              <span>
                                Vuelto: <strong>S/ {order.vuelto.toFixed(2)}</strong>
                              </span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {order.fecha} {order.hora}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                        S/ {order.total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CALCULADORA DE VUELTO MODAL */}
      {isCalculatorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Calculator className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm">Calculadora de Vuelto</h3>
              </div>
              <button
                onClick={() => setIsCalculatorOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Monto de la Venta (S/)
                </label>
                <input
                  type="number"
                  step="0.10"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Efectivo Recibido (S/)
                </label>
                <input
                  type="number"
                  step="0.10"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Botones rápidos */}
              <div className="flex gap-2">
                {[10, 20, 50, 100].map((b) => (
                  <button
                    key={b}
                    onClick={() => setCashReceived(b)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
                  >
                    S/ {b}
                  </button>
                ))}
              </div>

              {/* Vuelto Display */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-1">
                <span className="text-[11px] font-bold uppercase text-emerald-800">Vuelto a Entregar</span>
                <div className="text-3xl font-black text-emerald-600">
                  S/ {changeValue.toFixed(2)}
                </div>
              </div>

              <button
                onClick={() => {
                  setOrderAmount("");
                  setCashReceived("");
                  setIsCalculatorOpen(false);
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition"
              >
                Cerrar Calculadora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL APERTURA DE CAJA */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Apertura de Caja</h3>
                  <p className="text-xs text-slate-400">Inicio de turno y registro de fondo de sencillo</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOpenShift} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Monto Inicial de Caja (Fondo de Sencillo)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">S/</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    required
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="100.00"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                {/* Sugerencias rápidas */}
                <div className="flex gap-2 mt-2">
                  {[0, 50, 100, 150, 200].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setOpeningAmount(String(v))}
                      className="flex-1 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl text-xs font-bold text-slate-600 transition"
                    >
                      S/ {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Notas de Apertura (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="Ej: Turno mañana, billetes de 10 y monedas para cambio."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Responsable: {currentUser?.name || "Cajero POS"}
                </div>
                <p className="text-[11px] text-emerald-800">
                  Al abrir la caja, las ventas en efectivo del turno se sumarán a este fondo inicial para el cuadre final.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpen}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingOpen ? "Abriendo..." : "Confirmar Apertura de Caja"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CERRAR CAJA MODAL (ARQUEO COMPLETO) */}
      {isCloseShiftOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Arqueo y Cierre de Caja</h3>
                  <p className="text-xs text-slate-400">Cuadre de dinero en gaveta y cierre del turno activo</p>
                </div>
              </div>
              <button
                onClick={() => setIsCloseShiftOpen(false)}
                className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCloseShift} className="p-6 space-y-4">
              {/* Desglose del sistema */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Fondo Inicial (Base de Caja):</span>
                  <strong className="text-slate-800 font-bold">S/ {montoInicial.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">(+) Ventas en Efectivo:</span>
                  <span className="font-bold text-emerald-700">S/ {cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-black text-slate-900 text-sm">
                  <span>(=) Efectivo Total Esperado en Gaveta:</span>
                  <span className="text-emerald-700">S/ {expectedCashInDrawer.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200">
                  <span>Ventas Yape / Plin / Tarjeta:</span>
                  <span className="font-bold text-purple-700">S/ {yapePlinSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Total Facturado del Turno:</span>
                  <span className="font-extrabold text-slate-900">S/ {totalSales.toFixed(2)}</span>
                </div>
              </div>

              {/* Conteo físico ingresado por el cajero */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Efectivo Físico Contado en Gaveta (S/)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.10"
                  required
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder={expectedCashInDrawer.toFixed(2)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Indicador de Cuadre / Diferencia */}
              <div
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                  Math.abs(diffCash) < 0.01
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : diffCash > 0
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                <span>Resultado del Cuadre:</span>
                <span>
                  {Math.abs(diffCash) < 0.01
                    ? "✓ Cuadre exacto (S/ 0.00)"
                    : diffCash > 0
                    ? `↑ Sobrante en caja: +S/ ${diffCash.toFixed(2)}`
                    : `↓ Faltante en caja: -S/ ${Math.abs(diffCash).toFixed(2)}`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Notas / Observaciones del Cierre
                </label>
                <textarea
                  rows={2}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Ej: Cuadre conforme. Se retira efectivo y se deja S/ 100 para siguiente turno."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
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
                  disabled={isSubmittingClose}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl text-xs shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingClose ? "Cerrando..." : "Confirmar Cierre y Guardar Arqueo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
