import { useState } from "react";
import { usePosStore, type Order } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import {
  History,
  Download,
  Search,
  Eye,
  ShoppingBag,
  Lock
} from "lucide-react";

export default function HistorialPage() {
  const { pedidos, cierresCaja } = usePosStore();

  const [activeTab, setActiveTab] = useState<"pedidos" | "cierres">("pedidos");
  const [searchQuery, setSearchQuery] = useState("");

  // Order Detail Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const validOrders = pedidos.filter((o) => o.status !== "cancelado");

  // Date Filter Logic
  const filteredOrders = validOrders.filter((order) => {
    const matchesSearch =
      order.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Metric Aggregations
  const totalSales = filteredOrders.reduce((acc, curr) => acc + curr.total, 0);
  const totalOrdersCount = filteredOrders.length;
  const averageTicket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

  // Star Product Calculation
  const productCountMap: Record<string, { count: number; name: string }> = {};
  filteredOrders.forEach((ord) => {
    ord.items.forEach((item) => {
      if (!productCountMap[item.sku]) {
        productCountMap[item.sku] = { count: 0, name: item.nombre };
      }
      productCountMap[item.sku].count += item.cantidad;
    });
  });

  const starProduct = Object.values(productCountMap).sort((a, b) => b.count - a.count)[0] || {
    name: "Sin ventas todavía",
    count: 0,
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const headers = ["Código", "Cliente", "Fecha", "Hora", "Items", "Método Pago", "Tipo", "Total (S/)"];
    const rows = filteredOrders.map((o) => [
      o.code,
      `"${o.customer}"`,
      o.fecha,
      o.hora,
      `"${o.items.map((i) => `${i.cantidad}x ${i.nombre}`).join("; ")}"`,
      o.paymentMethod,
      o.type,
      o.total.toFixed(2),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Historial_Ventas_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Historial & Reportes de Ventas</h1>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full flex items-center gap-1">
              <History className="w-3.5 h-3.5 text-slate-500" />
              Auditoría POS
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Consulta histórica de pedidos pasados, arqueos de cierres de caja y exportación a CSV.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4" />
          Exportar Reporte a CSV
        </button>
      </div>

      {/* Metric Aggregations Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Vendido</span>
          <div className="text-3xl font-extrabold text-amber-400 mt-1">S/ {totalSales.toFixed(2)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Facturación acumulada</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Comandas</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">{totalOrdersCount} pedidos</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Atendidos en el periodo</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ticket Promedio</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">S/ {averageTicket.toFixed(2)}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Promedio por cliente</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Producto Estrella</span>
          <div className="text-lg font-bold text-slate-900 mt-1 truncate">{starProduct.name}</div>
          <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
            {starProduct.count} unidades vendidas
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        {/* Navigation Tabs (Pedidos vs Cierres de Caja) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("pedidos")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === "pedidos"
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Historial de Pedidos ({filteredOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("cierres")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === "cierres"
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Lock className="w-4 h-4" />
              Historial de Cierres de Caja ({cierresCaja.length})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar registro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        {activeTab === "pedidos" ? (
          /* ORDERS HISTORY TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-4">Fecha / Hora</th>
                  <th className="py-4 px-4">N° Pedido</th>
                  <th className="py-4 px-4">Cliente</th>
                  <th className="py-4 px-4">Items Vendidos</th>
                  <th className="py-4 px-4">Método de Pago</th>
                  <th className="py-4 px-4">Total</th>
                  <th className="py-4 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      No hay pedidos registrados en este historial.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const itemsSummary = order.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                          {order.fecha} {order.hora}
                        </td>
                        <td className="py-4 px-4 font-extrabold text-slate-900 text-sm">
                          {order.code}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-800">
                          {order.customer}
                        </td>
                        <td className="py-4 px-4 max-w-sm">
                          <div className="truncate text-slate-800 font-semibold">{itemsSummary}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold text-xs">
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-extrabold text-slate-900 text-base">
                          S/ {order.total.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* SHIFT CLOSURES HISTORY TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-4">Fecha / Hora Cierre</th>
                  <th className="py-4 px-4">Total Recaudado</th>
                  <th className="py-4 px-4">Efectivo</th>
                  <th className="py-4 px-4">Yape / Plin</th>
                  <th className="py-4 px-4">N° Pedidos</th>
                  <th className="py-4 px-4 text-right">Cajero / Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {cierresCaja.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      No se han registrado cierres de caja todavía.
                    </td>
                  </tr>
                ) : (
                  cierresCaja.map((cierre) => (
                    <tr key={cierre.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                        {cierre.fecha} {cierre.hora}
                      </td>
                      <td className="py-4 px-4 font-extrabold text-amber-600 text-base">
                        S/ {cierre.totalVendido.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 font-semibold text-emerald-700">
                        S/ {cierre.efectivo.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 font-semibold text-purple-700">
                        S/ {cierre.yapePlin.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        {cierre.cantidadPedidos} comanda(s)
                      </td>
                      <td className="py-4 px-4 text-right text-slate-500">
                        <span className="font-bold text-slate-800 block">{cierre.usuario}</span>
                        <span className="text-[10px] italic">{cierre.notas}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ORDER DETAIL MODAL */}
      {/* TICKET / BOLETA PRINT MODAL */}
      {selectedOrder && (
        <TicketReceiptModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
