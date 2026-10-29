import { useState, useEffect, useRef } from "react";
import { usePosStore, type Mesa, type Producto, type Order, type OrderItem } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import { useMenuCategories, getCategoriaNombre, labelCategoria, permitePersonalizacion } from "../lib/menuCategories";
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
  Search,
  GitMerge,
  Pencil,
  Printer,
  AlertCircle,
  Loader2,
} from "lucide-react";

const AGREGADOS_DISPONIBLES = [
  { nombre: "Queso Amarillo", precio: 0.75 },
  { nombre: "Plátano Maduro", precio: 0.75 },
  { nombre: "Carne Mechada", precio: 1.50 },
  { nombre: "Pollo Desmechado", precio: 1.50 },
  { nombre: "Tocineta", precio: 1.00 },
  { nombre: "Chicharrón", precio: 1.00 },
];

type CartLine = { product: Producto; quantity: number; notes: string; agregados: string[] };

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
    preBillMesa,
    partialPaymentMesa,
    checkoutMesa,
    createMesa,
    updateMesa,
    deleteMesa,
    joinMesas,
    unjoinMesas,
    cajaEstado,
    fetchCajaEstado,
    currentUser,
  } = usePosStore();

  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied" | "billing">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableCapacity, setNewTableCapacity] = useState("4");
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [editTableNumber, setEditTableNumber] = useState("");
  const [editTableCapacity, setEditTableCapacity] = useState("");
  const [showJoinTables, setShowJoinTables] = useState(false);
  const [joinTableIds, setJoinTableIds] = useState<string[]>([]);
  const [mainJoinTableId, setMainJoinTableId] = useState<string | null>(null);

  const { tabs: CATEGORIES, activeCategory: selectedCategory, setSelectedCategory } = useMenuCategories(productos);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customizingProduct, setCustomizingProduct] = useState<Producto | null>(null);
  const [customizingQuantity, setCustomizingQuantity] = useState(1);
  const [customizingNotes, setCustomizingNotes] = useState("");
  const [customizingAgregados, setCustomizingAgregados] = useState<string[]>([]);
  const showInlineCustomization = false;
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "Yape/Plin" | "Mixto">("Efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoDigital, setMontoDigital] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [kitchenOrder, setKitchenOrder] = useState<Order | null>(null);
  // Ronda (tanda) a imprimir en la boletera de cocina. La mesa es acumulativa:
  // cuando se envía una tanda nueva, cocina debe recibir SOLO esa tanda, no toda
  // la cuenta (eso lo imprime la pre-cuenta). Aquí se guarda el número de ronda
  // del último envío para que el ticket muestre únicamente esos ítems.
  const [kitchenRonda, setKitchenRonda] = useState<number | null>(null);
  const [checkoutIsPartial, setCheckoutIsPartial] = useState(false);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState("");
  const [isSubmittingTanda, setIsSubmittingTanda] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  useEffect(() => {
    fetchMesas();
    fetchCajaEstado();
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
        agregados: customizingAgregados,
      },
    }));
    setCustomizingProduct(null);
  };

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
    if (!selectedMesa || isSubmittingTanda) return;
    if (!cajaEstado?.isOpen) {
      alert("La caja está cerrada. Debes abrir un turno de caja en Pagos antes de atender mesas o mandar pedidos.");
      return;
    }
    const cartList = Object.values(cart);
    if (cartList.length === 0) {
      alert("Agrega al menos un producto para enviar a cocina.");
      return;
    }

    setIsSubmittingTanda(true);
    try {
      const targetMesaId = selectedMesa.id;
      if (selectedMesa.status === "AVAILABLE") {
        const opened = await openMesa(targetMesaId);
        if (!opened) return; // openMesa ya muestra la alerta si falla
      }

      const items: OrderItem[] = cartList.map((item) => {
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
          extras: extrasFromAgregados,
        };
      });

      const result = await addItemsToMesa(targetMesaId, items);
      if (result) {
        setCart({});
        // Boletera de cocina automática: al enviar la tanda se abre el ticket con
        // únicamente los ítems de ESTA ronda (la nueva), no toda la mesa.
        const nuevaRonda = Math.max(0, ...result.currentOrder?.items.map((i) => i.ronda ?? 1) ?? [0]) || 1;
        setKitchenOrder(result.currentOrder);
        setKitchenRonda(nuevaRonda);
      }
    } finally {
      setIsSubmittingTanda(false);
    }
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
    if (!cajaEstado?.isOpen) {
      alert("La caja está cerrada. Debes abrir un turno de caja en Pagos antes de registrar cobros.");
      return;
    }
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
    if (!selectedMesa || isSubmittingCheckout) return;
    if (!cajaEstado?.isOpen) {
      alert("La caja está cerrada. Debes abrir un turno de caja en Pagos antes de registrar cobros.");
      return;
    }
    setIsSubmittingCheckout(true);
    try {
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
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handlePrintPreBill = async () => {
    if (!selectedMesa?.currentOrder) return;
    const mesa = await preBillMesa(selectedMesa.id);
    if (!mesa?.currentOrder) return;
    setReceiptOrder({
      ...mesa.currentOrder,
      type: "Mesa",
      tableId: mesa.id,
      table: { number: mesa.number },
    });
  };

  const statusMeta: Record<Mesa["status"], { label: string; card: string; badge: string }> = {
    AVAILABLE: { label: "Libre", card: "bg-emerald-50 hover:bg-emerald-100", badge: "bg-emerald-500 text-white" },
    OCCUPIED: { label: "Ocupada", card: "bg-amber-50 hover:bg-amber-100", badge: "bg-amber-500 text-slate-950" },
    BILLING: { label: "Pidiendo Cuenta", card: "bg-blue-50 hover:bg-blue-100", badge: "bg-blue-500 text-white" },
  };

  const counts = {
    libres: mesas.filter((m) => !m.joinedToId && m.status === "AVAILABLE").length,
    ocupadas: mesas.filter((m) => !m.joinedToId && m.status === "OCCUPIED").length,
    cobrando: mesas.filter((m) => !m.joinedToId && m.status === "BILLING").length,
  };

  const visibleMesas = mesas
    .filter((mesa) => !mesa.joinedToId)
    .filter((mesa) => {
      const isAvailable = mesa.status === "AVAILABLE";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && isAvailable) ||
        (statusFilter === "occupied" && mesa.status === "OCCUPIED") ||
        (statusFilter === "billing" && mesa.status === "BILLING");
      const searchableNumbers = [mesa.number, ...(mesa.joinedTables || []).map((table) => table.number)];
      const normalizedSearch = searchQuery.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableNumbers.some((number) => `mesa ${number}`.includes(normalizedSearch) || String(number).includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });

  const availableTables = mesas.filter(
    (mesa) => !mesa.joinedToId && mesa.status === "AVAILABLE",
  );

  const handleCreateTable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const capacity = Number(newTableCapacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      alert("Ingresa una cantidad entera de sillas mayor que cero.");
      return;
    }
    const mesa = await createMesa(capacity);
    if (mesa) {
      setShowCreateTable(false);
      setNewTableCapacity("4");
    }
  };

  const handleEditTable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMesa) return;
    const number = Number(editTableNumber);
    const capacity = Number(editTableCapacity);
    if (!Number.isInteger(number) || number < 1 || !Number.isInteger(capacity) || capacity < 1) {
      alert("El número de mesa y la cantidad de sillas deben ser enteros mayores que cero.");
      return;
    }
    const updated = await updateMesa(editingMesa.id, { number, capacity });
    if (updated) setEditingMesa(null);
  };

  const handleDeleteTable = async (mesa: Mesa) => {
    if (mesa.status !== "AVAILABLE" || mesa.joinedToId || mesa.joinedTables?.length) {
      alert("Solo puedes eliminar una mesa disponible y separada de cualquier grupo.");
      return;
    }
    const confirmed = window.confirm(
      `¿Eliminar la Mesa ${mesa.number}? Los pedidos históricos se conservarán sin vincular a esa mesa.`,
    );
    if (!confirmed) return;
    if (await deleteMesa(mesa.id) && selectedMesaId === mesa.id) {
      setSelectedMesaId(null);
    }
  };

  const handleJoinTables = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mainJoinTableId || joinTableIds.length < 2) return;
    const mesa = await joinMesas(
      mainJoinTableId,
      joinTableIds.filter((id) => id !== mainJoinTableId),
    );
    if (mesa) {
      setShowJoinTables(false);
      setJoinTableIds([]);
      setMainJoinTableId(null);
    }
  };

  const handleUnjoinMesas = async (tableId: string) => {
    if (!window.confirm("¿Deseas desagrupar las mesas? Volverán a estar disponibles por separado.")) {
      return;
    }
    const ok = await unjoinMesas(tableId);
    if (ok) {
      if (selectedMesaId === tableId) {
        setSelectedMesaId(null);
        setCart({});
      }
    }
  };

  const toggleJoinTable = (tableId: string) => {
    if (joinTableIds.includes(tableId)) {
      const remaining = joinTableIds.filter((id) => id !== tableId);
      setJoinTableIds(remaining);
      if (mainJoinTableId === tableId) setMainJoinTableId(remaining[0] ?? null);
      return;
    }
    setJoinTableIds([...joinTableIds, tableId]);
    if (!mainJoinTableId) setMainJoinTableId(tableId);
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
    <div className="space-y-6 sm:space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Salón / Mesas</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Atención acumulativa por mesa: abre, agrega tandas y cobra al final.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {counts.libres} Libres
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {counts.ocupadas} Ocupadas
            </span>
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {counts.cobrando} En Cobro
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => {
                setJoinTableIds([]);
                setMainJoinTableId(null);
                setShowJoinTables(true);
              }}
              disabled={availableTables.length < 2}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition"
            >
              <GitMerge className="w-3.5 h-3.5" /> Unir mesas
            </button>
            {currentUser?.role === "jefe" && (
              <button
                type="button"
                onClick={() => setShowCreateTable(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva mesa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de caja cerrada */}
      {!cajaEstado?.isOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 text-amber-950 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Caja cerrada actualmente: No se pueden abrir mesas, mandar pedidos a cocina ni cobrar hasta abrir la caja en el módulo de Pagos.
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por número de mesa..."
            className="w-full pl-10 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none flex-nowrap shrink-0">
          {([
            ["all", "Todas"],
            ["available", "Disponibles"],
            ["occupied", "Ocupadas"],
            ["billing", "En Cobro"],
          ] as const).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              aria-pressed={statusFilter === filter}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                statusFilter === filter
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de mesas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {visibleMesas.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm font-medium bg-white rounded-3xl border border-slate-200/80">
            {mesas.length === 0
              ? "No hay mesas configuradas todavía."
              : "No hay mesas que coincidan con la búsqueda o el filtro."}
          </div>
        ) : (
          visibleMesas.map((mesa) => {
            const meta = statusMeta[mesa.status];
            const mesaPaid = (mesa.currentOrder?.pagos || []).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
            const mesaRemaining = Math.max(0, (mesa.currentOrder?.total || 0) - mesaPaid);
            const mesaLabel = mesaPaid > 0 ? "Pagada" : meta.label;
            const joinedTables = mesa.joinedTables || [];
            const totalCapacity = mesa.capacity + joinedTables.reduce((sum, table) => sum + table.capacity, 0);
            return (
              <div
                key={mesa.id}
                className={`relative overflow-hidden rounded-2xl transition shadow-sm hover:shadow-md ${meta.card}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedMesaId(mesa.id)}
                  className="relative w-full p-4 text-left"
                >
                  <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${meta.badge}`}>
                    {mesaLabel}
                  </div>
                  <img src="/mesa.svg" alt="" className="w-8 h-8 opacity-80" />
                  <div className="text-3xl font-black text-slate-900 mt-1">
                    {joinedTables.length > 0
                      ? [mesa.number, ...joinedTables.map((table) => table.number)].sort((a, b) => a - b).map((number) => `#${number}`).join(" + ")
                      : `#${mesa.number}`}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold mt-1">
                    <Users className="w-3.5 h-3.5" /> {totalCapacity} sillas
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
                {joinedTables.length > 0 && (
                  <div className="px-3 pb-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUnjoinMesas(mesa.id);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 py-1.5 text-xs font-bold border border-rose-200 transition"
                      title="Desagrupar estas mesas"
                    >
                      <GitMerge className="w-3.5 h-3.5 rotate-180" /> Desagrupar mesas
                    </button>
                  </div>
                )}
                {currentUser?.role === "jefe" && (
                  <div className="flex gap-2 px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMesa(mesa);
                        setEditTableNumber(String(mesa.number));
                        setEditTableCapacity(String(mesa.capacity));
                      }}
                      disabled={mesa.status !== "AVAILABLE" || Boolean(mesa.joinedToId) || Boolean(mesa.joinedTables?.length)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/80 py-2 text-xs font-bold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTable(mesa)}
                      disabled={mesa.status !== "AVAILABLE" || Boolean(mesa.joinedToId) || Boolean(mesa.joinedTables?.length)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/80 py-2 text-xs font-bold text-rose-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                )}
              </div>
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
                    {selectedMesa.joinedTables?.length
                      ? `Mesas ${[selectedMesa.number, ...selectedMesa.joinedTables.map((table) => table.number)].sort((a, b) => a - b).join(" + ")}`
                      : `Mesa ${selectedMesa.number}`}
                    {selectedMesa.currentOrder?.customer ? ` · ${selectedMesa.currentOrder.customer}` : ""}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedMesa.joinedTables?.length
                      ? `${selectedMesa.capacity + selectedMesa.joinedTables.reduce((sum, table) => sum + table.capacity, 0)} sillas · Cuenta compartida`
                      : selectedMesa.currentOrder
                        ? `Atendedor: ${selectedMesa.currentOrder.user?.name || currentUser?.name || "—"} · Abierta hace ${formatElapsed(selectedMesa.currentOrder.createdAt)}`
                        : "Mesa libre — agrega productos para abrir la cuenta"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {Boolean(selectedMesa.joinedTables?.length) && (
                  <button
                    type="button"
                    onClick={() => void handleUnjoinMesas(selectedMesa.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5"
                    title="Desagrupar y separar estas mesas"
                  >
                    <GitMerge className="w-3.5 h-3.5 rotate-180" /> Desagrupar Mesas
                  </button>
                )}
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
                        {labelCategoria(cat)}
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

                          {showInlineCustomization && permitePersonalizacion(getCategoriaNombre(item.product)) && (
                            <>
                              <textarea
                                rows={4}
                                value={item.notes}
                                onChange={(e) => handleUpdateCartNotes(lineId, e.target.value)}
                                placeholder="Ej: sin cebolla, con mayonesa, ketchup y queso cheddar..."
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-900 focus:outline-none focus:border-amber-500 placeholder:text-slate-400 resize-y"
                              />
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
                      disabled={!cajaEstado?.isOpen || isSubmittingTanda}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                      title={!cajaEstado?.isOpen ? "La caja está cerrada. Abre la caja en Pagos." : undefined}
                    >
                      {isSubmittingTanda ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Enviando tanda a cocina...</span>
                        </>
                      ) : (
                        <>
                          <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                          {!cajaEstado?.isOpen ? "Caja Cerrada (Abrir turno)" : `Enviar Tanda a Cocina (S/ ${calculateCartTotal().toFixed(2)})`}
                        </>
                      )}
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
                        onClick={() => {
                          if (!selectedMesa.currentOrder) return;
                          // Impresión manual: se manda la ÚLTIMA tanda enviada
                          // (la más reciente), que es la que cocina está esperando.
                          const ultimaRonda = Math.max(
                            0,
                            ...selectedMesa.currentOrder.items.map((i) => i.ronda ?? 1)
                          );
                          setKitchenRonda(ultimaRonda || null);
                          setKitchenOrder({
                            ...selectedMesa.currentOrder,
                            type: "Mesa",
                            tableId: selectedMesa.id,
                            table: { number: selectedMesa.number },
                          });
                        }}
                        disabled={!selectedMesa.currentOrder?.items.length}
                        className="py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        🔥 Comanda Cocina
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintPreBill}
                        disabled={!cajaEstado?.isOpen || !selectedMesa.currentOrder?.items.length}
                        className="col-span-2 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Printer className="w-4 h-4" /> Imprimir Pre-Cuenta
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPartialPayment}
                        disabled={!cajaEstado?.isOpen || !selectedMesa.currentOrder?.items.length || remainingAmount <= 0}
                        className="col-span-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs shadow-md shadow-blue-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CircleDollarSign className="w-4 h-4" /> Registrar Pago Parcial
                      </button>
                      {!selectedMesa.currentOrder?.items?.length ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`¿Liberar Mesa ${selectedMesa.number} sin consumo? La mesa quedará disponible para nuevos clientes.`)) return;
                            await checkoutMesa(selectedMesa.id, "Efectivo");
                            setSelectedMesaId(null);
                          }}
                          disabled={!cajaEstado?.isOpen || isSubmittingCheckout}
                          className="col-span-2 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs shadow-md shadow-rose-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                        >
                          {isSubmittingCheckout ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Liberando mesa...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span>Liberar Mesa (Sin consumo)</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setCheckoutIsPartial(false); setPartialPaymentAmount(""); setShowCheckout(true); }}
                          disabled={!cajaEstado?.isOpen}
                          className="col-span-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                        >
                          <CircleDollarSign className="w-4 h-4" /> {!cajaEstado?.isOpen ? "Caja Cerrada (Abre caja)" : remainingAmount <= 0 ? "Cerrar Mesa" : "Cobrar y Cerrar Mesa"}
                        </button>
                      )}
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
                          disabled={isSubmittingCheckout}
                          className="py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                        >
                          {isSubmittingCheckout ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Procesando...</span>
                            </>
                          ) : checkoutIsPartial
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Descripción / indicaciones (incluye las cremas aquí)</label>
                <textarea rows={4} value={customizingNotes} onChange={(event) => setCustomizingNotes(event.target.value)} placeholder="Ej: sin cebolla, con mayonesa, ketchup y queso cheddar..." className="w-full px-3 py-3 bg-slate-50 border-slate-200 rounded-xl text-base font-medium text-slate-900 focus:outline-none focus:border-amber-500 resize-y" />
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

      {showCreateTable && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTable}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Agregar mesa</h2>
                <p className="text-sm text-slate-500 mt-1">Se asignará el siguiente número disponible.</p>
              </div>
              <button type="button" onClick={() => setShowCreateTable(false)} className="p-2 rounded-xl hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block">
              <span className="block text-xs font-bold text-slate-600 mb-1.5">Cantidad de sillas</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={newTableCapacity}
                onChange={(event) => setNewTableCapacity(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowCreateTable(false)} className="py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">
                Cancelar
              </button>
              <button type="submit" className="py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-extrabold">
                Crear mesa
              </button>
            </div>
          </form>
        </div>
      )}

      {editingMesa && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleEditTable}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Editar Mesa {editingMesa.number}</h2>
                <p className="text-sm text-slate-500 mt-1">Solo se pueden editar mesas libres y separadas.</p>
              </div>
              <button type="button" onClick={() => setEditingMesa(null)} className="p-2 rounded-xl hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block">
              <span className="block text-xs font-bold text-slate-600 mb-1.5">Número de mesa</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={editTableNumber}
                onChange={(event) => setEditTableNumber(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-slate-600 mb-1.5">Cantidad de sillas</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={editTableCapacity}
                onChange={(event) => setEditTableCapacity(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditingMesa(null)} className="py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">
                Cancelar
              </button>
              <button type="submit" className="py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-extrabold">
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {showJoinTables && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleJoinTables}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Unir mesas disponibles</h2>
                <p className="text-sm text-slate-500 mt-1">Compartirán una cuenta. Al cobrar, volverán a separarse.</p>
              </div>
              <button type="button" onClick={() => setShowJoinTables(false)} className="p-2 rounded-xl hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {availableTables.map((mesa) => {
                const isSelected = joinTableIds.includes(mesa.id);
                const isMain = mainJoinTableId === mesa.id;
                const capacity = mesa.capacity + (mesa.joinedTables || []).reduce((sum, table) => sum + table.capacity, 0);
                const label = [mesa.number, ...(mesa.joinedTables || []).map((table) => table.number)]
                  .sort((a, b) => a - b)
                  .map((number) => `Mesa ${number}`)
                  .join(" + ");
                return (
                  <div key={mesa.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isSelected ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleJoinTable(mesa.id)}
                      aria-label={`Seleccionar ${label}`}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="flex-1 text-sm font-bold text-slate-800">{label} · {capacity} sillas</span>
                    {isSelected && (
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <input
                          type="radio"
                          name="mainTable"
                          checked={isMain}
                          onChange={() => setMainJoinTableId(mesa.id)}
                          className="accent-amber-500"
                        />
                        Principal
                      </label>
                    )}
                  </div>
                );
              })}
              {availableTables.length < 2 && (
                <p className="text-sm text-slate-500 text-center py-5">Necesitas al menos dos mesas disponibles.</p>
              )}
            </div>

            {joinTableIds.length >= 2 && (
              <p className="text-xs text-slate-500">
                Capacidad total: {availableTables
                  .filter((mesa) => joinTableIds.includes(mesa.id))
                  .reduce((sum, mesa) => sum + mesa.capacity + (mesa.joinedTables || []).reduce((groupSum, table) => groupSum + table.capacity, 0), 0)} sillas.
                La mesa marcada como principal recibirá la cuenta.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowJoinTables(false)} className="py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={joinTableIds.length < 2 || !mainJoinTableId}
                className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-extrabold"
              >
                Unir mesas
              </button>
            </div>
          </form>
        </div>
      )}

      {receiptOrder && (
        <TicketReceiptModal
          order={receiptOrder}
          mode="precuenta"
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* BOLETERA DE COCINA: ticket sin precios, solo el detalle del pedido */}
      {kitchenOrder && (
        <TicketReceiptModal
          order={kitchenOrder}
          mode="comanda"
          mesaNumero={selectedMesa?.number ?? null}
          soloRonda={kitchenRonda}
          onClose={() => {
            setKitchenOrder(null);
            setKitchenRonda(null);
          }}
        />
      )}

    </div>
  );
}
