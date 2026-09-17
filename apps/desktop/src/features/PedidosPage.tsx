import { useState, useRef, useEffect } from "react";
import { usePosStore, type Order, type Producto } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import OrderDetailModal from "../components/OrderDetailModal";
import {
  ShoppingBag,
  PlusCircle,
  Search,
  Flame,
  PackageCheck,
  CheckCircle2,
  XCircle,
  X,
  Plus,
  User,
  ShoppingBasket,
  ChevronLeft,
  ChevronRight,
  Printer,
  ClipboardList,
  Ban
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

// Solo estas categorías permiten notas, cremas y agregados extra.
const CATEGORIAS_CON_PERSONALIZACION = [
  "Arepas Tradicionales",
  "Empanadas",
  "Cachapas",
  "Patacones",
  "Comida Rápida",
  "Horneados",
  "Especiales de Fin de Semana",
];

const getCategoriaNombre = (prod: Producto): string => {
  const catObj = prod.categoria as any;
  return typeof catObj === "object" && catObj !== null ? catObj.nombre : String(catObj || "");
};

export default function PedidosPage() {
  const { pedidos, productos, insumos, addOrder, updateOrderStatus, fetchInsumos } = usePosStore();

  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"hoy" | "semana" | "mes" | "custom">("hoy");
  const [customDate, setCustomDate] = useState<string>("");

  // New Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"Llevar" | "Delivery">("Llevar");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "Yape/Plin" | "Mixto">("Yape/Plin");
  const [montoEfectivo, setMontoEfectivo] = useState<string>("");
  const [montoDigital, setMontoDigital] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Arepas Tradicionales");
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);

  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Carga la lista de insumos (necesaria para mapear nombre de crema/agregado -> insumoId real)
  useEffect(() => {
    if (insumos.length === 0) {
      fetchInsumos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollCategories = (direction: "left" | "right") => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === "left" ? -180 : 180;
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (categoryScrollRef.current && e.deltaY !== 0) {
      categoryScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Busca el ID real del insumo por nombre (para mandar el "extra" correctamente al backend)
  const findInsumoId = (nombre: string): string | null => {
    const found = insumos.find(
      (i) => i.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    );
    return found ? found.id : null;
  };

  // Cart items inside Modal: lineId (no el sku, para permitir 2 líneas del mismo producto
  // con personalización distinta) -> { product, quantity, notes, cremas, agregados }
  const [cart, setCart] = useState<
    Record<string, { product: Producto; quantity: number; notes: string; cremas: string[]; agregados: string[] }>
  >({});

  // `value` filtra contra la categoría real en BD ("Agregados", igual que el seed);
  // `label` es lo que ve el usuario. Se renombra a "Porciones Extras" en la UI para no
  // confundirse con los agregados/modificadores por plato (checkboxes dentro de cada línea).
  const categories = [
    { value: "Arepas Tradicionales", label: "Arepas" },
    { value: "Empanadas", label: "Empanadas" },
    { value: "Cachapas", label: "Cachapas" },
    { value: "Patacones", label: "Patacones" },
    { value: "Comida Rápida", label: "Comida Rápida" },
    { value: "Horneados", label: "Horneados" },
    { value: "Especiales de Fin de Semana", label: "Fin de Semana" },
    { value: "Agregados", label: "Porciones Extras" },
  ];

  // Agrega una unidad más a una línea EXISTENTE del mismo producto solo si esa línea
  // todavía no tiene personalización (recién agregada, sin cremas/agregados/notas).
  // Si todas las líneas de ese producto ya están personalizadas, abre una línea nueva
  // en vez de heredar cremas/agregados que pertenecen a otra unidad distinta.
  const handleAddToCart = (prod: Producto) => {
    setCart((prev) => {
      const emptyLineId = Object.keys(prev).find((lineId) => {
        const item = prev[lineId];
        return (
          item.product.sku === prod.sku &&
          item.cremas.length === 0 &&
          item.agregados.length === 0 &&
          !item.notes.trim()
        );
      });

      if (emptyLineId) {
        return {
          ...prev,
          [emptyLineId]: { ...prev[emptyLineId], quantity: prev[emptyLineId].quantity + 1 },
        };
      }

      const newLineId = `${prod.sku}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        ...prev,
        [newLineId]: { product: prod, quantity: 1, notes: "", cremas: [], agregados: [] },
      };
    });
  };

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
      return {
        ...prev,
        [lineId]: { ...item, quantity: newQty },
      };
    });
  };

  const handleUpdateCartNotes = (lineId: string, notes: string) => {
    setCart((prev) => {
      const item = prev[lineId];
      if (!item) return prev;
      return {
        ...prev,
        [lineId]: { ...item, notes },
      };
    });
  };

  const handleToggleCrema = (lineId: string, crema: string) => {
    setCart((prev) => {
      const item = prev[lineId];
      if (!item) return prev;
      const yaTiene = item.cremas.includes(crema);
      const nuevasCremas = yaTiene
        ? item.cremas.filter((c) => c !== crema)
        : [...item.cremas, crema];
      return {
        ...prev,
        [lineId]: { ...item, cremas: nuevasCremas },
      };
    });
  };

  const handleToggleAgregado = (lineId: string, agregado: string) => {
    setCart((prev) => {
      const item = prev[lineId];
      if (!item) return prev;
      const yaTiene = item.agregados.includes(agregado);
      const nuevosAgregados = yaTiene
        ? item.agregados.filter((a) => a !== agregado)
        : [...item.agregados, agregado];
      return {
        ...prev,
        [lineId]: { ...item, agregados: nuevosAgregados },
      };
    });
  };

  // Suma el precio de los agregados seleccionados de un item (por unidad) — solo para mostrar en el carrito
  const getAgregadosUnitPrice = (agregados: string[]) => {
    return agregados.reduce((sum, nombre) => {
      const found = AGREGADOS_DISPONIBLES.find((a) => a.nombre === nombre);
      return sum + (found ? found.precio : 0);
    }, 0);
  };

  const getCartItemTotal = (item: { product: Producto; quantity: number; agregados: string[] }) => {
    const unitPrice = item.product.precio + getAgregadosUnitPrice(item.agregados);
    return unitPrice * item.quantity;
  };

  const calculateCartTotal = () => {
    return Object.values(cart).reduce((acc, curr) => acc + getCartItemTotal(curr), 0);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cartList = Object.values(cart);
    if (cartList.length === 0) {
      alert("Por favor selecciona al menos un producto para la comanda.");
      return;
    }

    const orderNum = pedidos.length + 1049;
    const now = new Date();
    const fechaStr = now.toISOString().split("T")[0];
    const horaStr = now.toTimeString().split(" ")[0].substring(0, 5);

    const totalAmount = calculateCartTotal();
    const numEf = parseFloat(montoEfectivo) || 0;
    const numDig = parseFloat(montoDigital) || 0;

    const newOrder: Order = {
      id: String(Date.now()),
      code: `#ORD-${orderNum}`,
      customer: customerName.trim() || "Cliente Mostrador",
      items: cartList.map((item) => {
        // Convierte las cremas seleccionadas en "extras" con precio 0 (requiere insumoId real)
        const extrasFromCremas = item.cremas
          .map((cremaName) => {
            const insumoId = findInsumoId(cremaName);
            return insumoId ? { insumoId, cantidad: 1, precioExtra: 0 } : null;
          })
          .filter((e): e is { insumoId: string; cantidad: number; precioExtra: number } => e !== null);

        // Convierte los agregados seleccionados en "extras" con su precio real
        const extrasFromAgregados = item.agregados
          .map((agregadoName) => {
            const insumoId = findInsumoId(agregadoName);
            const found = AGREGADOS_DISPONIBLES.find((a) => a.nombre === agregadoName);
            return insumoId
              ? { insumoId, cantidad: 1, precioExtra: found ? found.precio : 0 }
              : null;
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
      }),
      total: totalAmount,
      type: orderType,
      paymentMethod,
      montoEfectivo: paymentMethod === "Mixto" ? numEf : undefined,
      montoDigital: paymentMethod === "Mixto" ? numDig : undefined,
      status: "preparacion",
      fecha: fechaStr,
      hora: horaStr,
    };

    await addOrder(newOrder);
    setIsModalOpen(false);
    setCart({});
    setCustomerName("");
    setMontoEfectivo("");
    setMontoDigital("");

    // Usa el pedido tal como lo devolvió el backend (ya con insumo.nombre resuelto
    // para cada crema/agregado), no el objeto local: ese solo tenía el insumoId,
    // así que la boleta mostraba "Crema/Aderezo" genérico en vez del nombre real.
    const createdOrder = usePosStore.getState().pedidos.find((o) => o.code === newOrder.code) || newOrder;
    setSelectedPrintOrder(createdOrder);
  };

  const handleCancelOrder = (order: Order) => {
    const confirmar = window.confirm(
      `¿Seguro que deseas cancelar el pedido ${order.code}? Esta acción no se puede deshacer.`
    );
    if (confirmar) {
      updateOrderStatus(order.id, "cancelado");
    }
  };

  // Formatea una fecha a YYYY-MM-DD usando componentes LOCALES (no UTC) para evitar el desfase horario
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const getDateRange = () => {
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    if (dateFilter === "hoy") {
      return { start: todayStr, end: todayStr };
    }
    if (dateFilter === "semana") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { start: toLocalDateStr(start), end: todayStr };
    }
    if (dateFilter === "mes") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toLocalDateStr(start), end: todayStr };
    }
    if (dateFilter === "custom" && customDate) {
      return { start: customDate, end: customDate };
    }
    return { start: todayStr, end: todayStr };
  };

  const range = getDateRange();
  const dateFilteredOrders = pedidos.filter(
    (order) => order.fecha >= range.start && order.fecha <= range.end
  );

  const filteredOrders = dateFilteredOrders
    .filter((order) => {
      const matchesFilter = orderFilter === "all" || order.status === orderFilter;
      const matchesSearch =
        order.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      const dateTimeA = `${a.fecha} ${a.hora}`;
      const dateTimeB = `${b.fecha} ${b.hora}`;
      return dateTimeB.localeCompare(dateTimeA);
    });

  const getStatusBadge = (order: Order) => {
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
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Entregado
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

  const prepCount = dateFilteredOrders.filter((o) => o.status === "preparacion").length;
  const readyCount = dateFilteredOrders.filter((o) => o.status === "listo").length;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Comanda de Pedidos</h1>
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" />
              {pedidos.length} Pedidos Registrados
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Control de comanda en vivo, avance de estados y deducción automática de inventario (BOM).
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-3 rounded-2xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Nuevo Pedido POS
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Hoy</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{dateFilteredOrders.length}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">En Cocina</span>
            <div className="text-2xl font-extrabold text-blue-600 mt-0.5">{prepCount}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Listos / Para Entregar</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-0.5">{readyCount}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 text-xs font-semibold overflow-x-auto">
            {[
              { key: "all", label: "Todos" },
              { key: "preparacion", label: `En Cocina (${prepCount})` },
              { key: "listo", label: `Listos (${readyCount})` },
              { key: "entregado", label: "Entregados" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOrderFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap ${
                  orderFilter === tab.key
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar comanda o cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {[
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Esta Semana" },
            { key: "mes", label: "Este Mes" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setDateFilter(f.key as "hoy" | "semana" | "mes");
                setCustomDate("");
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition border ${
                dateFilter === f.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}

          <div className="flex items-center gap-1">
            <input
              id="custom-date-input"
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter(e.target.value ? "custom" : "hoy");
              }}
              onClick={(e) => {
                (e.target as HTMLInputElement).showPicker?.();
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                dateFilter === "custom"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-4">N° Pedido</th>
                <th className="py-4 px-4">Cliente</th>
                <th className="py-4 px-4">Detalle de Productos</th>
                <th className="py-4 px-4">Tipo / Pago</th>
                <th className="py-4 px-4">Total (S/.)</th>
                <th className="py-4 px-4 text-center">Estado / Avance Comanda</th>
                <th className="py-4 px-4 text-center">Fecha</th>
                <th className="py-4 px-4 text-center">Hora</th>
                <th className="py-4 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                    No se encontraron pedidos en la categoría seleccionada.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const itemsSummary = order.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-extrabold text-slate-900 text-sm">
                        {order.code}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">
                        {order.customer}
                      </td>
                      <td className="py-4 px-4 max-w-sm">
                        <div className="font-semibold text-slate-800 truncate">{itemsSummary}</div>
                        <div className="text-[11px] text-slate-400">{order.items.length} items seleccionados</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md font-semibold text-[11px] text-slate-700">
                            {order.paymentMethod}
                          </span>
                          <span className="text-slate-400">• {order.type}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-extrabold text-slate-900 text-sm">
                        S/ {order.total.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {getStatusBadge(order)}
                      </td>
                      <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {order.fecha}
                      </td>
                      <td className="py-4 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {order.hora}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {order.status !== "entregado" && order.status !== "cancelado" && (
                            <button
                              onClick={() => handleCancelOrder(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 font-bold text-[11px] transition shadow-sm"
                              title="Cancelar Pedido"
                            >
                              <Ban className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedDetailOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition shadow-sm"
                            title="Ver Detalle del Pedido"
                          >
                            <ClipboardList className="w-3.5 h-3.5" /> Detalle
                          </button>
                          <button
                            onClick={() => setSelectedPrintOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-bold text-[11px] transition shadow-sm"
                            title="Imprimir Boleta POS"
                          >
                            <Printer className="w-3.5 h-3.5" /> Boleta
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
      </div>

      {/* NEW ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Crear Nueva Comanda POS</h3>
                  <p className="text-xs text-slate-400">Selecciona productos de la carta e ingresa los datos del cliente</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 flex-1 overflow-hidden">
              <div className="md:col-span-3 p-6 space-y-4 overflow-y-auto border-r border-slate-100">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Nombre del Cliente</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Tipo de Servicio</label>
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as "Llevar" | "Delivery")}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Llevar">Para Llevar</option>
                      <option value="Delivery">Delivery</option>
                    </select>
                  </div>
                </div>

                <div className="relative flex items-center group py-1">
                  <button
                    type="button"
                    onClick={() => scrollCategories("left")}
                    className="absolute left-0 z-10 p-1.5 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 hover:bg-amber-500 hover:text-slate-950 transition opacity-80 hover:opacity-100 backdrop-blur-md"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div
                    ref={categoryScrollRef}
                    onWheel={handleCategoryWheel}
                    className="flex gap-2 overflow-x-auto px-7 py-1.5 scrollbar-none scroll-smooth w-full"
                  >
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`px-3.5 py-1.5 rounded-2xl text-[11px] font-extrabold transition-all duration-200 whitespace-nowrap border shrink-0 ${
                          selectedCategory === cat.value
                            ? "bg-slate-900 text-amber-400 border-slate-900 shadow-md shadow-slate-900/20 scale-105"
                            : "bg-slate-100 text-slate-600 border-slate-200/80 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollCategories("right")}
                    className="absolute right-0 z-10 p-1.5 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 hover:bg-amber-500 hover:text-slate-950 transition opacity-80 hover:opacity-100 backdrop-blur-md"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              <div className="grid grid-cols-2 gap-3">
                {productos
                  .filter((p) => {
                    const catObj = p.categoria as any;
                    const catName =
                      typeof catObj === "object" && catObj !== null
                        ? catObj.nombre
                        : String(catObj || "");

                    return catName === selectedCategory && p.isAvailable;
                  })
                  .map((prod) => {
                    const precioNum =
                      typeof prod.precio === "number"
                        ? prod.precio
                        : Number(prod.precio || 0);

                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddToCart(prod)}
                        className="p-3 bg-slate-50 hover:bg-amber-500/10 hover:border-amber-400 border border-slate-200/80 rounded-2xl text-left transition flex items-center justify-between group"
                      >
                        <div>
                          <span className="text-xl">{prod.iconoEmoji}</span>
                          <div className="font-bold text-slate-900 text-xs mt-1 group-hover:text-amber-700">
                            {prod.nombre}
                          </div>
                          <div className="text-[11px] font-extrabold text-slate-600 mt-0.5">
                            S/ {precioNum.toFixed(2)}
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-amber-500 group-hover:text-slate-950 group-hover:border-amber-500 transition">
                          <Plus className="w-4 h-4" />
                        </div>
                      </button>
                    );
                  })}
              </div>
              </div>

              <div className="md:col-span-2 p-6 bg-slate-50/50 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <ShoppingBasket className="w-4 h-4 text-amber-500" />
                      Resumen Comanda
                    </h4>
                    <span className="text-xs text-slate-500 font-semibold">
                      {Object.keys(cart).length} items
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {Object.keys(cart).length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs font-medium">
                        Selecciona ítems del menú a la izquierda.
                      </div>
                    ) : (
                      Object.entries(cart).map(([lineId, item]) => (
                        <div
                          key={lineId}
                          className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="overflow-hidden pr-2">
                              <div className="font-bold text-slate-900 text-xs truncate">
                                {item.product.nombre}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold">
                                S/ {getCartItemTotal(item).toFixed(2)}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 p-1 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(lineId, -1)}
                                className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center text-xs font-bold hover:bg-rose-100 hover:text-rose-600 transition"
                              >
                                -
                              </button>
                              <span className="text-xs font-extrabold px-1 text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(lineId, 1)}
                                className="w-5 h-5 rounded bg-white text-slate-700 flex items-center justify-center text-xs font-bold hover:bg-emerald-100 hover:text-emerald-600 transition"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {CATEGORIAS_CON_PERSONALIZACION.includes(getCategoriaNombre(item.product)) && (
                            <>
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => handleUpdateCartNotes(lineId, e.target.value)}
                                placeholder="Ej: sin cebolla, extra bien cocido..."
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-900 focus:outline-none focus:border-amber-500 placeholder:text-slate-400"
                              />

                              <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Cremas / Aderezos
                                </div>
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
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                                  Agregados
                                </div>
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
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Método de Pago</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { key: "Yape/Plin", label: "Yape/Plin" },
                          { key: "Efectivo", label: "Efectivo" },
                          { key: "Mixto", label: "🔀 Mixto" },
                        ] as { key: "Efectivo" | "Yape/Plin" | "Mixto"; label: string }[]
                      ).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setPaymentMethod(m.key)}
                          className={`py-2 rounded-xl text-[10px] font-bold transition border ${
                            paymentMethod === m.key
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {paymentMethod === "Mixto" && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 animate-in fade-in duration-200">
                        <div className="text-[11px] font-extrabold text-amber-900 flex items-center justify-between">
                          <span>Desglose de Pago Dividido:</span>
                          <span className="text-amber-700 font-mono font-bold">Total: S/ {calculateCartTotal().toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">En Yape / Plin (S/)</label>
                            <input
                              type="number"
                              step="0.50"
                              placeholder="Ej: 10.00"
                              value={montoDigital}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMontoDigital(val);
                                const num = parseFloat(val) || 0;
                                const tot = calculateCartTotal();
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
                              placeholder="Ej: 6.00"
                              value={montoEfectivo}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMontoEfectivo(val);
                                const num = parseFloat(val) || 0;
                                const tot = calculateCartTotal();
                                setMontoDigital(num <= tot ? (tot - num).toFixed(2) : "0");
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                    <span className="text-xs font-bold text-amber-900">Total a Pagar</span>
                    <span className="text-xl font-extrabold text-amber-900">
                      S/ {calculateCartTotal().toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
                  >
                    Confirmar Comanda & Enviar a Cocina
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPrintOrder && (
        <TicketReceiptModal
          order={selectedPrintOrder}
          onClose={() => setSelectedPrintOrder(null)}
        />
      )}

      {selectedDetailOrder && (
        <OrderDetailModal
          order={selectedDetailOrder}
          onClose={() => setSelectedDetailOrder(null)}
        />
      )}
    </div>
  );
}