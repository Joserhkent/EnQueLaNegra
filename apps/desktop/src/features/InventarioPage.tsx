import { useState, useEffect } from "react";
import { usePosStore, type Insumo } from "../store/usePosStore";
import { formatUnidad } from "../lib/utils";
import RecibirMercaderiaModal from "../components/inventario/RecibirMercaderiaModal";
import ConteoInventarioModal from "../components/inventario/ConteoInventarioModal";
import EditarInsumoModal from "../components/inventario/EditarInsumoModal";
import { formatConPresentacion, formatCosto } from "../lib/cantidades";
import {
  Boxes,
  PlusCircle,
  Search,
  AlertTriangle,
  CheckCircle2,
  History,
  X,
  ShieldAlert,
  Tags,
  Trash2,
  PackagePlus,
  ClipboardCheck,
  Pencil,
} from "lucide-react";

// Helper de seguridad para extraer texto si viene como objeto o string
const getNombreTexto = (campo: unknown): string => {
  if (!campo) return "";
  if (typeof campo === "object") {
    const obj = campo as { nombre?: string; name?: string; title?: string };
    return obj.nombre || obj.name || obj.title || "";
  }
  return String(campo);
};

export default function InventarioPage() {
  const { insumos, movimientos, addStockMovement, fetchMovimientos, currentUser, categorias, fetchCategorias, addCategoria, deleteCategoria, addInsumo, deleteInsumo } = usePosStore();
  const isJefe = currentUser?.role === "jefe";
  const [isRecibirOpen, setIsRecibirOpen] = useState(false);
  const [isConteoOpen, setIsConteoOpen] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  // El Kardex/Historial no viene precargado en el store: hay que pedirlo explícitamente.
  useEffect(() => {
    fetchMovimientos();
    fetchCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [statusFilter, setStatusFilter] = useState<"all" | "critico" | "bajo" | "optimo" | "incompleto">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"insumos" | "historial">("insumos");

  // Modal: Nuevo Insumo
  const [isInsumoModalOpen, setIsInsumoModalOpen] = useState(false);
  const [nuevoInsumo, setNuevoInsumo] = useState({
    nombre: "",
    categoria: "Panes y Masas",
    unidadMedida: "unidad",
    stockActual: "0",
    stockMinimo: "0",
    costoUnitario: "0",
  });

  // Modal: Gestionar Categorías
  const [isCategoriasModalOpen, setIsCategoriasModalOpen] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");

  // Reabastecimiento Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>("");
  const [movementType, setMovementType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  // String (no number): así el campo puede quedar vacío mientras se re-escribe,
  // en vez de forzar un "0" que se queda pegado delante de lo que se teclea después.
  const [amount, setAmount] = useState<string>("10");
  const [reason, setReason] = useState<string>("Reabastecimiento de proveedor");

  const categoriasInsumo = categorias
    .filter((c) => c.tipo === "INSUMO")
    .map((c) => c.nombre);

  // Mientras no estén cargadas las categorías del backend, mostramos las clásicas
  const categories = [
    "Todos",
    ...(categoriasInsumo.length > 0 ? categoriasInsumo : [
      "Panes y Masas",
      "Carnes y Proteínas",
      "Quesos y Lácteos",
      "Verduras y Legumbres",
      "Papas",
      "Cremas",
    ]),
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-extrabold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" /> Stock Crítico
          </span>
        );
      case "bajo":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Reordenar
          </span>
        );
      case "optimo":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Con stock
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

  const handleOpenInsumoModal = () => {
    setNuevoInsumo({
      nombre: "",
      categoria: categoriasInsumo[0] || "General",
      unidadMedida: "unidad",
      stockActual: "0",
      stockMinimo: "0",
      costoUnitario: "0",
    });
    setIsInsumoModalOpen(true);
  };

  const handleCreateInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await addInsumo({
      nombre: nuevoInsumo.nombre.trim(),
      categoria: nuevoInsumo.categoria,
      unidadMedida: nuevoInsumo.unidadMedida || "unidad",
      stockActual: parseFloat(nuevoInsumo.stockActual) || 0,
      stockMinimo: parseFloat(nuevoInsumo.stockMinimo) || 0,
      costoUnitario: parseFloat(nuevoInsumo.costoUnitario) || 0,
    });
    if (ok) setIsInsumoModalOpen(false);
  };

  const handleDeleteInsumo = async (item: Insumo) => {
    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar el insumo "${item.nombre}"? Esta acción no se puede deshacer.`
    );
    if (confirmado) {
      await deleteInsumo(item.id);
    }
  };

  const handleCreateCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    const ok = await addCategoria(nombre, "INSUMO");
    if (ok) setNuevaCategoria("");
  };

  const handleDeleteCategoria = async (cat: { id: string; nombre: string }) => {
    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar la categoría "${cat.nombre}"? Solo se puede eliminar si no tiene insumos asociados.`
    );
    if (confirmado) {
      await deleteCategoria(cat.id);
    }
  };

  // Sin costo o sin mínimo: la jefa los completa en el sistema (el costo se llena solo al recibir con lo pagado)
  const faltaDato = (i: Insumo) => !(i.costoUnitario > 0) || !(i.stockMinimo > 0);

  // Filtered insumos
  const filteredInsumos = insumos.filter((item) => {
    const status = getInsumoStatus(item);
    const catNombre = getNombreTexto(item.categoria);
    
    const matchesCategory = selectedCategory === "Todos" || catNombre === selectedCategory;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "incompleto" ? faltaDato(item) : status === statusFilter);
    const matchesSearch = item.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalInsumos = insumos.length;
  const criticalCount = insumos.filter((i) => getInsumoStatus(i) === "critico").length;
  const lowCount = insumos.filter((i) => getInsumoStatus(i) === "bajo").length;
  const incompletosCount = insumos.filter(faltaDato).length;
  const totalInventoryValue = insumos.reduce((acc, curr) => acc + curr.stockActual * curr.costoUnitario, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-3xl text-slate-900">Inventario</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isJefe && (
            <>
            <button
              onClick={() => setIsCategoriasModalOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold px-4 py-2.5 rounded-md text-sm transition-colors active:scale-95"
            >
              <Tags className="w-4 h-4 text-slate-500" />
              Categorías
            </button>
            <button
              onClick={handleOpenInsumoModal}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-md text-sm transition-colors active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Nuevo insumo
            </button>
            <button
              onClick={() => setIsConteoOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold px-4 py-2.5 rounded-md text-sm transition-colors active:scale-95"
            >
              <ClipboardCheck className="w-4 h-4 text-slate-500" />
              Contar inventario
            </button>
            </>
          )}
          <button
            onClick={() => setIsRecibirOpen(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 rounded-md text-sm transition-colors active:scale-95"
          >
            <PackagePlus className="w-4 h-4" />
            Recibir mercadería
          </button>
        </div>
      </div>

      {aviso && (
        <div role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {aviso}
        </div>
      )}

      {isJefe && incompletosCount > 0 && statusFilter !== "incompleto" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 hidden sm:block" />
          <p className="flex-1 text-sm text-amber-900">
            <span className="font-bold">{incompletosCount} insumos sin costo o sin mínimo.</span>{" "}
            El costo se llena solo cuando recibes mercadería y escribes lo que pagaste. El mínimo ponlo con el lápiz.
          </p>
          <button
            type="button"
            onClick={() => { setActiveTab("insumos"); setStatusFilter("incompleto"); }}
            className="shrink-0 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            Ver cuáles
          </button>
        </div>
      )}

      {isRecibirOpen && (
        <RecibirMercaderiaModal
          onClose={() => setIsRecibirOpen(false)}
          onGuardado={(m) => { setIsRecibirOpen(false); setAviso(m); }}
        />
      )}
      {isConteoOpen && (
        <ConteoInventarioModal
          onClose={() => setIsConteoOpen(false)}
          onGuardado={(m) => { setIsConteoOpen(false); setAviso(m); }}
        />
      )}
      {editando && (
        <EditarInsumoModal
          insumo={editando}
          onClose={() => setEditando(null)}
          onGuardado={(m) => { setEditando(null); setAviso(m); }}
        />
      )}

      {/* Cifras del inventario */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Insumos</span>
          <div className="text-3xl font-display text-slate-900">{totalInsumos}</div>
        </div>

        <div className="bg-white p-4">
          <span className="text-xs font-medium text-rose-700">Sin stock / crítico</span>
          <div className="text-3xl font-display text-rose-600">{criticalCount}</div>
          <span className="text-xs text-slate-500">Reponer ya</span>
        </div>

        <div className="bg-white p-4">
          <span className="text-xs font-medium text-amber-800">Bajo el mínimo</span>
          <div className="text-3xl font-display text-amber-700">{lowCount}</div>
          <span className="text-xs text-slate-500">Reponer pronto</span>
        </div>

        <div className="bg-slate-900 p-4">
          <span className="text-xs font-medium text-slate-400">Valor del stock</span>
          <div className="text-3xl font-display text-amber-400">S/ {totalInventoryValue.toFixed(2)}</div>
          <span className="text-xs text-slate-400">A costo de compra</span>
        </div>
      </div>

      {/* Main Container with Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("insumos")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === "insumos"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Boxes className="w-4 h-4" />
              Insumos ({totalInsumos})
            </button>
            <button
              onClick={() => setActiveTab("historial")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === "historial"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <History className="w-4 h-4" />
              Movimientos ({movimientos.length})
            </button>
          </div>

          {activeTab === "insumos" && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/60 text-xs font-semibold">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === "all" ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter("critico")}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === "critico" ? "bg-rose-500 text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Críticos ({criticalCount})
              </button>
              <button
                onClick={() => setStatusFilter("bajo")}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === "bajo" ? "bg-amber-500 text-slate-950" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Bajos ({lowCount})
              </button>
              {isJefe && incompletosCount > 0 && (
                <button
                  onClick={() => setStatusFilter("incompleto")}
                  className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                    statusFilter === "incompleto" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Por completar ({incompletosCount})
                </button>
              )}
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
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-amber-500 text-slate-950"
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
                  placeholder="Buscar insumo"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Insumos Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-[10px]">
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4">Mínimo</th>
                    <th className="py-3 px-4">Costo unit.</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredInsumos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                        Ningún insumo coincide con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredInsumos.map((item) => {
                      const status = getInsumoStatus(item);
                      const isLow = status !== "optimo";
                      const categoriaNombre = getNombreTexto(item.categoria);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-sm">{item.nombre}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold">
                              {/* 🛠️ FIX 1: Renderizado seguro de la categoría */}
                              {categoriaNombre || "Sin categoría"}
                            </span>
                            {categoriaNombre === "Cremas" && (
                              <span className="block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded text-[9px] font-bold w-max">
                                Aderezo libre
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className={`text-base font-extrabold ${isLow ? "text-rose-600" : "text-slate-900"}`}>
                              {formatConPresentacion(item.stockActual, item)}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-600">
                            {item.stockMinimo > 0 ? (
                              formatConPresentacion(item.stockMinimo, item)
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">Falta</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {item.costoUnitario > 0 ? (
                              formatCosto(item.costoUnitario, item)
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold" title="Se llena solo al recibir mercadería con lo pagado">
                                Al comprar
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            S/ {(item.stockActual * item.costoUnitario).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getStatusBadge(status)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isJefe && (
                              <button
                                onClick={() => setEditando(item)}
                                className="p-2 mr-2 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                                title="Editar presentación, mínimo y costo"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isJefe && (
                              <button
                                onClick={() => handleDeleteInsumo(item)}
                                className="p-2 mr-2 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Eliminar insumo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenMovementModal(item.id)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md text-[11px] transition active:scale-95"
                            >
                              Recargar
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
              <h3 className="font-bold text-slate-900 text-sm">Movimientos de stock</h3>
              <span className="text-xs text-slate-500">Ventas, cancelaciones y ajustes manuales</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-[10px]">
                    <th className="py-3 px-4">Fecha y hora</th>
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Cantidad</th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4 text-right">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {movimientos.map((mov) => {
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
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {mov.fecha}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {nombreInsumo}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Movimiento de stock</h3>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-md bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMovement} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Insumo
                </label>
                <select
                  value={selectedInsumoId}
                  onChange={(e) => setSelectedInsumoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} (Stock actual: {i.stockActual} {formatUnidad(i.unidadMedida, i.stockActual)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo
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
                      className={`py-2 rounded-md text-xs font-bold transition ${
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Ej: Factura Proveedor #F001-2940"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NUEVO INSUMO MODAL */}
      {isInsumoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Nuevo insumo</h3>
                </div>
              </div>
              <button
                onClick={() => setIsInsumoModalOpen(false)}
                className="p-2 rounded-md bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInsumo} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del insumo</label>
                <input
                  type="text"
                  required
                  value={nuevoInsumo.nombre}
                  onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, nombre: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Ej: Queso Mozzarella"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={nuevoInsumo.categoria}
                    onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, categoria: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    {categories.filter((c) => c !== "Todos").map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unidad de medida</label>
                  <select
                    value={nuevoInsumo.unidadMedida}
                    onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, unidadMedida: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="unidad">unidad</option>
                    <option value="porción">porción</option>
                    <option value="ml">ml</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litro">litro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stock inicial</label>
                  <input type="number" min="0" step="any" value={nuevoInsumo.stockActual} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, stockActual: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stock mínimo</label>
                  <input type="number" min="0" step="any" value={nuevoInsumo.stockMinimo} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, stockMinimo: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Costo unit. (S/)</label>
                  <input type="number" min="0" step="any" value={nuevoInsumo.costoUnitario} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, costoUnitario: e.target.value })} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsInsumoModalOpen(false)} className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition">Crear Insumo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORIAS MODAL */}
      {isCategoriasModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Categorías de insumos</h3>
                </div>
              </div>
              <button
                onClick={() => setIsCategoriasModalOpen(false)}
                className="p-2 rounded-md bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <form onSubmit={handleCreateCategoria} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={nuevaCategoria}
                  onChange={(e) => setNuevaCategoria(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Ej: Bebidas"
                />
                <button type="submit" className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition shrink-0">
                  Crear
                </button>
              </form>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {categorias.filter((c) => c.tipo === "INSUMO").length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">Aún no hay categorías.</p>
                ) : (
                  categorias.filter((c) => c.tipo === "INSUMO").map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-xs font-bold text-slate-800">{cat.nombre}</span>
                      <button
                        onClick={() => handleDeleteCategoria(cat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}