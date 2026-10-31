import { useState, useRef, useEffect, useMemo } from "react";
import { usePosStore, type Order, type Producto } from "../store/usePosStore";
import TicketReceiptModal from "../components/TicketReceiptModal";
import CambioEfectivo from "../components/CambioEfectivo";
import OrderDetailModal from "../components/OrderDetailModal";
import { avisar } from "../components/AvisoFlotante";
import { esEstacionComandas } from "../lib/estacionComandas";
import { agregadosDisponibles, extrasDeAgregados, precioAgregados } from "../lib/agregados";
import { productoSinStock } from "../lib/stock";
import { useMenuCategories, getCategoriaNombre, labelCategoria, permitePersonalizacion } from "../lib/menuCategories";
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
  Ban,
  UtensilsCrossed,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";


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

type PedidosPageProps = {
  onGoToMesas: () => void;
};

export default function PedidosPage({ onGoToMesas }: PedidosPageProps) {
  const { pedidos, productos, insumos, agregados, mesas, addOrder, updateOrderStatus, fetchInsumos, cajaEstado, fetchCajaEstado } = usePosStore();

  useEffect(() => {
    fetchCajaEstado();
  }, [fetchCajaEstado]);

  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"hoy" | "semana" | "mes" | "custom">("hoy");
  const [customDate, setCustomDate] = useState<string>("");

  // New Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"Llevar" | "Delivery">("Llevar");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "Yape/Plin" | "Mixto">("Yape/Plin");
  const [montoEfectivo, setMontoEfectivo] = useState<string>("");
  const [montoDigital, setMontoDigital] = useState<string>("");
  const { tabs: menuTabs, activeCategory: selectedCategory, setSelectedCategory } = useMenuCategories(productos);
  const agregadosVisibles = useMemo(() => agregadosDisponibles(agregados, insumos), [agregados, insumos]);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [selectedKitchenOrder, setSelectedKitchenOrder] = useState<Order | null>(null);
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


  // Cart items inside Modal: lineId (no el sku, para permitir 2 líneas del mismo producto
  // con personalización distinta) -> { product, quantity, notes, agregados }
  const [cart, setCart] = useState<
    Record<string, { product: Producto; quantity: number; notes: string; cremas?: string[]; agregados: string[] }>
  >({});

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
        [newLineId]: {
          product: prod,
          quantity: 1,
          notes: "",
          cremas: [],
          agregados: [],
        },
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
  const getAgregadosUnitPrice = (elegidos: string[]) => precioAgregados(elegidos, agregados);

  const getCartItemTotal = (item: { product: Producto; quantity: number; agregados: string[] }) => {
    const unitPrice = item.product.precio + getAgregadosUnitPrice(item.agregados);
    return unitPrice * item.quantity;
  };

  const calculateCartTotal = () => {
    return Object.values(cart).reduce((acc, curr) => acc + getCartItemTotal(curr), 0);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingOrder) return;

    const cartList = Object.values(cart);
    if (cartList.length === 0) {
      alert("Por favor selecciona al menos un producto para la comanda.");
      return;
    }

    if (!cajaEstado?.isOpen) {
      alert("La caja está cerrada. Debes abrir un turno de caja en Pagos antes de registrar pedidos.");
      return;
    }

    setIsSubmittingOrder(true);
    try {
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
          // Convierte los agregados seleccionados en "extras" con su precio real
          const extrasFromAgregados = extrasDeAgregados(item.agregados, agregados);

          return {
            productoId: item.product.id,
            sku: item.product.sku,
            nombre: item.product.nombre,
            precio: item.product.precio,
            cantidad: item.quantity,
            receta: item.product.receta || [],
            recetaCantidades: item.product.recetaCantidades || {},
            notas: item.notes,
            extras: extrasFromAgregados,
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

      // Usa el pedido tal como lo devolvió el backend (ya con insumo.nombre resuelto
      // para cada crema/agregado y su código final). Si fue rechazado, el modal y el
      // carrito se mantienen para corregir y reintentar, y no se imprime nada.
      const createdOrder = await addOrder(newOrder);
      if (!createdOrder) return;
      setIsModalOpen(false);
      setCart({});
      setCustomerName("");
      setMontoEfectivo("");
      setMontoDigital("");
      setSelectedPrintOrder(createdOrder);
      // La comanda la imprime la estación de comandas (ver ImpresoraComandas)
      avisar(
        esEstacionComandas()
          ? `Pedido ${createdOrder.code} enviado a cocina. La comanda sale después de la boleta.`
          : `Pedido ${createdOrder.code} enviado a cocina.`
      );
    } catch (error: unknown) {
      console.error("Error creating order:", error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      alert("Error al registrar comanda: " + message);
    } finally {
      setIsSubmittingOrder(false);
    }
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
  // En "Hoy" también salen los pedidos de días anteriores que siguen en preparación
  // o listos: si no, quedan escondidos y solo se ven en el contador del menú.
  const dateFilteredOrders = pedidos.filter(
    (order) =>
      (order.fecha >= range.start && order.fecha <= range.end) ||
      (dateFilter === "hoy" &&
        (order.status === "preparacion" || order.status === "listo"))
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
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition"
          >
            <Flame className="w-3.5 h-3.5" /> En cocina
          </button>
        );
      case "listo":
        return (
          <button
            onClick={() => updateOrderStatus(order.id, "entregado")}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            <PackageCheck className="w-3.5 h-3.5" /> Listo (Entregar & Descontar)
          </button>
        );
      case "entregado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Entregado
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

  const prepCount = dateFilteredOrders.filter((o) => o.status === "preparacion").length;
  const readyCount = dateFilteredOrders.filter((o) => o.status === "listo").length;

  // Cola unificada: las mesas con cuenta abierta se muestran también acá (de solo
  // lectura) para que cocina/caja no tengan que revisar dos pantallas — la creación
  // y edición de esos pedidos sigue siendo exclusiva de "Mesas", donde ya se maneja
  // todo el ciclo (agregar tandas, corregir ítems, pre-cuenta, cobro).
  const mesasActivas = mesas.filter(
    (m) => (m.status === "OCCUPIED" || m.status === "BILLING") && (m.currentOrder?.items.length ?? 0) > 0
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl text-slate-900">Pedidos</h1>
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" />
              {pedidos.length} registrados
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Para llevar y delivery. Las mesas se atienden en <strong>Mesas</strong>; aquí solo se ven.
          </p>
        </div>

        <button
          onClick={() => {
            if (!cajaEstado?.isOpen) {
              alert("La caja está cerrada. Debes abrir un turno de caja en Pagos antes de registrar pedidos.");
              return;
            }
            setIsModalOpen(true);
          }}
          className={`flex items-center gap-2 font-bold px-5 py-3 rounded-lg text-xs transition active:scale-95 shrink-0 ${
            cajaEstado?.isOpen
              ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
              : "bg-slate-200 text-slate-500 cursor-not-allowed"
          }`}
          title={!cajaEstado?.isOpen ? "La caja está cerrada" : undefined}
        >
          <PlusCircle className="w-4 h-4" />
          Nuevo pedido
        </button>
      </div>

      {/* Alerta de caja cerrada */}
      {!cajaEstado?.isOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-3 text-amber-950 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Caja cerrada. Ábrela en Caja para registrar pedidos.</span>
          </div>
        </div>
      )}

      {/* Cola unificada: mesas activas (solo lectura, se gestionan en Mesas) */}
      {mesasActivas.length > 0 && (
        <div className="bg-white p-5 rounded-lg border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              Mesas Activas ({mesasActivas.length})
            </h3>
            <button
              onClick={onGoToMesas}
              className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              Ir a Mesas <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mesasActivas.map((mesa) => (
              <button
                key={mesa.id}
                onClick={onGoToMesas}
                className={`p-3 rounded-lg border text-left transition ${
                  mesa.status === "BILLING"
                    ? "bg-blue-50 border-blue-200 hover:border-blue-400"
                    : "bg-amber-50 border-amber-200 hover:border-amber-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">Mesa #{mesa.number}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                      mesa.status === "BILLING" ? "bg-blue-500 text-white" : "bg-amber-500 text-slate-950"
                    }`}
                  >
                    {mesa.status === "BILLING" ? "Pidiendo Cuenta" : "Consumiendo"}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-700 mt-1">
                  S/ {(mesa.currentOrder?.total ?? 0).toFixed(2)}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold mt-1">
                  <span>{mesa.currentOrder?.items.length ?? 0} ítems</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatElapsed(mesa.currentOrder?.createdAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 bg-white border border-slate-200 rounded-lg divide-x divide-slate-200">
        <div className="p-3 sm:p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Hoy</span>
            <div className="text-3xl font-display text-slate-900">{dateFilteredOrders.length}</div>
          </div>
          <div className="hidden sm:flex w-9 h-9 rounded-md bg-slate-100 items-center justify-center text-slate-700">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-blue-700">En cocina</span>
            <div className="text-3xl font-display text-blue-600">{prepCount}</div>
          </div>
          <div className="hidden sm:flex w-9 h-9 rounded-md bg-blue-50 items-center justify-center text-blue-600">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-emerald-700">Listos</span>
            <div className="text-3xl font-display text-emerald-600">{readyCount}</div>
          </div>
          <div className="hidden sm:flex w-9 h-9 rounded-md bg-emerald-50 items-center justify-center text-emerald-600">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 text-xs font-semibold overflow-x-auto">
            {[
              { key: "all", label: "Todos" },
              { key: "preparacion", label: `En cocina (${prepCount})` },
              { key: "listo", label: `Listos (${readyCount})` },
              { key: "entregado", label: "Entregados" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOrderFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-md transition whitespace-nowrap ${
                  orderFilter === tab.key
                    ? "bg-white text-slate-900 font-bold"
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
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {[
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Esta semana" },
            { key: "mes", label: "Este mes" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setDateFilter(f.key as "hoy" | "semana" | "mes");
                setCustomDate("");
              }}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition border ${
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
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${
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
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs">
                <th className="py-3 px-4">Pedido</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Productos</th>
                <th className="py-3 px-4">Tipo / pago</th>
                <th className="py-3 px-4">Total (S/)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Fecha</th>
                <th className="py-3 px-4 text-center">Hora</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                    Sin pedidos en este filtro.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const itemsSummary = order.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-extrabold text-slate-900 text-sm">
                        {order.code}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {order.customer}
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-semibold text-slate-800 truncate">{itemsSummary}</div>
                        <div className="text-[11px] text-slate-400">{order.items.length} items seleccionados</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md font-semibold text-[11px] text-slate-700">
                            {order.paymentMethod}
                          </span>
                          <span className="text-slate-400">• {order.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900 text-sm">
                        S/ {order.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(order)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                        {order.fecha}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                        {order.hora}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {order.status !== "entregado" && order.status !== "cancelado" && (
                            <button
                              onClick={() => handleCancelOrder(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 font-bold text-[11px] transition"
                              title="Cancelar Pedido"
                            >
                              <Ban className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedKitchenOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-100 border border-orange-300 hover:bg-orange-500 hover:text-white text-orange-700 font-bold text-[11px] transition"
                            title="Imprimir comanda de cocina"
                          >
                            Comanda
                          </button>
                          <button
                            onClick={() => setSelectedDetailOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition"
                            title="Ver Detalle del Pedido"
                          >
                            <ClipboardList className="w-3.5 h-3.5" /> Detalle
                          </button>
                          <button
                            onClick={() => setSelectedPrintOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-bold text-[11px] transition"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Nuevo pedido</h3>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-md bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 flex-1 overflow-hidden">
              <div className="md:col-span-3 p-6 space-y-4 overflow-y-auto border-r border-slate-100">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Cliente</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Servicio</label>
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as "Llevar" | "Delivery")}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Llevar">Para llevar</option>
                      <option value="Delivery">Delivery</option>
                    </select>
                  </div>
                </div>

                <div className="relative flex items-center group py-1">
                  <button
                    type="button"
                    onClick={() => scrollCategories("left")}
                    className="absolute left-0 z-10 p-1.5 rounded-full bg-white/95 border border-slate-200 text-slate-700 hover:bg-amber-500 hover:text-slate-950 transition opacity-80 hover:opacity-100"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div
                    ref={categoryScrollRef}
                    onWheel={handleCategoryWheel}
                    className="flex gap-2 overflow-x-auto px-7 py-1.5 scrollbar-none scroll-smooth w-full"
                  >
                    {menuTabs.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all duration-200 whitespace-nowrap border shrink-0 ${
                          selectedCategory === cat
                            ? "bg-slate-900 text-amber-400 border-slate-900 scale-105"
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
                    className="absolute right-0 z-10 p-1.5 rounded-full bg-white/95 border border-slate-200 text-slate-700 hover:bg-amber-500 hover:text-slate-950 transition opacity-80 hover:opacity-100"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              <div className="grid grid-cols-2 gap-3">
                {productos
                  .filter((p) => getCategoriaNombre(p) === selectedCategory && p.isAvailable)
                  .map((prod) => {
                    const precioNum =
                      typeof prod.precio === "number"
                        ? prod.precio
                        : Number(prod.precio || 0);
                    const agotado = productoSinStock(prod, insumos);

                    return (
                      <button
                        key={prod.id}
                        type="button"
                        disabled={agotado}
                        onClick={() => handleAddToCart(prod)}
                        className="p-3 bg-slate-50 hover:bg-amber-500/10 hover:border-amber-400 border border-slate-200/80 rounded-lg text-left transition flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50 disabled:hover:border-slate-200/80"
                      >
                        <div>
                          <span className="text-xl">{prod.iconoEmoji}</span>
                          <div className="font-bold text-slate-900 text-xs mt-1 group-hover:text-amber-700">
                            {prod.nombre}
                          </div>
                          <div className="text-[11px] font-extrabold text-slate-600 mt-0.5">
                            S/ {precioNum.toFixed(2)}
                            {agotado && <span className="ml-1.5 text-rose-600">· Sin stock</span>}
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-amber-500 group-hover:text-slate-950 group-hover:border-amber-500 transition">
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
                      Pedido
                    </h4>
                    <span className="text-xs text-slate-500 font-semibold">
                      {Object.keys(cart).length} items
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {Object.keys(cart).length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs font-medium">
                        Selecciona ítems de la carta.
                      </div>
                    ) : (
                      Object.entries(cart).map(([lineId, item]) => (
                        <div
                          key={lineId}
                          className="bg-white p-3 rounded-md border border-slate-200/80 space-y-2"
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

                          {permitePersonalizacion(getCategoriaNombre(item.product)) && (
                            <>
                              <textarea
                                rows={4}
                                value={item.notes}
                                onChange={(e) => handleUpdateCartNotes(lineId, e.target.value)}
                                placeholder="Ej: sin cebolla, con mayonesa, ketchup y queso cheddar..."
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-md text-base font-medium text-slate-900 focus:outline-none focus:border-amber-500 placeholder:text-slate-400 resize-y"
                              />

                              <div>
                                <div className="text-[10px] font-bold text-slate-500 mb-1">
                                  Agregados
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {agregadosVisibles.map((agregado) => {
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
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Pago</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { key: "Yape/Plin", label: "Yape/Plin" },
                          { key: "Efectivo", label: "Efectivo" },
                          { key: "Mixto", label: "Mixto" },
                        ] as { key: "Efectivo" | "Yape/Plin" | "Mixto"; label: string }[]
                      ).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setPaymentMethod(m.key)}
                          className={`py-2 rounded-md text-[10px] font-bold transition border ${
                            paymentMethod === m.key
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {paymentMethod === "Mixto" && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                        <div className="text-[11px] font-extrabold text-amber-900 flex items-center justify-between">
                          <span>Pago mixto</span>
                          <span className="text-amber-700 font-bold">Total: S/ {calculateCartTotal().toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Yape / Plin (S/)</label>
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Efectivo (S/)</label>
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === "Efectivo" && (
                      <div className="mt-3">
                        <CambioEfectivo total={calculateCartTotal()} />
                      </div>
                    )}
                    {paymentMethod === "Mixto" && (
                      <div className="mt-3">
                        <CambioEfectivo total={parseFloat(montoEfectivo) || 0} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                    <span className="text-xs font-bold text-amber-900">Total</span>
                    <span className="text-xl font-extrabold text-amber-900">
                      S/ {calculateCartTotal().toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={!cajaEstado?.isOpen || isSubmittingOrder}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold rounded-lg text-xs transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSubmittingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registrando comanda...</span>
                      </>
                    ) : !cajaEstado?.isOpen ? (
                      "Caja cerrada"
                    ) : (
                      "Enviar a cocina"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPrintOrder && !selectedKitchenOrder && (
        <TicketReceiptModal
          order={selectedPrintOrder}
          onClose={() => setSelectedPrintOrder(null)}
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

      {selectedDetailOrder && (
        <OrderDetailModal
          order={selectedDetailOrder}
          onClose={() => setSelectedDetailOrder(null)}
        />
      )}
    </div>
  );
}