import { useState, useEffect, useCallback } from "react";
import { usePosStore, type Order } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import {
  Clock,
  Search,
  CheckCircle2,
  Flame,
  PackageCheck,
  Printer,
  XCircle,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sunset,
  RefreshCw,
} from "lucide-react";

type TimeRange = "jornada" | "semana" | "mes";

export default function DashboardPage() {
  const {
    insumos,
    cajaEstado,
    fetchCajaEstado,
    dashboardData,
    comandasDashboard,
    loadingDashboard,
    fetchDashboard,
    fetchComandasDashboard,
    updateOrderStatus,
  } = usePosStore();

  const [timeRange, setTimeRange] = useState<TimeRange>("jornada");
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeHourlyBar, setActiveHourlyBar] = useState<number | null>(null);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Carga inicial y auto-refresco del dashboard cada 45s
  const cargarDashboard = useCallback(() => {
    fetchCajaEstado();
    fetchDashboard(timeRange);
  }, [fetchCajaEstado, fetchDashboard, timeRange]);

  useEffect(() => {
    cargarDashboard();
    const interval = setInterval(cargarDashboard, 45000);
    return () => clearInterval(interval);
  }, [cargarDashboard]);

  // Carga de comandas con filtro/búsqueda/paginación
  useEffect(() => {
    fetchComandasDashboard({
      rango: timeRange,
      status: orderFilter,
      search: searchQuery,
      page: currentPage,
      limit: 15,
    });
  }, [fetchComandasDashboard, timeRange, orderFilter, searchQuery, currentPage]);

  // Reiniciar a página 1 al cambiar filtros de comanda
  const handleFilterChange = (filter: string) => {
    setOrderFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleRangeChange = (r: TimeRange) => {
    setTimeRange(r);
    setCurrentPage(1);
    fetchDashboard(r);
  };

  // Stock crítico desde inventario local
  const criticalInsumos = insumos.filter((i) => i.stockActual <= i.stockMinimo);
  const criticalInsumosNames = criticalInsumos.map((i) => i.nombre).slice(0, 3).join(", ");

  // KPIs del backend
  const kpis = dashboardData?.kpis;
  const totalSales = kpis?.totalVentas ?? 0;
  const totalOrdersCount = kpis?.totalComandas ?? 0;
  const ticketPromedio = kpis?.ticketPromedio ?? 0;
  const conteos = kpis?.conteosPorEstado;
  const horaPico = kpis?.horaPico;

  // Barras del gráfico
  const barras = dashboardData?.grafico?.barras ?? [];
  const maxHourlyValue = Math.max(...barras.map((d) => d.total), 1);

  // Producto estrella
  const starProduct = dashboardData?.topProductos?.[0] || {
    nombre: "Sin ventas todavía",
    cantidad: 0,
    total: 0,
  };

  // Franjas horarias
  const franjas = dashboardData?.franjas;

  // Comparación con semana anterior
  const comp = dashboardData?.comparacionSemanaAnterior;

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
            onClick={async () => {
              await updateOrderStatus(order.id, "listo");
              cargarDashboard();
              fetchComandasDashboard({
                rango: timeRange,
                status: orderFilter,
                search: searchQuery,
                page: currentPage,
                limit: 15,
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition"
          >
            <Flame className="w-3.5 h-3.5" /> En cocina
          </button>
        );
      case "listo":
        return (
          <button
            onClick={async () => {
              await updateOrderStatus(order.id, "entregado");
              cargarDashboard();
              fetchComandasDashboard({
                rango: timeRange,
                status: orderFilter,
                search: searchQuery,
                page: currentPage,
                limit: 15,
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            <PackageCheck className="w-3.5 h-3.5" /> Listo (Entregar)
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

  const comandasItems = comandasDashboard?.items ?? [];
  const totalPages = comandasDashboard?.totalPages ?? 1;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl text-slate-900 font-display">Resumen</h1>
            {cajaEstado?.isOpen ? (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded flex items-center gap-1.5">
                Caja abierta (Jornada: {dashboardData?.fechaNegocio || "Hoy"})
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded flex items-center gap-1.5">
                Caja cerrada (Última jornada: {dashboardData?.fechaNegocio || "—"})
              </span>
            )}
            <button
              onClick={cargarDashboard}
              className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDashboard ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time Clock */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>
              {currentTime.toLocaleDateString("es-PE", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              ,{" "}
              <strong className="text-slate-900 font-semibold">
                {currentTime.toLocaleTimeString("es-PE")}
              </strong>
            </span>
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-md border border-slate-300">
            {[
              { key: "jornada", label: "Jornada actual" },
              { key: "semana", label: "Esta semana" },
              { key: "mes", label: "Este mes" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleRangeChange(key as TimeRange)}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                  timeRange === key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cifras del periodo (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
        {/* Ventas */}
        <div className="bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Ventas</span>
            {comp && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  comp.diferenciaMonto >= 0
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-rose-950 text-rose-400 border border-rose-800"
                }`}
                title={`Semana anterior: S/ ${comp.totalVentasAnterior.toFixed(2)}`}
              >
                {comp.diferenciaMonto >= 0 ? "+" : ""}
                {comp.diferenciaPorcentaje}% vs sem. ant.
              </span>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
            S/ {totalSales.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Efectivo: S/ {(kpis?.efectivoTotal ?? 0).toFixed(2)} · Digital: S/{" "}
            {(kpis?.digitalTotal ?? 0).toFixed(2)}
          </span>
        </div>

        {/* Comandas */}
        <div className="bg-white p-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Comandas</span>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            {totalOrdersCount}
          </div>
          <span className="text-[11px] text-slate-600 block mt-1 truncate">
            {conteos
              ? `${conteos.enCocina} en cocina, ${conteos.entregados} entregadas`
              : "Calculando..."}
          </span>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white p-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Ticket promedio
          </span>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 mt-1">
            S/ {ticketPromedio.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Promedio por comanda cobrada
          </span>
        </div>

        {/* Más Vendido */}
        <div className="bg-white p-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Más vendido
          </span>
          <div className="text-lg sm:text-xl font-display font-bold text-slate-900 mt-1 truncate">
            {starProduct.nombre}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            {starProduct.cantidad > 0
              ? `${starProduct.cantidad} uds · S/ ${starProduct.total.toFixed(2)}`
              : "Sin ventas aún"}
          </span>
        </div>

        {/* Stock Crítico */}
        <div className="bg-white p-4 col-span-2 lg:col-span-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Stock crítico
          </span>
          <div
            className={`text-2xl sm:text-3xl font-display font-extrabold mt-1 ${
              criticalInsumos.length > 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {criticalInsumos.length}
          </div>
          <span
            className={`text-[11px] block truncate mt-1 ${
              criticalInsumos.length > 0 ? "text-rose-700 font-semibold" : "text-slate-500"
            }`}
          >
            {criticalInsumos.length > 0 ? criticalInsumosNames : "Todo con stock"}
          </span>
        </div>
      </div>

      {/* Franjas del día (Solo en rango Jornada) */}
      {timeRange === "jornada" && franjas && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Distribución por franjas de la jornada
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Tarde */}
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 rounded-md text-amber-800">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Tarde (12:00 - 18:59)</div>
                  <div className="text-[11px] text-slate-600">
                    {franjas.tarde.comandas} {franjas.tarde.comandas === 1 ? "comanda" : "comandas"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-slate-900">
                  S/ {franjas.tarde.total.toFixed(2)}
                </div>
                <div className="text-[10px] font-bold text-amber-700">
                  {franjas.tarde.porcentaje}% del turno
                </div>
              </div>
            </div>

            {/* Noche */}
            <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 rounded-md text-indigo-800">
                  <Sunset className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Noche (19:00 - 23:59)</div>
                  <div className="text-[11px] text-slate-600">
                    {franjas.noche.comandas} {franjas.noche.comandas === 1 ? "comanda" : "comandas"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-slate-900">
                  S/ {franjas.noche.total.toFixed(2)}
                </div>
                <div className="text-[10px] font-bold text-indigo-700">
                  {franjas.noche.porcentaje}% del turno
                </div>
              </div>
            </div>

            {/* Madrugada */}
            <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-200 rounded-md text-slate-800">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Madrugada (00:00 - 05:59)</div>
                  <div className="text-[11px] text-slate-600">
                    {franjas.madrugada.comandas}{" "}
                    {franjas.madrugada.comandas === 1 ? "comanda" : "comandas"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-slate-900">
                  S/ {franjas.madrugada.total.toFixed(2)}
                </div>
                <div className="text-[10px] font-bold text-slate-700">
                  {franjas.madrugada.porcentaje}% del turno
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hourly / Daily Sales Chart & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de Ventas (2 cols) */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-lg border border-slate-200 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-xl font-display font-bold text-slate-900">
                {timeRange === "jornada" ? "Ventas por hora" : "Ventas por jornada"}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {timeRange === "jornada"
                  ? `Jornada comercial: ${dashboardData?.fechaNegocio || "—"} (${dashboardData?.horarioConfig.diaSemana || ""})`
                  : `Periodo: ${dashboardData?.fechaInicio} al ${dashboardData?.fechaFin}`}
              </p>
            </div>

            {horaPico && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-md text-xs font-bold">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  Hora pico: {horaPico.label} (S/ {horaPico.total.toFixed(2)} · {horaPico.comandas} cmd)
                </span>
              </div>
            )}
          </div>

          {/* Estado vacío claro si no hay ventas */}
          {totalSales === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg text-slate-400 bg-slate-50/50">
              <Clock className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">
                Sin ventas registradas en este periodo.
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Los cobros realizados aparecerán aquí automáticamente en tiempo real.
              </p>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-2 pt-6 px-1">
              {barras.map((d, index) => {
                const heightPercent =
                  d.total > 0 ? Math.max(8, Math.round((d.total / maxHourlyValue) * 100)) : 0;
                const isHovered = activeHourlyBar === index;
                return (
                  <div
                    key={d.clave}
                    className="flex-1 flex flex-col items-center gap-2 group relative cursor-pointer h-full justify-end"
                    onMouseEnter={() => setActiveHourlyBar(index)}
                    onMouseLeave={() => setActiveHourlyBar(null)}
                  >
                    {/* Tooltip con desglose completo */}
                    {isHovered && (
                      <div className="absolute -top-16 bg-slate-900 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold z-20 whitespace-nowrap shadow-xl border border-slate-700 pointer-events-none">
                        <div className="font-extrabold text-amber-400 text-xs">{d.label}</div>
                        <div>Total: S/ {d.total.toFixed(2)}</div>
                        <div className="text-slate-300 font-medium">
                          Efec: S/ {d.efectivo.toFixed(2)} | Dig: S/ {d.digital.toFixed(2)}
                        </div>
                        <div className="text-slate-400 font-medium">
                          {d.comandas} {d.comandas === 1 ? "comanda" : "comandas"}
                        </div>
                      </div>
                    )}

                    <div className="w-full bg-slate-100 rounded-lg h-full flex items-end overflow-hidden">
                      {d.total > 0 && (
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t transition-all duration-300 ${
                            d.esPico
                              ? "bg-amber-500 hover:bg-amber-400"
                              : isHovered
                              ? "bg-slate-700"
                              : "bg-slate-900"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-[10px] transition text-center truncate w-full ${
                        d.esPico
                          ? "font-extrabold text-amber-700"
                          : isHovered
                          ? "font-bold text-slate-900"
                          : "font-medium text-slate-500"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 5 Products Ranking (1 col) */}
        <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
              <h3 className="text-xl font-display font-bold text-slate-900">Más vendidos</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {(!dashboardData?.topProductos || dashboardData.topProductos.length === 0) && (
                <p className="py-8 text-center text-sm text-slate-400">Sin ventas en este periodo.</p>
              )}
              {dashboardData?.topProductos?.slice(0, 5).map((p, idx) => (
                <div key={p.nombre} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-6 h-6 rounded text-xs font-extrabold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? "bg-amber-400 text-slate-900"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <span className="font-bold text-slate-900 text-xs truncate">{p.nombre}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-slate-900 block">
                      {p.cantidad} uds
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      S/ {p.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Orders Live Feed Table (Paginada y con filtro desde backend) */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-display font-bold text-slate-900">Últimas comandas</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {comandasDashboard?.total ?? 0} comandas registradas en el periodo seleccionado
            </p>
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
                  onClick={() => handleFilterChange(tab.key)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    orderFilter === tab.key
                      ? "bg-white text-slate-900 font-bold shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar comanda..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px] uppercase">
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Cliente / mesa</th>
                <th className="py-2.5 px-3">Productos</th>
                <th className="py-2.5 px-3">Tipo / pago</th>
                <th className="py-2.5 px-3">Total</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {comandasItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Sin comandas en este filtro.
                  </td>
                </tr>
              ) : (
                comandasItems.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{order.code}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {order.table?.number ? `Mesa ${order.table.number}` : order.customer || "General"}
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="space-y-0.5">
                        {order.items.map((item, i) => (
                          <div key={i} className="text-xs text-slate-700 truncate">
                            <span className="font-bold text-amber-600">{item.cantidad}x</span>{" "}
                            {item.nombre}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold block w-max">
                        {order.type}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-extrabold text-slate-900 text-sm">
                      S/ {order.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">{renderStatusBadge(order.status)}</td>
                    <td className="py-3 px-3 text-right">
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Página <strong className="text-slate-900">{currentPage}</strong> de{" "}
              <strong className="text-slate-900">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center gap-1"
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
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
