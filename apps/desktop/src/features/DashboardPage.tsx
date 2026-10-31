import { useState, useEffect } from "react";
import { usePosStore, type Order } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import {
  Clock,
  Search,
  CheckCircle2,
  Flame,
  PackageCheck,
  Printer,
  XCircle
} from "lucide-react";

type TimeRange = "today" | "week" | "month";

export default function DashboardPage() {
  const { pedidos, insumos, updateOrderStatus, cajaEstado, fetchCajaEstado } = usePosStore();

  useEffect(() => {
    fetchCajaEstado();
  }, [fetchCajaEstado]);

  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeHourlyBar, setActiveHourlyBar] = useState<number | null>(null);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to parse local YYYY-MM-DD string without UTC offset issues
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dateStr);
  };

  // Filter orders by time range (today, week, month)
  const isOrderInTimeRange = (orderFecha: string, range: TimeRange) => {
    if (!orderFecha) return true;
    const orderDate = parseLocalDate(orderFecha);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (range === "today") {
      return orderDate.getTime() >= startOfToday.getTime();
    }
    if (range === "week") {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - 7);
      return orderDate.getTime() >= startOfWeek.getTime();
    }
    if (range === "month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return orderDate.getTime() >= startOfMonth.getTime();
    }
    return true;
  };

    const pedidosInTimeRange = pedidos.filter((o) => isOrderInTimeRange(o.fecha, timeRange));

  // Excluye los pedidos cancelados de todas las métricas (ventas, conteos, ranking, gráfico por hora)
  const pedidosValidos = pedidosInTimeRange.filter((o) => o.status !== "cancelado");

  // 1. Calculate Real Metrics from Store (solo pedidos NO cancelados)
  const totalSales = pedidosValidos.reduce((acc, curr) => acc + curr.total, 0);
  const totalOrdersCount = pedidosValidos.length;
  const inPreparationCount = pedidosValidos.filter((o) => o.status === "preparacion").length;
  const completedCount = pedidosValidos.filter((o) => o.status === "entregado").length;
  // Real Critical Insumos
  const criticalInsumos = insumos.filter((i) => i.stockActual <= i.stockMinimo);
  const criticalInsumosNames = criticalInsumos.map((i) => i.nombre).slice(0, 3).join(", ");


  // Top Selling Product from Orders (solo pedidos NO cancelados)
  const productSalesMap: Record<string, { count: number; revenue: number; name: string }> = {};
  pedidosValidos.forEach((ord) => {
    ord.items.forEach((item) => {
      if (!productSalesMap[item.sku]) {
        productSalesMap[item.sku] = { count: 0, revenue: 0, name: item.nombre };
      }
      productSalesMap[item.sku].count += item.cantidad;
      productSalesMap[item.sku].revenue += item.precio * item.cantidad;
    });
  });

  const sortedTopProducts = Object.values(productSalesMap).sort((a, b) => b.count - a.count);
  const starProduct = sortedTopProducts[0] || { name: "Sin ventas todavía", count: 0, revenue: 0 };

  // Hourly Sales Distribution (horario real del restaurante: 11am - 9pm, servicio completo)
  const hourlyData = Array.from({ length: 11 }, (_, i) => {
    const hour = 11 + i;
    const hourStr = hour < 12 ? `${hour}:00 am` : hour === 12 ? "12:00 pm" : `${hour - 12}:00 pm`;
    const hourSales = pedidosValidos
      .filter((o) => {
        if (!o.hora) return false;
        const orderHour = parseInt(o.hora.split(":")[0], 10);
        return orderHour === hour;
      })
      .reduce((acc, curr) => acc + curr.total, 0);

    return { hour: hourStr, total: hourSales };
  });

  const maxHourlyValue = Math.max(...hourlyData.map((d) => d.total), 10);

  // Filter Orders for Comanda Feed
  const filteredOrders = pedidosInTimeRange
    .filter((o) => {
      if (orderFilter === "preparacion") return o.status === "preparacion";
      if (orderFilter === "listo") return o.status === "listo";
      if (orderFilter === "entregado") return o.status === "entregado";
      return true;
    })
    .filter((o) => {
      const query = searchQuery.toLowerCase();
      return (
        o.code.toLowerCase().includes(query) ||
        o.customer.toLowerCase().includes(query) ||
        o.items.some((i) => i.nombre.toLowerCase().includes(query))
      );
    });

  const renderStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "preparacion":
        return (
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 rounded text-[11px] font-bold border border-blue-500/20 flex items-center gap-1 w-max">
            <Flame className="w-3 h-3" /> En cocina
          </span>
        );
      case "listo":
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded text-[11px] font-bold border border-emerald-500/20 flex items-center gap-1 w-max">
            <PackageCheck className="w-3 h-3" /> Listo
          </span>
        );
      case "entregado":
        return (
          <span className="px-2.5 py-1 bg-slate-500/10 text-slate-600 rounded text-[11px] font-semibold border border-slate-500/20 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3" /> Entregado
          </span>
        );
      case "cancelado":
        return (
          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 rounded text-[11px] font-semibold border border-rose-500/20 flex items-center gap-1 w-max">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        );
    }
  };

  const renderActionButtons = (order: Order) => {
    switch (order.status) {
      case "preparacion":
        return (
          <button
            onClick={() => updateOrderStatus(order.id, "listo")}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition"
          >
            <Flame className="w-3.5 h-3.5" /> En cocina
          </button>
        );
      case "listo":
        return (
          <button
            onClick={() => updateOrderStatus(order.id, "entregado")}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            <PackageCheck className="w-3.5 h-3.5" /> Listo (Entregar & Descontar)
          </button>
        );
      case "entregado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
          </span>
        );
      case "cancelado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Cancelado
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl text-slate-900">
              Resumen
            </h1>
            {cajaEstado?.isOpen ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded flex items-center gap-1.5">
                Caja abierta, fondo S/ {(cajaEstado.sesion?.montoInicial ?? 0).toFixed(2)}
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs font-semibold rounded flex items-center gap-1.5">
                Caja cerrada
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time Clock */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>
              {currentTime.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" })},{" "}
              <strong className="text-slate-900 font-semibold">{currentTime.toLocaleTimeString("es-PE")}</strong>
            </span>
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-md border border-slate-300">
            {(["today", "week", "month"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-semibold rounded transition-colors ${
                  timeRange === range
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {range === "today" ? "Hoy" : range === "week" ? "Esta semana" : "Este mes"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cifras del periodo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-900 p-4">
          <span className="text-xs font-semibold text-amber-400">Ventas</span>
          <div className="text-3xl font-display text-white">S/ {totalSales.toFixed(2)}</div>
        </div>

        <div className="bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Comandas</span>
          <div className="text-3xl font-display text-slate-900">{totalOrdersCount}</div>
          <span className="text-xs text-slate-500">
            {inPreparationCount} en cocina, {completedCount} entregadas
          </span>
        </div>

        <div className="bg-white p-4 min-w-0">
          <span className="text-xs font-medium text-slate-500">Más vendido</span>
          <div className="text-xl font-display text-slate-900 truncate">{starProduct.name}</div>
          <span className="text-xs text-slate-500">
            {starProduct.count} u. (S/ {starProduct.revenue.toFixed(2)})
          </span>
        </div>

        <div className={`p-4 min-w-0 ${criticalInsumos.length > 0 ? "bg-rose-50" : "bg-white"}`}>
          <span className={`text-xs font-medium ${criticalInsumos.length > 0 ? "text-rose-700" : "text-slate-500"}`}>
            Stock crítico
          </span>
          <div className={`text-3xl font-display ${criticalInsumos.length > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {criticalInsumos.length}
          </div>
          <span className={`text-xs block truncate ${criticalInsumos.length > 0 ? "text-rose-700" : "text-slate-500"}`}>
            {criticalInsumos.length > 0 ? criticalInsumosNames : "Todo con stock"}
          </span>
        </div>
      </div>

      {/* Hourly Sales Chart & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-display text-slate-900">Ventas por hora</h3>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2">
            {hourlyData.map((d, index) => {
              const heightPercent = Math.max(10, Math.round((d.total / maxHourlyValue) * 100));
              const isHovered = activeHourlyBar === index;
              return (
                <div
                  key={d.hour}
                  className="flex-1 flex flex-col items-center gap-2 group relative cursor-pointer"
                  onMouseEnter={() => setActiveHourlyBar(index)}
                  onMouseLeave={() => setActiveHourlyBar(null)}
                >
                  {isHovered && (
                    <div className="absolute -top-10 bg-slate-900 text-white px-2 py-1 rounded-lg text-[10px] font-bold z-10 whitespace-nowrap">
                      S/ {d.total.toFixed(2)}
                    </div>
                  )}

                  <div className="w-full bg-slate-100 rounded-lg h-full flex items-end overflow-hidden">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-2xl transition-all duration-300 ${
                        isHovered ? "bg-amber-400" : "bg-slate-900 group-hover:bg-amber-500"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 group-hover:text-slate-900 transition">
                    {d.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 4 Products Ranking (1 col) */}
        <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display text-slate-900">Más vendidos</h3>
            </div>

            <div className="divide-y divide-slate-200">
              {sortedTopProducts.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">Sin ventas en este periodo.</p>
              )}
              {sortedTopProducts.slice(0, 4).map((p, idx) => (
                <div key={p.name} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">{p.name}</h4>
                      <span className="text-xs text-slate-500">{p.count} u.</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">S/ {p.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Orders Live Feed Table */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-display text-slate-900">Últimas comandas</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Order Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/60 text-xs font-semibold">
              {[
                { key: "all", label: "Todos" },
                { key: "preparacion", label: "En cocina" },
                { key: "listo", label: "Listos" },
                { key: "entregado", label: "Entregados" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setOrderFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    orderFilter === tab.key
                      ? "bg-white text-slate-900 font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar pedido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-[10px]">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Cliente / mesa</th>
                <th className="py-3 px-4">Productos</th>
                <th className="py-3 px-4">Tipo / pago</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Cocina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{order.code}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{order.customer}</td>
                  <td className="py-3 px-4 max-w-xs">
                    <div className="space-y-0.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="text-xs text-slate-700">
                          <span className="font-bold text-amber-600">{item.cantidad}x</span> {item.nombre}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold block w-max">
                      {order.type}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{order.paymentMethod}</span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-slate-900 text-sm">S/ {order.total.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">{renderStatusBadge(order.status)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedPrintOrder(order)}
                        className="p-1.5 rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
                        title="Imprimir Boleta POS"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {renderActionButtons(order)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOLETA POS / TICKET RECEIPT MODAL */}
      {selectedPrintOrder && (
        <TicketReceiptModal
          order={selectedPrintOrder}
          onClose={() => setSelectedPrintOrder(null)}
        />
      )}
    </div>
  );
}