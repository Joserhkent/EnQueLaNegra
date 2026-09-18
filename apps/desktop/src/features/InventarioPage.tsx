import { useState, useEffect } from "react";
import { usePosStore, type Insumo } from "../store/usePosStore";
import { formatUnidad } from "../lib/utils";
import {
  Boxes,
  PlusCircle,
  Search,
  AlertTriangle,
  CheckCircle2,
  History,
  X,
  ShieldAlert,
  Coins
} from "lucide-react";

// Helper de seguridad para extraer texto si viene como objeto o string
const getNombreTexto = (campo: any): string => {
  if (!campo) return "";
  if (typeof campo === "object") {
    return campo.nombre || campo.name || campo.title || "";
  }
  return String(campo);
};

export default function InventarioPage() {
  const { insumos, movimientos, addStockMovement, fetchMovimientos, currentUser } = usePosStore();
  const isJefe = currentUser?.role === "jefe";

  // El Kardex/Historial no viene precargado en el store: hay que pedirlo explícitamente.
  useEffect(() => {
    fetchMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [statusFilter, setStatusFilter] = useState<"all" | "critico" | "bajo" | "optimo">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"insumos" | "historial">("insumos");

  // Reabastecimiento Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>("");
  const [movementType, setMovementType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  // String (no number): así el campo puede quedar vacío mientras se re-escribe,
  // en vez de forzar un "0" que se queda pegado delante de lo que se teclea después.
  const [amount, setAmount] = useState<string>("10");
  const [reason, setReason] = useState<string>("Reabastecimiento de proveedor");

  const categories = [
    "Todos",
    "Panes y Masas",
    "Carnes y Proteínas",
    "Quesos y Lácteos",
    "Verduras y Legumbres",
    "Papas",
    "Salsas y Aderezos",
  ];

  // Helper status calculator
  const getInsumoStatus = (insumo: Insumo) => {
    if (insumo.stockActual <= insumo.stockMinimo / 2) return "critico";
    if (insumo.stockActual <= insumo.stockMinimo) return "bajo";
    return "optimo";
  };

  const getStatusBadge = (status: "critico" | "bajo" | "optimo") => {
    switch (status) {
      case "critico":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" /> Stock Crítico
          </span>
        );
      case "bajo":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Reordenar
          </span>
        );
      case "optimo":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Óptimo
          </span>
        );
    }
  };

  const handleOpenMovementModal = (insumoId?: string) => {
    if (insumoId) {
      setSelectedInsumoId(insumoId);
    } else if (insumos.length > 0) {
      setSelectedInsumoId(insumos[0].id);
    }
    setMovementType("entrada");
    setAmount("10");
    setReason("Compra de insumos / Reabastecimiento");
    setIsModalOpen(true);
  };

  const handleSubmitMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount) || 0;
    if (!selectedInsumoId || numericAmount <= 0) return;
    addStockMovement(selectedInsumoId, numericAmount, movementType, reason);
    setIsModalOpen(false);
  };

  // Filtered insumos
  const filteredInsumos = insumos.filter((item: any) => {
    const status = getInsumoStatus(item);
    const catNombre = getNombreTexto(item.categoria);
    
    const matchesCategory = selectedCategory === "Todos" || catNombre === selectedCategory;
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesSearch = item.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalInsumos = insumos.length;
  const criticalCount = insumos.filter((i) => getInsumoStatus(i) === "critico").length;
  const lowCount = insumos.filter((i) => getInsumoStatus(i) === "bajo").length;
  const totalInventoryValue = insumos.reduce((acc, curr) => acc + curr.stockActual * curr.costoUnitario, 0);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Inventario & Insumos</h1>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-slate-500" />
              {totalInsumos} Insumos Base
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Control de stock en tiempo real, umbrales de reabastecimiento y movimientos de recetas (BOM).
          </p>
        </div>

        {isJefe && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenMovementModal()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-3 rounded-2xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Registrar Entrada / Reabastecimiento
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Insumos</span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{totalInsumos} items</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Registrados en el sistema</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-rose-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Stock Crítico</span>
            <div className="text-3xl font-extrabold text-rose-600 mt-1">{criticalCount} Insumos</div>
            <span className="text-[11px] text-rose-500 mt-1 block font-medium">Urgente reordenar</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Bajo Mínimo</span>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">{lowCount} Insumos</div>
            <span className="text-[11px] text-amber-600 mt-1 block font-medium">Cerca del umbral</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Valorización Stock</span>
            <div className="text-3xl font-extrabold text-amber-400 mt-1">S/ {totalInventoryValue.toFixed(2)}</div>
            <span className="text-[11px] text-slate-400 mt-1 block">Costo total acumulado</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400 backdrop-blur-md">
            <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Container with Tabs */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("insumos")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === "insumos"
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Boxes className="w-4 h-4" />
              Stock de Insumos ({totalInsumos})
            </button>
            <button
              onClick={() => setActiveTab("historial")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === "historial"
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <History className="w-4 h-4" />
              Kardex / Historial de Movimientos ({movimientos.length})
            </button>
          </div>

          {activeTab === "insumos" && (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/60 text-xs font-semibold">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-xl transition ${
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter("critico")}
                className={`px-3 py-1.5 rounded-xl transition ${
                  statusFilter === "critico" ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Críticos ({criticalCount})
              </button>
              <button
                onClick={() => setStatusFilter("bajo")}
                className={`px-3 py-1.5 rounded-xl transition ${
                  statusFilter === "bajo" ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Bajos ({lowCount})
              </button>
            </div>
          )}
        </div>

        {activeTab === "insumos" ? (
          <>
            {/* Filter Toolbar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar insumo (ej: Pan Brioche, Cheddar, Tocino)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Insumos Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-4 px-4">Insumo</th>
                    <th className="py-4 px-4">Categoría</th>
                    <th className="py-4 px-4">Stock Actual</th>
                    <th className="py-4 px-4">Stock Mínimo</th>
                    <th className="py-4 px-4">Costo Unit.</th>
                    <th className="py-4 px-4">Valor Total</th>
                    <th className="py-4 px-4 text-center">Estado</th>
                    <th className="py-4 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredInsumos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                        No se encontraron insumos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredInsumos.map((item: any) => {
                      const status = getInsumoStatus(item);
                      const isLow = status !== "optimo";
                      const categoriaNombre = getNombreTexto(item.categoria);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900 text-sm">{item.nombre}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {item.id}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold">
                              {/* 🛠️ FIX 1: Renderizado seguro de la categoría */}
                              {categoriaNombre || "Sin Categoría"}
                            </span>
                            {categoriaNombre === "Salsas y Aderezos" && (
                              <span className="block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded text-[9px] font-bold w-max">
                                🧪 Aderezo Libre (Consumo General)
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className={`text-base font-extrabold ${isLow ? "text-rose-600" : "text-slate-900"}`}>
                              {item.stockActual} <span className="text-xs font-normal text-slate-500">{formatUnidad(item.unidadMedida, item.stockActual)}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-semibold text-slate-600">
                            {item.stockMinimo} {formatUnidad(item.unidadMedida, item.stockMinimo)}
                          </td>
                          <td className="py-4 px-4 font-semibold text-slate-700">
                            S/ {Number(item.costoUnitario || 0).toFixed(2)}
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900">
                            S/ {(item.stockActual * item.costoUnitario).toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-center">
                            {getStatusBadge(status)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleOpenMovementModal(item.id)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-[11px] shadow-sm transition active:scale-95"
                            >
                              + Recargar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* HISTORIAL KARDEX MOVIMIENTOS */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Registro de Movimientos (Entradas / Salidas)</h3>
              <span className="text-xs text-slate-400 font-medium">Descuentos automáticos por ventas & cargas manuales</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-4 px-4">Fecha / Hora</th>
                    <th className="py-4 px-4">Insumo</th>
                    <th className="py-4 px-4">Tipo</th>
                    <th className="py-4 px-4">Cantidad</th>
                    <th className="py-4 px-4">Motivo / Origen</th>
                    <th className="py-4 px-4 text-right">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {movimientos.map((mov: any) => {
                    const insumoObj = insumos.find((i) => i.id === mov.insumoId);
                    
                    // 🛠️ FIX 2 y 3: Sanitización de Insumo y Usuario en movimientos
                    const nombreInsumo = typeof mov.insumo === "object" 
                      ? getNombreTexto(mov.insumo) 
                      : (insumoObj ? insumoObj.nombre : mov.insumoId);
                      
                    const nombreUsuario = typeof mov.usuario === "object"
                      ? getNombreTexto(mov.usuario)
                      : mov.usuario;

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {mov.fecha}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {nombreInsumo}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              mov.tipo === "entrada"
                                ? "bg-emerald-100 text-emerald-800"
                                : mov.tipo === "salida"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {mov.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-sm">
                          {mov.tipo === "entrada" ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{mov.motivo}</td>
                        <td className="py-3 px-4 text-right text-slate-500 font-semibold">
                          {nombreUsuario}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* REABASTECIMIENTO MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Registrar Movimiento de Stock</h3>
                  <p className="text-xs text-slate-400">Actualización manual del inventario de insumos</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMovement} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Seleccionar Insumo
                </label>
                <select
                  value={selectedInsumoId}
                  onChange={(e) => setSelectedInsumoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} (Stock actual: {i.stockActual} {formatUnidad(i.unidadMedida, i.stockActual)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de Operación
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "entrada", label: "Entrada / Compra", color: "bg-emerald-500" },
                      { key: "salida", label: "Salida / Merma", color: "bg-rose-500" },
                      { key: "ajuste", label: "Ajuste de Inventario", color: "bg-amber-500" },
                    ] as { key: "entrada" | "salida" | "ajuste"; label: string; color: string }[]
                  ).map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => setMovementType(t.key)}
                      className={`py-2 rounded-xl text-xs font-bold transition ${
                        movementType === t.key
                          ? `${t.color} text-white shadow-sm`
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cantidad a ingresar / descontar
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo u Origen
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Ej: Factura Proveedor #F001-2940"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}