import { useState, useEffect, useRef } from "react";
import { usePosStore, type Mesa, type Producto, type OrderItem } from "../store/usePosStore";
import {
  Users,
  Clock,
  Plus,
  X,
  ShoppingBasket,
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Trash2,
} from "lucide-react";

const CREMAS_DISPONIBLES = [
  "Guasacaca",
  "Salsa de Ajo",
  "Mayonesa",
  "Ketchup",
  "Mostaza",
  "Picante Casero",
];

const AGREGADOS_DISPONIBLES = [
  { nombre: "Queso Amarillo", precio: 0.75 },
  { nombre: "Plátano Maduro", precio: 0.75 },
  { nombre: "Carne Mechada", precio: 1.50 },
  { nombre: "Pollo Desmechado", precio: 1.50 },
  { nombre: "Tocineta", precio: 1.00 },
  { nombre: "Chicharrón", precio: 1.00 },
];

const CATEGORIAS_CON_PERSONALIZACION = [
  "Arepas Tradicionales",
  "Empanadas",
  "Cachapas",
  "Patacones",
  "Comida Rápida",
  "Horneados",
  "Especiales de Fin de Semana",
];

const CATEGORIES = [
  "Arepas Tradicionales",
  "Empanadas",
  "Cachapas",
  "Patacones",
  "Comida Rápida",
  "Horneados",
  "Especiales de Fin de Semana",
  "Agregados",
];

const getCategoriaNombre = (prod: Producto): string => {
  const categoria = prod.categoria as unknown;
  if (typeof categoria === "object" && categoria !== null && "nombre" in categoria) {
    return String((categoria as { nombre?: unknown }).nombre || "");
  }
  return String(categoria || "");
};

type CartLine = { product: Producto; quantity: number; notes: string; cremas: string[]; agregados: string[] };

function formatElapsed(startIso?: string | null): string {
  if (!startIso) return "--";
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return "--";
  const diffMs = Date.now() - start;
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function MesasPage() {
  const {
    mesas,
    productos,
    insumos,
    fetchMesas,
    fetchProductos,
    fetchInsumos,
    openMesa,
    addItemsToMesa,
    updateMesaItem,
    removeMesaItem,
    partialPaymentMesa,
    checkoutMesa,
    currentUser,
  } = usePosStore();

  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>("Arepas Tradicionales");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customizingProduct, setCustomizingProduct] = useState<Producto | null>(null);
  const [customizingQuantity, setCustomizingQuantity] = useState(1);
  const [customizingNotes, setCustomizingNotes] = useState("");
  const [customizingCremas, setCustomizingCremas] = useState<string[]>([]);
  const [customizingAgregados, setCustomizingAgregados] = useState<string[]>([]);
  const showInlineCustomization = false;
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "Yape/Plin" | "Mixto">("Efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoDigital, setMontoDigital] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutIsPartial, setCheckoutIsPartial] = useState(false);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState("");

  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  useEffect(() => {
    fetchMesas();
    if (productos.length === 0) fetchProductos();
    if (insumos.length === 0) fetchInsumos();
    const interval = setInterval(fetchMesas, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMesa = mesas.find((m) => m.id === selectedMesaId) || null;

  const findInsumoId = (nombre: string): string | null => {
    const found = insumos.find((i) => i.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    return found ? found.id : null;
  };

  const scrollCategories = (direction: "left" | "right") => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: direction === "left" ? -180 : 180, behavior: "smooth" });
    }
  };

  const handleAddToCart = (prod: Producto) => {
    setCustomizingProduct(prod);
    setCustomizingQuantity(1);
    setCustomizingNotes("");
    setCustomizingCremas([]);
    setCustomizingAgregados([]);
  };

  const handleConfirmCustomization = () => {
    if (!customizingProduct) return;
    const newLineId = `${customizingProduct.sku}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCart((prev) => ({
      ...prev,
      [newLineId]: {
        product: customizingProduct,
        quantity: Math.max(1, customizingQuantity),
        notes: customizingNotes.trim(),
        cremas: customizingCremas,
        agregados: customizingAgregados,
      },
    }));
    setCustomizingProduct(null);
  };

  const toggleCustomizationCrema = (crema: string) => setCustomizingCremas((prev) => prev.includes(crema) ? prev.filter((item) => item !== crema) : [...prev, crema]);
  const toggleCustomizationAgregado = (agregado: string) => setCustomizingAgregados((prev) => prev.includes(agregado) ? prev.filter((item) => item !== agregado) : [...prev, agregado]);

  const handleUpdateCartQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      const item = prev[lineId];
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[lineId];
        return copy;
      }
      return { ...prev, [lineId]: { ...item, quantity: newQty } };
    });
  };

  const handleUpdateCartNotes = (lineId: string, notes: string) => {
    setCart((prev) => (prev[lineId] ? { ...prev, [lineId]: { ...prev[lineId], notes } } : prev));
  };

  const handleToggleCrema = (lineId: string, crema: string) => {
    setCart((prev) => {
      const item = prev[lineId];
      if (!item) return prev;
      const has = item.cremas.includes(crema);
      return {
        ...prev,
        [lineId]: { ...item, cremas: has ? item.cremas.filter((c) => c !== crema) : [...item.cremas, crema] },
      };
    });
  };

  const handleToggleAgregado = (lineId: string, agregado: string) => {
    setCart((prev) => {
      const item = prev[lineId];
      if (!item) return prev;
      const has = item.agregados.includes(agregado);
      return {
        ...prev,
        [lineId]: { ...item, agregados: has ? item.agregados.filter((a) => a !== agregado) : [...item.agregados, agregado] },
      };
    });
  };

  const getAgregadosUnitPrice = (agregados: string[]) =>
    agregados.reduce((sum, nombre) => {
      const found = AGREGADOS_DISPONIBLES.find((a) => a.nombre === nombre);
      return sum + (found ? found.precio : 0);
    }, 0);

  const getCartItemTotal = (item: CartLine) => (item.product.precio + getAgregadosUnitPrice(item.agregados)) * item.quantity;
  const calculateCartTotal = () => Object.values(cart).reduce((acc, item) => acc + getCartItemTotal(item), 0);

  // Un clic solo abre el panel para ver/armar la comanda — no toca el backend ni
  // pide nombre del cliente. La mesa recién pasa a "Ocupada" cuando se envía la
  // primera tanda con productos (más abajo): así nunca queda una mesa "ocupada"
  // sin ningún pedido real por un clic accidental, y sigue sin fricción para abrir.
  const handleSendTanda = async () => {
    if (!selectedMesa) return;
    const cartList = Object.values(cart);
    if (cartList.length === 0) {
      alert("Agrega al menos un producto para enviar a cocina.");
      return;
    }

    const targetMesaId = selectedMesa.id;
    if (selectedMesa.status === "AVAILABLE") {
      const opened = await openMesa(targetMesaId);
      if (!opened) return; // openMesa ya muestra la alerta si falla
    }

    const items: OrderItem[] = cartList.map((item) => {
      const extrasFromCremas = item.cremas
        .map((cremaName) => {
          const insumoId = findInsumoId(cremaName);
          return insumoId ? { insumoId, cantidad: 1, precioExtra: 0 } : null;
        })
        .filter((e): e is { insumoId: string; cantidad: number; precioExtra: number } => e !== null);

      const extrasFromAgregados = item.agregados
        .map((agregadoName) => {
          const insumoId = findInsumoId(agregadoName);
          const found = AGREGADOS_DISPONIBLES.find((a) => a.nombre === agregadoName);
          return insumoId ? { insumoId, cantidad: 1, precioExtra: found ? found.precio : 0 } : null;
        })
        .filter((e): e is { insumoId: string; cantidad: number; precioExtra: number } => e !== null);

      return {
        productoId: item.product.id,
        sku: item.product.sku,
        nombre: item.product.nombre,
        precio: item.product.precio,
        cantidad: item.quantity,
        receta: item.product.receta || [],
        notas: item.notes,
        extras: [...extrasFromCremas, ...extrasFromAgregados],
      };
    });

    const result = await addItemsToMesa(targetMesaId, items);
    if (result) setCart({});
  };

  // Corrige un error en un ítem ya enviado (cantidad mal puesta) sin tener que
  // anularlo y volver a mandarlo — misma lógica de "editar línea" de Toast/Square.
  const handleEditItemQty = async (item: OrderItem, delta: number) => {
    if (!selectedMesa || !item.id) return;
    const nuevaCantidad = item.cantidad + delta;
    if (nuevaCantidad <= 0) return; // usar "Quitar" para eliminar del todo
    setUpdatingItemId(item.id);
    await updateMesaItem(selectedMesa.id, item.id, { cantidad: nuevaCantidad });
    setUpdatingItemId(null);
  };

  const handleRemoveItem = async (item: OrderItem) => {
    if (!selectedMesa || !item.id) return;
    const confirmar = window.confirm(`¿Quitar "${item.nombre}" de la cuenta de la mesa?`);
    if (!confirmar) return;
    setUpdatingItemId(item.id);
    await removeMesaItem(selectedMesa.id, item.id);
    setUpdatingItemId(null);
  };

  const handleOpenPartialPayment = () => {
    setCheckoutIsPartial(true);
    setPartialPaymentAmount("");
    setShowCheckout(true);
  };

  const paidAmount = (selectedMesa?.currentOrder?.pagos || []).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  const remainingAmount = Math.max(0, (selectedMesa?.currentOrder?.total || 0) - paidAmount);

  const handlePartialPayment = async () => {
    if (!selectedMesa) return;
    const amount = Number.parseFloat(partialPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Ingresa un monto válido para registrar el pago.");
      return;
    }
    if (amount > remainingAmount + 0.001) {
      alert(`El pago no puede superar el saldo pendiente de S/ ${remainingAmount.toFixed(2)}.`);
      return;
    }
    const mesa = await partialPaymentMesa(selectedMesa.id, paymentMethod, amount);
    if (mesa) {
      setPartialPaymentAmount("");
      setShowCheckout(false);
      setCheckoutIsPartial(false);
      setPaymentMethod("Efectivo");
    }
  };

  const handleCheckout = async () => {
    if (!selectedMesa) return;
    if (checkoutIsPartial) {
      await handlePartialPayment();
      return;
    }
    const numEf = parseFloat(montoEfectivo) || 0;
    const numDig = parseFloat(montoDigital) || 0;
    const order = await checkoutMesa(
      selectedMesa.id,
      paymentMethod,
      paymentMethod === "Mixto" ? numEf : undefined,
      paymentMethod === "Mixto" ? numDig : undefined
    );
    if (order) {
      setSelectedMesaId(null);
      setShowCheckout(false);
      setCheckoutIsPartial(false);
      setCart({});
      setMontoEfectivo("");
      setMontoDigital("");
      setPaymentMethod("Efectivo");
    }
  };

  const statusMeta: Record<Mesa["status"], { label: string; card: string; badge: string }> = {
    AVAILABLE: { label: "Libre", card: "bg-emerald-50 hover:bg-emerald-100", badge: "bg-emerald-500 text-white" },
    OCCUPIED: { label: "Ocupada", card: "bg-amber-50 hover:bg-amber-100", badge: "bg-amber-500 text-slate-950" },
    BILLING: { label: "Pidiendo Cuenta", card: "bg-blue-50 hover:bg-blue-100", badge: "bg-blue-500 text-white" },
  };

  const counts = {
    libres: mesas.filter((m) => m.status === "AVAILABLE").length,
    ocupadas: mesas.filter((m) => m.status === "OCCUPIED").length,
    cobrando: mesas.filter((m) => m.status === "BILLING").length,
  };

  const rondas: [number, OrderItem[]][] = (() => {
    if (!selectedMesa?.currentOrder) return [];
    const map = new Map<number, OrderItem[]>();
    for (const item of selectedMesa.currentOrder.items) {
      const ronda = item.ronda ?? 1;
      if (!map.has(ronda)) map.set(ronda, []);
      map.get(ronda)!.push(item);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  })();

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Salón / Mesas</h1>
          <p className="text-slate-500 text-sm mt-1">Atención acumulativa por mesa: abre, agrega tandas y cobra al final.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {counts.libres} Libres
          </span>
          <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> {counts.ocupadas} Ocupadas
          </span>
          <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> {counts.cobrando} En Cobro
          </span>
        </div>
      </div>

      {/* Grid de mesas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {mesas.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm font-medium bg-white rounded-3xl border border-slate-200/80">
            No hay mesas configuradas todavía.
          </div>
        ) : (
          mesas.map((mesa) => {
            const meta = statusMeta[mesa.status];
            const mesaPaid = (mesa.currentOrder?.pagos || []).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
            const mesaRemaining = Math.max(0, (mesa.currentOrder?.total || 0) - mesaPaid);
            const mesaLabel = mesaPaid > 0 ? "Pagada" : meta.label;
            return (
              <button
                key={mesa.id}
                onClick={() => setSelectedMesaId(mesa.id)}
                className={`relative p-4 text-left transition shadow-sm hover:shadow-md ${meta.card}`}
              >
                <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${meta.badge}`}>
                  {mesaLabel}
                </div>
                <img src="/mesa.svg" alt="" className="w-8 h-8 opacity-80" />
                <div className="text-3xl font-black text-slate-900 mt-1">#{mesa.number}</div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold mt-1">
                  <Users className="w-3.5 h-3.5" /> {mesa.capacity} personas
                </div>
                {mesa.currentOrder && (
                  <div className="mt-3 pt-3 border-t border-slate-900/10 space-y-1">
                    <div className="text-sm font-extrabold text-slate-900">Total S/ {mesa.currentOrder.total.toFixed(2)}</div>
                    {mesaPaid > 0 && (
                      <div className="text-[10px] font-extrabold text-emerald-700">Pagado S/ {mesaPaid.toFixed(2)} · Falta S/ {mesaRemaining.toFixed(2)}</div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                      <Clock className="w-3 h-3" /> {formatElapsed(mesa.currentOrder.createdAt)}
                    </div>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Panel de mesa seleccionada */}
      {selectedMesa && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  #{selectedMesa.number}
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    Mesa {selectedMesa.number}
                    {selectedMesa.currentOrder?.customer ? ` · ${selectedMesa.currentOrder.customer}` : ""}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedMesa.currentOrder
                      ? `Atendedor: ${selectedMesa.currentOrder.user?.name || currentUser?.name || "—"} · Abierta hace ${formatElapsed(selectedMesa.currentOrder.createdAt)}`
                      : "Mesa libre — agrega productos para abrir la cuenta"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedMesaId(null);
                  setCart({});
                  setShowCheckout(false);
                  setCheckoutIsPartial(false);
                  setPartialPaymentAmount("");
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 flex-1 overflow-hidden">
              {/* Catálogo */}
              <div className="md:col-span-3 p-6 space-y-4 overflow-y-auto border-r border-slate-100">
                <div className="relative flex items-center group py-1">
                  <button
                    type="button"
                    onClick={() => scrollCategories("left")}
                    className="absolute left-0 z-10 p-1.5 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 hover:bg-amber-500 hover:text-slate-950 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div
                    ref={categoryScrollRef}
                    className="flex gap-2 overflow-x-auto px-7 py-1.5 scrollbar-none scroll-smooth w-full"
                  >
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-2xl text-[11px] font-extrabold transition-all duration-200 whitespace-nowrap border shrink-0 ${
                          selectedCategory === cat
                            ? "bg-slate-900 text-amber-400 border-slate-900 shadow-md shadow-slate-900/20 scale-105"
                            : "bg-slate-100 text-slate-600 border-slate-200/80 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        {cat === "Agregados" ? "Porciones Extras" : cat}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollCategories("right")}
                    className="absolute right-0 z-10 p-1.5 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 hover:bg-amber-500 hover:text-slate-950 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {productos
                    .filter((p) => getCategoriaNombre(p) === selectedCategory && p.isAvailable)
                    .map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddToCart(prod)}
                        className="p-3 bg-slate-50 hover:bg-amber-500/10 hover:border-amber-400 border border-slate-200/80 rounded-2xl text-left transition flex items-center justify-between group"
                      >
                        <div>
                          <span className="text-xl">{prod.iconoEmoji}</span>
                          <div className="font-bold text-slate-900 text-xs mt-1 group-hover:text-amber-700">{prod.nombre}</div>
                          <div className="text-[11px] font-extrabold text-slate-600 mt-0.5">
                            S/ {Number(prod.precio || 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-amber-500 group-hover:text-slate-950 group-hover:border-amber-500 transition">
                          <Plus className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                </div>

                {/* Consumo acumulado */}
                {rondas.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-3 md:hidden">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" /> Consumo Acumulado
                    </h4>
                    {rondas.map(([ronda, items]) => (
                      <div key={ronda} className="bg-slate-50 rounded-2xl p-3 border border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ronda {ronda}</div>
                        <div className="space-y-1.5">
                          {items.map((item) => {
                            const isUpdating = updatingItemId === item.id;
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-700 truncate">{item.nombre}</div>
                                  {item.notas && (
                                    <div className="text-[10px] text-slate-400 italic truncate">"{item.notas}"</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-lg p-0.5">
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleEditItemQty(item, -1)}
                                    title="Corregir: quitar una unidad"
                                    className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-40 transition"
                                  >
                                    -
                                  </button>
                                  <span className="text-[11px] font-extrabold px-1 text-slate-900 w-4 text-center">
                                    {item.cantidad}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleEditItemQty(item, 1)}
                                    title="Corregir: agregar una unidad"
                                    className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-emerald-100 hover:text-emerald-600 disabled:opacity-40 transition"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="font-bold text-slate-500 w-16 text-right shrink-0">
                                  S/ {(item.precio * item.cantidad).toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleRemoveItem(item)}
                                  title="Quitar ítem de la cuenta (corrige un error)"
                                  className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-40 transition shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Carrito / Acciones */}
              <div className="md:col-span-2 p-6 bg-slate-50/50 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  {rondas.length > 0 && (
                    <div className="pb-4 border-b border-slate-200 space-y-3">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" /> Consumo Acumulado
                      </h4>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {rondas.map(([ronda, items]) => (
                          <div key={ronda} className="bg-white rounded-2xl p-3 border border-slate-200/70 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ronda {ronda}</div>
                            <div className="space-y-1.5">
                              {items.map((item) => {
                                const isUpdating = updatingItemId === item.id;
                                return (
                                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex-1 min-w-0"><div className="font-semibold text-slate-700 truncate">{item.nombre}</div></div>
                                    <div className="flex items-center gap-1 shrink-0 bg-slate-50 border-slate-200 rounded-lg p-0.5">
                                      <button type="button" disabled={isUpdating} onClick={() => handleEditItemQty(item, -1)} className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-rose-100 disabled:opacity-40">-</button>
                                      <span className="text-[11px] font-extrabold px-1 text-slate-900 w-4 text-center">{item.cantidad}</span>
                                      <button type="button" disabled={isUpdating} onClick={() => handleEditItemQty(item, 1)} className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-emerald-100 disabled:opacity-40">+</button>
                                    </div>
                                    <span className="font-bold text-slate-500 w-16 text-right shrink-0">S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                                    <button type="button" disabled={isUpdating} onClick={() => handleRemoveItem(item)} title="Quitar ítem de la cuenta" className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-40 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <ShoppingBasket className="w-4 h-4 text-amber-500" /> Nueva Tanda
                    </h4>
                    <span className="text-xs text-slate-500 font-semibold">{Object.keys(cart).length} items</span>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {Object.keys(cart).length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs font-medium">
                        Selecciona ítems del menú para la nueva tanda.
                      </div>
                    ) : (
                      Object.entries(cart).map(([lineId, item]) => (
                        <div key={lineId} className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="overflow-hidden pr-2">
                              <div className="font-bold text-slate-900 text-xs truncate">{item.product.nombre}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">S/ {getCartItemTotal(item).toFixed(2)}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 p-1 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(lineId, -1)}
                                className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center text-xs font-bold hover:bg-rose-100 hover:text-rose-600 transition"
                              >
                                -
                              </button>
                              <span className="text-xs font-extrabold px-1 text-slate-900">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(lineId, 1)}
                                className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center text-xs font-bold hover:bg-emerald-100 hover:text-emerald-600 transition"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {showInlineCustomization && CATEGORIAS_CON_PERSONALIZACION.includes(getCategoriaNombre(item.product)) && (
                            <>
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => handleUpdateCartNotes(lineId, e.target.value)}
                                placeholder="Ej: sin cebolla, poco picante..."
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-900 focus:outline-none focus:border-amber-500 placeholder:text-slate-400"
                              />
                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Salsas</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {CREMAS_DISPONIBLES.map((crema) => {
                                    const activa = item.cremas.includes(crema);
                                    return (
                                      <button
                                        key={crema}
                                        type="button"
                                        onClick={() => handleToggleCrema(lineId, crema)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                          activa
                                            ? "bg-amber-500 text-slate-950 border-amber-500"
                                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                        }`}
                                      >
                                        {crema}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Agregados</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {AGREGADOS_DISPONIBLES.map((agregado) => {
                                    const activo = item.agregados.includes(agregado.nombre);
                                    return (
                                      <button
                                        key={agregado.nombre}
                                        type="button"
                                        onClick={() => handleToggleAgregado(lineId, agregado.nombre)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                          activo
                                            ? "bg-blue-500 text-white border-blue-500"
                                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                        }`}
                                      >
                                        {agregado.nombre} +S/{agregado.precio.toFixed(2)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {Object.keys(cart).length > 0 && (
                    <button
                      type="button"
                      onClick={handleSendTanda}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <UtensilsCrossed className="w-4 h-4 text-amber-400" /> Enviar Tanda a Cocina (S/ {calculateCartTotal().toFixed(2)})
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                    <span className="text-xs font-bold text-amber-900">Total Acumulado Mesa</span>
                    <span className="text-xl font-extrabold text-amber-900">S/ {(selectedMesa.currentOrder?.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-emerald-700">Pagado</span>
                    <span className="text-emerald-700">S/ {paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold border-t border-slate-200 pt-1.5">
                    <span className="text-blue-800">Saldo pendiente</span>
                    <span className="text-blue-800">S/ {remainingAmount.toFixed(2)}</span>
                  </div>

                  {!showCheckout ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleOpenPartialPayment}
                        disabled={!selectedMesa.currentOrder?.items.length || remainingAmount <= 0}
                        className="col-span-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs shadow-md shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CircleDollarSign className="w-4 h-4" /> Registrar Pago Parcial
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCheckoutIsPartial(false); setPartialPaymentAmount(""); setShowCheckout(true); }}
                        disabled={!selectedMesa.currentOrder?.items.length}
                        className="col-span-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CircleDollarSign className="w-4 h-4" /> {remainingAmount <= 0 ? "Cerrar Mesa" : "Cobrar y Cerrar Mesa"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="rounded-2xl p-3 bg-blue-50 border-blue-200 text-xs font-bold text-blue-900">
                        {checkoutIsPartial ? `Pago parcial · Saldo pendiente: S/ ${remainingAmount.toFixed(2)}` : `Cobro total · Total de la mesa: S/ ${(selectedMesa.currentOrder?.total || 0).toFixed(2)}`}
                      </div>
                      {checkoutIsPartial && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Monto del pago parcial</label>
                          <input
                            type="number"
                            min="0.01"
                            max={remainingAmount}
                            step="0.01"
                            value={partialPaymentAmount}
                            onChange={(event) => setPartialPaymentAmount(event.target.value)}
                            placeholder={remainingAmount.toFixed(2)}
                            className="w-full px-3 py-2.5 bg-white border-blue-200 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["Efectivo", "Yape/Plin", "Mixto"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            className={`py-2 rounded-xl text-[10px] font-bold transition border ${
                              paymentMethod === m
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {m === "Mixto" ? "🔀 Mixto" : m}
                          </button>
                        ))}
                      </div>

                      {!checkoutIsPartial && paymentMethod === "Mixto" && (
                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">En Yape / Plin (S/)</label>
                              <input
                                type="number"
                                step="0.50"
                                value={montoDigital}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMontoDigital(val);
                                  const num = parseFloat(val) || 0;
                                  const tot = selectedMesa.currentOrder?.total || 0;
                                  setMontoEfectivo(num <= tot ? (tot - num).toFixed(2) : "0");
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">En Efectivo (S/)</label>
                              <input
                                type="number"
                                step="0.50"
                                value={montoEfectivo}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMontoEfectivo(val);
                                  const num = parseFloat(val) || 0;
                                  const tot = selectedMesa.currentOrder?.total || 0;
                                  setMontoDigital(num <= tot ? (tot - num).toFixed(2) : "0");
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowCheckout(false); setCheckoutIsPartial(false); setPartialPaymentAmount(""); }}
                          className="py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs transition"
                        >
                          Volver
                        </button>
                        <button
                          type="button"
                          onClick={handleCheckout}
                          className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl text-xs shadow-md transition active:scale-95"
                        >
                          {checkoutIsPartial
                            ? (Number.parseFloat(partialPaymentAmount) >= remainingAmount - 0.001 && remainingAmount > 0
                                ? "Registrar Pago Total y Cerrar Mesa"
                                : "Registrar Pago Parcial")
                            : (remainingAmount <= 0 ? "Cerrar Mesa" : "Confirmar Cobro")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {customizingProduct && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-amber-400 font-extrabold">Personalizar pedido</div>
                <h3 className="font-bold text-base mt-1">{customizingProduct.iconoEmoji} {customizingProduct.nombre}</h3>
              </div>
              <button type="button" onClick={() => setCustomizingProduct(null)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-3 border-slate-200">
                <span className="text-xs font-bold text-slate-700">Cantidad</span>
                <div className="flex items-center gap-3 bg-white border-slate-200 rounded-xl p-1">
                  <button type="button" onClick={() => setCustomizingQuantity((value) => Math.max(1, value - 1))} className="w-7 h-7 rounded-lg font-bold text-slate-700 hover:bg-rose-100">-</button>
                  <span className="w-5 text-center text-sm font-extrabold text-slate-900">{customizingQuantity}</span>
                  <button type="button" onClick={() => setCustomizingQuantity((value) => value + 1)} className="w-7 h-7 rounded-lg font-bold text-slate-700 hover:bg-emerald-100">+</button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Descripción / indicaciones</label>
                <input type="text" value={customizingNotes} onChange={(event) => setCustomizingNotes(event.target.value)} placeholder="Ej: sin cebolla, poco picante..." className="w-full px-3 py-2.5 bg-slate-50 border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500" />
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Cremas</div>
                <div className="flex flex-wrap gap-1.5">
                  {CREMAS_DISPONIBLES.map((crema) => (
                    <button key={crema} type="button" onClick={() => toggleCustomizationCrema(crema)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition ${customizingCremas.includes(crema) ? "bg-amber-500 text-slate-950 border-amber-500" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
                      {crema}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Agregados</div>
                <div className="flex flex-wrap gap-1.5">
                  {AGREGADOS_DISPONIBLES.map((agregado) => (
                    <button key={agregado.nombre} type="button" onClick={() => toggleCustomizationAgregado(agregado.nombre)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition ${customizingAgregados.includes(agregado.nombre) ? "bg-blue-500 text-white border-blue-500" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
                      {agregado.nombre} +S/{agregado.precio.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setCustomizingProduct(null)} className="py-3 bg-white border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs transition">Cancelar</button>
                <button type="button" onClick={handleConfirmCustomization} className="py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl text-xs shadow-md transition">Agregar a la tanda</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
