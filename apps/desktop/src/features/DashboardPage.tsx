import { useState, useEffect } from "react";
import { usePosStore, type Order } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import {
  TrendingUp,
  ShoppingBag,
  Award,
  Clock,
  Search,
  Coins,
  CheckCircle2,
  Flame,
  PackageCheck,
  ShieldAlert,
  Printer,
  XCircle
} from "lucide-react";

type TimeRange = "today" | "week" | "month";

export default function DashboardPage() {
  const { pedidos, insumos, updateOrderStatus } = usePosStore();

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
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[11px] font-bold border border-blue-500/20 flex items-center gap-1 w-max">
            <Flame className="w-3 h-3 animate-pulse" /> En Cocina
          </span>
        );
      case "listo":
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[11px] font-bold border border-emerald-500/20 flex items-center gap-1 w-max">
            <PackageCheck className="w-3 h-3" /> Listo
          </span>
        );
      case "entregado":
        return (
          <span className="px-2.5 py-1 bg-slate-500/10 text-slate-600 rounded-full text-[11px] font-semibold border border-slate-500/20 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3" /> Entregado
          </span>
        );
      case "cancelado":
        return (
          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 rounded-full text-[11px] font-semibold border border-rose-500/20 flex items-center gap-1 w-max">
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
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition"
          >
            <Flame className="w-3.5 h-3.5 animate-pulse" /> En Cocina (Marcar Listo)
          </button>
        );
      case "listo":
        return (
          <button
            onClick={() => updateOrderStatus(order.id, "entregado")}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            <PackageCheck className="w-3.5 h-3.5" /> Listo (Entregar & Descontar)
          </button>
        );
      case "entregado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
          </span>
        );
      case "cancelado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Cancelado
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Dashboard de Operaciones POS
            </h1>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Caja Abierta
            </span>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-full border border-amber-200">
              ☀️ Lun - Dom (Turno Completo)
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Monitoreo en vivo de ventas, comanda de pedidos e inventario de "En que la Negra".
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time Clock */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-2xl text-xs font-medium text-slate-700">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>
              {currentTime.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" })} •{" "}
              <strong className="text-slate-900 font-semibold">{currentTime.toLocaleTimeString("es-PE")}</strong>
            </span>
          </div>

          {/* Time Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
            {(["today", "week", "month"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  timeRange === range
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {range === "today" ? "Hoy" : range === "week" ? "Esta Semana" : "Este Mes"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Sales Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ventas Totales</span>
            <div className="text-3xl font-black text-slate-900 mt-1">S/ {totalSales.toFixed(2)}</div>
            <span className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> En tiempo real
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Orders Count Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pedidos del Día</span>
            <div className="text-3xl font-black text-slate-900 mt-1">{totalOrdersCount} comandas</div>
            <span className="text-[11px] font-medium text-slate-500 mt-1 block">
              {inPreparationCount} en cocina • {completedCount} entregados
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Top Seller Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Producto Estrella</span>
            <div className="text-lg font-bold text-slate-900 mt-1 truncate max-w-[170px]">{starProduct.name}</div>
            <span className="text-[11px] font-medium text-amber-600 mt-1 block">
              {starProduct.count} unidades vendidas (S/ {starProduct.revenue.toFixed(2)})
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Stock Alert Card */}
        <div className={`p-6 rounded-3xl border shadow-sm flex items-center justify-between ${
          criticalInsumos.length > 0 ? "bg-rose-50/50 border-rose-200" : "bg-white border-slate-200/80"
        }`}>
          <div>
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              criticalInsumos.length > 0 ? "text-rose-600" : "text-slate-400"
            }`}>
              Stock Crítico
            </span>
            <div className={`text-3xl font-black mt-1 ${criticalInsumos.length > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {criticalInsumos.length} {criticalInsumos.length === 1 ? "Insumo" : "Insumos"}
            </div>
            <span className={`text-[11px] mt-1 block truncate max-w-[170px] ${
              criticalInsumos.length > 0 ? "text-rose-500 font-semibold" : "text-slate-500"
            }`}>
              {criticalInsumos.length > 0 ? criticalInsumosNames : "Todos los insumos óptimos"}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
            criticalInsumos.length > 0 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Hourly Sales Chart & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hourly Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Ventas por Hora</h3>
              <p className="text-xs text-slate-500">Distribución de ingresos durante el servicio</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
              Pico: 12:00 PM - 2:00 PM
            </span>
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
                    <div className="absolute -top-10 bg-slate-900 text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg z-10 whitespace-nowrap">
                      S/ {d.total.toFixed(2)}
                    </div>
                  )}

                  <div className="w-full bg-slate-100 rounded-2xl h-full flex items-end overflow-hidden">
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Más Vendidos</h3>
              <span className="text-xs text-amber-600 font-semibold">Ranking Top 4</span>
            </div>

            <div className="space-y-4">
              {sortedTopProducts.slice(0, 4).map((p, idx) => (
                <div key={p.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{p.name}</h4>
                      <span className="text-[10px] text-slate-500">{p.count} pedidos realizados</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-slate-900">S/ {p.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Orders Live Feed Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Comanda de Pedidos Recientes</h3>
            <p className="text-xs text-slate-500">Gestión en tiempo real del flujo de cocina y entrega</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Order Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60 text-xs font-semibold">
              {[
                { key: "all", label: "Todos" },
                { key: "preparacion", label: "En Cocina" },
                { key: "listo", label: "Listos" },
                { key: "entregado", label: "Entregados" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setOrderFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    orderFilter === tab.key
                      ? "bg-white text-slate-900 shadow-sm font-bold"
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
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-4">Código</th>
                <th className="py-4 px-4">Cliente / Mesa</th>
                <th className="py-4 px-4">Detalle de Productos</th>
                <th className="py-4 px-4">Tipo / Pago</th>
                <th className="py-4 px-4">Total</th>
                <th className="py-4 px-4 text-center">Estado</th>
                <th className="py-4 px-4 text-right">Acción Cocina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-4 font-mono font-bold text-slate-900">{order.code}</td>
                  <td className="py-4 px-4 font-bold text-slate-900">{order.customer}</td>
                  <td className="py-4 px-4 max-w-xs">
                    <div className="space-y-0.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="text-xs text-slate-700">
                          <span className="font-bold text-amber-600">{item.cantidad}x</span> {item.nombre}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold block w-max">
                      {order.type}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{order.paymentMethod}</span>
                  </td>
                  <td className="py-4 px-4 font-extrabold text-slate-900 text-sm">S/ {order.total.toFixed(2)}</td>
                  <td className="py-4 px-4 text-center">{renderStatusBadge(order.status)}</td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedPrintOrder(order)}
                        className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
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