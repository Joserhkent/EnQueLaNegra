import { useState } from "react";
import { usePosStore, type Order } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import {
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
  const [selectedKitchenOrder, setSelectedKitchenOrder] = useState<Order | null>(null);

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-3xl text-slate-900">Historial</h1>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold px-4 py-2.5 rounded-md text-sm transition-colors active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Cifras del periodo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-900 p-4">
          <span className="text-xs font-semibold text-amber-400">Total vendido</span>
          <div className="text-3xl font-display text-white">S/ {totalSales.toFixed(2)}</div>
        </div>

        <div className="bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Pedidos</span>
          <div className="text-3xl font-display text-slate-900">{totalOrdersCount}</div>
        </div>

        <div className="bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Ticket promedio</span>
          <div className="text-3xl font-display text-slate-900">S/ {averageTicket.toFixed(2)}</div>
        </div>

        <div className="bg-white p-4 min-w-0">
          <span className="text-xs font-medium text-slate-500">Más vendido</span>
          <div className="text-xl font-display text-slate-900 truncate">{starProduct.name}</div>
          <span className="text-xs text-slate-500">{starProduct.count} u.</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-6">
        {/* Navigation Tabs (Pedidos vs Cierres de Caja) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("pedidos")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === "pedidos"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Historial de Pedidos ({filteredOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("cierres")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === "cierres"
                  ? "bg-slate-900 text-white"
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
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        {activeTab === "pedidos" ? (
          /* ORDERS HISTORY TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-[10px]">
                  <th className="py-3 px-4">Fecha y hora</th>
                  <th className="py-3 px-4">Pedido</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Productos</th>
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      Sin pedidos en este periodo.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const itemsSummary = order.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {order.fecha} {order.hora}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 text-sm">
                          {order.code}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {order.customer}
                        </td>
                        <td className="py-3 px-4 max-w-sm">
                          <div className="truncate text-slate-800 font-semibold">{itemsSummary}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold text-xs">
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 text-base">
                          S/ {order.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedKitchenOrder(order)}
                              className="px-2 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                              title="Imprimir comanda de cocina"
                            >
                              Comanda
                            </button>
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
                              title="Ver Detalle Completo"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
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
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-[10px]">
                  <th className="py-3 px-4">Cierre</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Efectivo</th>
                  <th className="py-3 px-4">Yape / Plin</th>
                  <th className="py-3 px-4">Pedidos</th>
                  <th className="py-3 px-4 text-right">Cajero / notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {cierresCaja.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      Aún no hay cierres de caja.
                    </td>
                  </tr>
                ) : (
                  cierresCaja.map((cierre) => (
                    <tr key={cierre.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {cierre.fecha} {cierre.hora}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-amber-600 text-base">
                        S/ {cierre.totalVendido.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        S/ {cierre.efectivo.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-purple-700">
                        S/ {cierre.yapePlin.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {cierre.cantidadPedidos} comanda(s)
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
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

      {/* BOLETERA DE COCINA: ticket sin precios, solo el detalle del pedido */}
      {selectedKitchenOrder && (
        <TicketReceiptModal
          order={selectedKitchenOrder}
          mode="comanda"
          onClose={() => setSelectedKitchenOrder(null)}
        />
      )}
    </div>
  );
}
