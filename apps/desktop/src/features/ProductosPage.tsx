import React, { useState, useMemo } from "react";
import { 
  Flame, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  Search, 
  Plus, 
  LayoutGrid, 
  List 
} from "lucide-react";

import { usePosStore } from "../store/usePosStore";
import ErrorBoundary from "../components/ErrorBoundary";

// Tipos adaptados para tolerar objeto o string en categoría
export interface CategoriaObj {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria?: CategoriaObj | string;
  iconoEmoji: string;
  isAvailable: boolean;
  isPopular?: boolean;
  receta?: string[];
}

export interface Insumo {
  id: string;
  nombre: string;
  categoria?: string;
}

interface ProductosPageProps {
  products?: Producto[];
  insumos?: Insumo[];
  isJefe?: boolean;
  toggleProductAvailability?: (id: string) => void;
  deleteProduct?: (id: string) => void;
  saveProduct?: (productData: any) => void;
}

export function ProductosPageContent(props?: ProductosPageProps) {
  const store = usePosStore();
  const rawProducts = props?.products ?? store.productos;
  const rawInsumos = props?.insumos ?? store.insumos;
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const insumos = Array.isArray(rawInsumos) ? rawInsumos : [];

  const isJefe = props?.isJefe ?? (store.currentUser?.role === "jefe");
  const toggleProductAvailability = props?.toggleProductAvailability ?? store.toggleProductAvailability;
  const deleteProduct = props?.deleteProduct ?? store.deleteProduct;
  const saveProduct = props?.saveProduct ?? (async (productData: any) => {
    if (productData.id && products.some((p) => p.id === productData.id)) {
      await store.updateProduct(productData);
    } else {
      await store.addProduct(productData);
    }
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Estados Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    sku: "",
    nombre: "",
    descripcion: "",
    precio: 0,
    categoria: "Hamburguesas de Carne",
    iconoEmoji: "🍔",
    isAvailable: true,
    isPopular: false,
    selectedReceta: [] as string[],
  });

  // Categorías fijas de navegación
  const categories = [
    "Todas",
    "Hamburguesas de Carne",
    "Pollo Deshilachado",
    "Embutidos",
    "Salchipapas y Salchipollos",
    "Agregados",
    "Bebidas",
  ];

  // Helper para extraer nombre de la categoría de forma segura
  const getCatName = (cat?: CategoriaObj | string): string => {
    if (typeof cat === "object" && cat !== null) {
      return cat.nombre || "";
    }
    return typeof cat === "string" ? cat : "";
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const catName = getCatName(p.categoria);
      const matchesCat =
        selectedCategory === "Todas" || catName === selectedCategory;

      const matchesSearch =
        p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleOpenModal = (prod?: Producto) => {
    try {
      if (prod) {
        setEditingProduct(prod);
        setFormData({
          sku: prod.sku || "",
          nombre: prod.nombre || "",
          descripcion: prod.descripcion || "",
          precio: typeof prod.precio === "number" ? prod.precio : (parseFloat(String(prod.precio)) || 0),
          categoria: getCatName(prod.categoria) || "Hamburguesas de Carne",
          iconoEmoji: prod.iconoEmoji || "🍔",
          isAvailable: prod.isAvailable !== false,
          isPopular: !!prod.isPopular,
          selectedReceta: Array.isArray(prod.receta) ? [...prod.receta] : [],
        });
      } else {
        setEditingProduct(null);
        const nextNum = (products?.length || 0) + 1;
        setFormData({
          sku: `HC0${nextNum}`,
          nombre: "",
          descripcion: "",
          precio: 0,
          categoria: "Hamburguesas de Carne",
          iconoEmoji: "🍔",
          isAvailable: true,
          isPopular: false,
          selectedReceta: [],
        });
      }
      setIsEmojiPickerOpen(false);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Error al abrir modal de producto:", err);
    }
  };

  const handleToggleRecetaInsumo = (insumoId: string) => {
    if (!insumoId) return;
    setFormData((prev) => {
      const curReceta = Array.isArray(prev?.selectedReceta) ? prev.selectedReceta : [];
      const exists = curReceta.includes(insumoId);
      return {
        ...prev,
        selectedReceta: exists
          ? curReceta.filter((id) => id !== insumoId)
          : [...curReceta, insumoId],
      };
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productPayload = {
        id: editingProduct?.id || formData.sku || `PROD-${Date.now()}`,
        sku: formData.sku?.trim() || `HC0${(products?.length || 0) + 1}`,
        nombre: formData.nombre?.trim() || "Nuevo Producto",
        descripcion: formData.descripcion?.trim() || "",
        precio: Number(formData.precio) || 0,
        categoria: formData.categoria || "Hamburguesas de Carne",
        iconoEmoji: formData.iconoEmoji || "🍔",
        isAvailable: formData.isAvailable !== false,
        isPopular: Boolean(formData.isPopular),
        receta: Array.isArray(formData.selectedReceta) ? formData.selectedReceta : [],
      };

      if (typeof saveProduct === "function") {
        await saveProduct(productPayload);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error al guardar producto:", err);
      alert("Ocurrió un error al guardar el producto. Intenta nuevamente.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Gestión de Productos POS
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Administra los ítems de tu carta, precios y sus recetas de insumos.
          </p>
        </div>

        {isJefe && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Nuevo Producto
          </button>
        )}
      </div>

      {/* Bar Search & Categorías & Vista */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          {/* Selector de Vistas */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/60 self-end md:self-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cuadrícula
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Tabla
            </button>
          </div>
        </div>

        {/* Categorías Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition shrink-0 ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Content Display */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center text-2xl">
            🔍
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No se encontraron productos
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Prueba ajustando los términos de búsqueda o seleccionando otra categoría.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between group hover:shadow-lg ${
                !prod.isAvailable
                  ? "border-slate-200 opacity-75"
                  : "border-slate-200/80 hover:border-amber-400/60"
              }`}
            >
              {/* Product Header Card */}
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-3xl shrink-0 group-hover:scale-105 transition-transform">
                    {prod.iconoEmoji}
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {prod.isPopular && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[10px] font-extrabold flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-500" /> Popular
                      </span>
                    )}

                    <button
                      onClick={() => toggleProductAvailability(prod.id)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                        prod.isAvailable
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      {prod.isAvailable ? "Disponible" : "Agotado"}
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-slate-400 tracking-wider font-mono">
                      {prod.sku}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                      {getCatName(prod.categoria)}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-1 line-clamp-1 group-hover:text-amber-600 transition-colors">
                    {prod.nombre}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {prod.descripcion}
                  </p>
                </div>

                {/* Receta BOM Insumos Badges */}
                {(prod.receta?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(prod.receta || []).map((insId) => {
                      const insumo = insumos.find((i) => i.id === insId);
                      return (
                        <span
                          key={insId}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                        >
                          {insumo ? insumo.nombre : insId}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Card Footer: Price & Actions */}
              <div className="p-4 px-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                    Precio POS
                  </span>
                  <span className="text-lg font-extrabold text-slate-900">
                    S/ {typeof prod.precio === "number" ? prod.precio.toFixed(2) : Number(prod.precio || 0).toFixed(2)}
                  </span>
                </div>

                {isJefe && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenModal(prod)}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-sm"
                      title="Editar Producto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteProduct(prod.id)}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shadow-sm"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-6">Producto</th>
                  <th className="py-4 px-4">SKU / Categoría</th>
                  <th className="py-4 px-4">Receta (Insumos que descuenta)</th>
                  <th className="py-4 px-4">Precio POS</th>
                  <th className="py-4 px-4 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredProducts.map((prod) => (
                  <tr
                    key={prod.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 bg-amber-50 rounded-2xl border border-amber-100">
                          {prod.iconoEmoji}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {prod.nombre}
                            {prod.isPopular && (
                              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                            {prod.descripcion}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-mono font-bold text-slate-800">
                        {prod.sku}
                      </div>
                      <span className="text-[10px] text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md font-semibold">
                        {getCatName(prod.categoria)}
                      </span>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {(prod.receta || []).map((insId) => {
                          const insumo = insumos.find((i) => i.id === insId);
                          return (
                            <span
                              key={insId}
                              className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]"
                            >
                              {insumo ? insumo.nombre : insId}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-extrabold text-slate-900 text-sm">
                      S/ {typeof prod.precio === "number" ? prod.precio.toFixed(2) : Number(prod.precio || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => toggleProductAvailability(prod.id)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition ${
                          prod.isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {prod.isAvailable ? "Disponible" : "Agotado"}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {isJefe && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(prod)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProduct(prod.id)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  {formData.iconoEmoji}
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingProduct ? "Editar Producto" : "Nuevo Producto POS"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Asigna la receta e insumos que descontará del inventario
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="HC01"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) =>
                      setFormData({ ...formData, categoria: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="Hamburguesas de Carne">Hamburguesas de Carne</option>
                    <option value="Pollo Deshilachado">Pollo Deshilachado</option>
                    <option value="Embutidos">Embutidos</option>
                    <option value="Salchipapas y Salchipollos">Salchipapas y Salchipollos</option>
                    <option value="Agregados">Agregados</option>
                    <option value="Bebidas">Bebidas</option>
                  </select>
                </div>
              </div>

              {/* Nombre & Emoji */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="Ej: Reina Pepiada"
                  />
                </div>

                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Icono Carta
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between hover:bg-slate-100 transition"
                  >
                    <span className="text-xl leading-none">
                      {formData.iconoEmoji}
                    </span>
                    <span className="text-[11px] font-bold text-amber-600">
                      Cambiar ▾
                    </span>
                  </button>

                  {/* Floating Popover Picker */}
                  {isEmojiPickerOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 p-2.5 bg-white border border-slate-200 shadow-2xl rounded-2xl grid grid-cols-4 gap-1.5 w-48 animate-in fade-in zoom-in-95 duration-150">
                      {[
                        "🍔", "🥩", "🍗", "🥪", "🌭", "🍳", "💥", "🍟", 
                        "🧀", "👑", "🥓", "🍌", "🍍", "🥤", "🍾", "☕"
                      ].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, iconoEmoji: emoji });
                            setIsEmojiPickerOpen(false);
                          }}
                          className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                            formData.iconoEmoji === emoji
                              ? "bg-amber-500 text-slate-950 scale-110 shadow-md ring-2 ring-amber-500/40"
                              : "bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Precio & Opciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Precio (S/.)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={formData.precio}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        precio: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-4 pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isAvailable}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isAvailable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                    Disponible
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPopular}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isPopular: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                    Destacado 🔥
                  </label>
                </div>
              </div>

              {/* Receta (BOM) Insumos Selection Organized by Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Receta BOM (Insumos que descontará del inventario al venderse)
                </label>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto space-y-3">
                  {(() => {
                    const safeInsumos = (Array.isArray(insumos) ? insumos : []).filter(
                      (i): i is Insumo & { id: string } => Boolean(i && i.id)
                    );

                    const rawCategories = safeInsumos
                      .map((i) => (typeof i.categoria === "string" && i.categoria.trim() ? i.categoria : "General"))
                      .filter((c) => c !== "Cremas y Aderezos");

                    const recipeCategories = Array.from(new Set(rawCategories));

                    if (recipeCategories.length === 0) {
                      return (
                        <div className="text-center py-6 text-xs text-slate-400 font-medium">
                          No hay insumos registrados para la receta.
                        </div>
                      );
                    }

                    return recipeCategories.map((catName) => {
                      const catInsumos = safeInsumos.filter(
                        (i) => (i.categoria || "General") === catName
                      );

                      if (catInsumos.length === 0) return null;

                      return (
                        <div key={catName} className="space-y-1">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                            {catName}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {catInsumos.map((ins) => {
                              const isChecked = Boolean(
                                Array.isArray(formData.selectedReceta) &&
                                formData.selectedReceta.includes(ins.id)
                              );
                              return (
                                <button
                                  key={ins.id}
                                  type="button"
                                  onClick={() => handleToggleRecetaInsumo(ins.id)}
                                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-left transition flex items-center justify-between border ${
                                    isChecked
                                      ? "bg-amber-500/10 border-amber-500 text-amber-900 font-bold"
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  <span className="truncate">{ins.nombre || ins.id}</span>
                                  {isChecked && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Buttons */}
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
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
                >
                  {editingProduct ? "Guardar Cambios" : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductosPage(props?: ProductosPageProps) {
  return (
    <ErrorBoundary fallbackTitle="Error en el módulo de Productos POS">
      <ProductosPageContent {...props} />
    </ErrorBoundary>
  );
}