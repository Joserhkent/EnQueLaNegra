import { create } from "zustand";

export type UserRole = "jefe" | "empleado";

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  password?: string;
  role?: UserRole;
  turn?: string;
}

export interface Insumo {
  id: string;
  nombre: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  categoria?: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  categoriaId?: string;
  categoria?: any; // Acepta tanto objeto como string
  precio: number;
  isAvailable: boolean;
  isPopular?: boolean;
  descripcion: string;
  iconoEmoji: string;
  receta?: string[];
}

export interface MovimientoStock {
  id: string;
  insumoId: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo: string;
  fecha: string;
  usuario: string;
}

export interface OrderItemExtra {
  id?: string;
  insumoId: string;
  cantidad: number;
  precioExtra: number;
  insumo?: { nombre: string };
}

export interface OrderItem {
  id?: string;
  productoId?: string;
  sku: string;
  nombre: string;
  precio: number;
  cantidad: number;
  receta: string[];
  notas?: string;
  extras?: OrderItemExtra[];
  ronda?: number;
  kitchenStatus?: string;
}

// 👇 Ya no existe "pendiente": todo pedido nuevo entra directo a "preparacion" (En Cocina)
export interface Order {
  id: string;
  code: string;
  customer: string;
  items: OrderItem[];
  total: number;
  type: "Llevar" | "Mesa" | "Delivery";
  paymentMethod: "Efectivo" | "Yape/Plin" | "Mixto";
  montoEfectivo?: number;
  montoDigital?: number;
  status: "preparacion" | "listo" | "entregado" | "cancelado";
  fecha: string;
  hora: string;
  tableId?: string | null;
  table?: { number: number } | null;
  user?: { id: string; name: string; username: string } | null;
  createdAt?: string;
}

export type MesaStatus = "AVAILABLE" | "OCCUPIED" | "BILLING";

export interface Mesa {
  id: string;
  number: number;
  capacity: number;
  status: MesaStatus;
  currentOrderId: string | null;
  currentOrder: Order | null;
}

export interface CierreCaja {
  id: string;
  fecha: string;
  hora: string;
  totalVendido: number;
  efectivo: number;
  yapePlin: number;
  tarjeta: number;
  cantidadPedidos: number;
  usuario: string;
  notas?: string;
}

interface PosStore {
  currentUser: UserAccount | null;
  users: UserAccount[];
  insumos: Insumo[];
  productos: Producto[];
  movimientos: MovimientoStock[];
  pedidos: Order[];
  cierresCaja: CierreCaja[];
  mesas: Mesa[];
  loading: boolean;

  fetchProductos: () => Promise<void>;
  fetchInsumos: () => Promise<void>;
  fetchPedidos: () => Promise<void>;
  fetchMovimientos: () => Promise<void>;
  fetchMesas: () => Promise<void>;
  openMesa: (tableId: string, customer?: string) => Promise<Mesa | null>;
  addItemsToMesa: (tableId: string, items: OrderItem[]) => Promise<Mesa | null>;
  updateMesaItem: (
    tableId: string,
    itemId: string,
    dto: { cantidad?: number; notas?: string; kitchenStatus?: string }
  ) => Promise<Mesa | null>;
  updateOrderItemKitchenStatus: (
    orderId: string,
    itemId: string,
    kitchenStatus: "PENDING" | "IN_KITCHEN" | "DELIVERED"
  ) => Promise<void>;
  removeMesaItem: (tableId: string, itemId: string) => Promise<Mesa | null>;
  preBillMesa: (tableId: string) => Promise<Mesa | null>;
  checkoutMesa: (
    tableId: string,
    paymentMethod: Order["paymentMethod"],
    montoEfectivo?: number,
    montoDigital?: number
  ) => Promise<Order | null>;

  login: (username: string, password?: string) => Promise<UserAccount | null>;
  setCurrentUser: (user: UserAccount | null) => void;
  logout: () => void;

  addStockMovement: (
    insumoId: string,
    cantidad: number,
    tipo: "entrada" | "salida" | "ajuste",
    motivo: string,
    usuario?: string
  ) => Promise<void>;
  updateInsumoMinimo: (insumoId: string, stockMinimo: number) => Promise<void>;

  addProduct: (producto: Producto) => Promise<void>;
  updateProduct: (producto: Producto) => Promise<void>;
  toggleProductAvailability: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  completeOrder: (orderId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, newStatus: Order["status"]) => Promise<void>;
  addOrder: (order: Order) => Promise<void>;
  fetchCierres: () => Promise<void>;
  cerrarCaja: (usuario?: string, notas?: string) => Promise<void>;
}

const API_URL = "http://localhost:3000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("eqln_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// 🔧 El backend (Prisma) guarda el status en MAYÚSCULAS (PREPARACION, LISTO, ENTREGADO, CANCELADO).
// El frontend trabaja en minúsculas. Estas dos funciones traducen en cada dirección.
// Además, "PENDIENTE" (si existiera algún registro viejo) se fusiona con "preparacion".
const normalizeStatusFromBackend = (status: unknown): Order["status"] => {
  const s = String(status || "").toLowerCase();
  if (s === "pendiente") return "preparacion";
  if (s === "preparacion" || s === "listo" || s === "entregado" || s === "cancelado") {
    return s;
  }
  return "preparacion";
};

const statusToBackend = (status: Order["status"]): string => status.toUpperCase();

// Reemplaza (o agrega) una mesa en la lista local con la versión que acaba de
// devolver el backend, en vez de volver a pedir /tables completo. La mutación
// (abrir, agregar tanda, editar/quitar ítem, pre-cuenta) ya devuelve la mesa
// actualizada — pedirla de nuevo solo duplica el round-trip más lento de la
// operación (el de red hacia la base de datos) sin ganar nada.
const upsertMesa = (mesas: Mesa[], mesa: Mesa): Mesa[] => {
  const exists = mesas.some((m) => m.id === mesa.id);
  return exists ? mesas.map((m) => (m.id === mesa.id ? mesa : m)) : [...mesas, mesa];
};

// 🔧 Mismo problema que con el status: el backend guarda/devuelve el método de pago
// en MAYÚSCULAS con guion bajo (EFECTIVO, YAPE_PLIN, MIXTO), pero toda la UI (boletas,
// tablas de Pedidos/Historial, comparaciones con "Mixto") espera el formato legible
// del frontend ("Efectivo", "Yape/Plin", "Mixto"). Sin normalizar, cualquier pedido
// recién leído del API muestra el enum crudo en la boleta.
const normalizePaymentMethodFromBackend = (metodo: unknown): Order["paymentMethod"] => {
  const s = String(metodo || "").toUpperCase().replace(/\s+/g, "_");
  if (s === "YAPE_PLIN" || s === "YAPE/PLIN") return "Yape/Plin";
  if (s === "MIXTO") return "Mixto";
  return "Efectivo";
};

export const usePosStore = create<PosStore>((set, get) => ({
  currentUser: null,
  users: [],
  insumos: [],
  productos: [],
  movimientos: [],
  pedidos: [],
  cierresCaja: [],
  mesas: [],
  loading: false,

  fetchProductos: async () => {
    try {
      set({ loading: true });
      const res = await fetch(`${API_URL}/productos`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo productos");
      const data = await res.json();
      // 🔧 El backend manda `recetaItems: [{ insumoId, insumo }]`, no un `receta: string[]`
      // plano. Sin esto, el formulario de editar producto nunca ve la receta actual.
      const normalizados: Producto[] = data.map((p: any) => ({
        ...p,
        receta: Array.isArray(p.recetaItems)
          ? p.recetaItems.map((ri: any) => ri.insumoId)
          : [],
      }));
      set({ productos: normalizados, loading: false });
    } catch (error) {
      console.error("Error al obtener productos:", error);
      set({ loading: false });
    }
  },

  fetchInsumos: async () => {
    try {
      set({ loading: true });
      const res = await fetch(`${API_URL}/insumos`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo insumos");
      const data = await res.json();
      // 🔧 El backend manda `categoria` como objeto anidado ({ id, nombre, ... }), no
      // como string plano — sin esto, cualquier comparación por nombre de categoría
      // (ej. el selector de receta BOM en Productos) nunca encuentra coincidencias.
      const normalizados: Insumo[] = data.map((i: any) => ({
        ...i,
        categoria:
          typeof i.categoria === "object" && i.categoria !== null
            ? i.categoria.nombre
            : i.categoria,
      }));
      set({ insumos: normalizados, loading: false });
    } catch (error) {
      console.error("Error al obtener insumos:", error);
      set({ loading: false });
    }
  },

  fetchMovimientos: async () => {
    try {
      const res = await fetch(`${API_URL}/insumos/movimientos`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo movimientos");
      const data = await res.json();
      // El backend guarda tipo en MAYÚSCULAS (ENTRADA/SALIDA/AJUSTE); el frontend en minúsculas.
      const normalizados: MovimientoStock[] = data.map((m: any) => ({
        ...m,
        tipo: String(m.tipo || "").toLowerCase(),
      }));
      set({ movimientos: normalizados });
    } catch (error) {
      console.error("Error al obtener movimientos:", error);
    }
  },

  fetchMesas: async () => {
    try {
      const res = await fetch(`${API_URL}/tables`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo mesas");
      const data = await res.json();
      set({ mesas: data });
    } catch (error) {
      console.error("Error al obtener mesas:", error);
    }
  },

  openMesa: async (tableId, customer) => {
    try {
      const res = await fetch(`${API_URL}/tables/${tableId}/open`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ customer }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(`No se pudo abrir la mesa: ${err?.message || "Error desconocido"}`);
        return null;
      }
      const mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      return mesa;
    } catch (error) {
      console.error("Error al abrir mesa:", error);
      return null;
    }
  },

  addItemsToMesa: async (tableId, items) => {
    try {
      const payload = {
        items: items.map((item) => ({
          productoId: item.productoId || item.sku,
          sku: item.sku,
          nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          notas: item.notas,
          extras: item.extras,
        })),
      };
      const res = await fetch(`${API_URL}/tables/${tableId}/items`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo agregar la tanda de productos";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      // El stock ya se descontó en el backend; refrescarlo no bloquea la UI de la mesa.
      get().fetchInsumos();
      return mesa;
    } catch (error) {
      console.error("Error al agregar ítems a la mesa:", error);
      return null;
    }
  },

  updateMesaItem: async (tableId, itemId, dto) => {
    try {
      const res = await fetch(`${API_URL}/tables/${tableId}/items/${itemId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo editar el ítem";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      get().fetchInsumos();
      return mesa;
    } catch (error) {
      console.error("Error al editar ítem de la mesa:", error);
      return null;
    }
  },

  removeMesaItem: async (tableId, itemId) => {
    try {
      const res = await fetch(`${API_URL}/tables/${tableId}/items/${itemId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo quitar el ítem";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      get().fetchInsumos();
      return mesa;
    } catch (error) {
      console.error("Error al quitar ítem de la mesa:", error);
      return null;
    }
  },

  preBillMesa: async (tableId) => {
    try {
      const res = await fetch(`${API_URL}/tables/${tableId}/pre-bill`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      const mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      return mesa;
    } catch (error) {
      console.error("Error al emitir pre-cuenta:", error);
      return null;
    }
  },

  checkoutMesa: async (tableId, paymentMethod, montoEfectivo, montoDigital) => {
    try {
      const payload = {
        paymentMethod:
          paymentMethod === "Yape/Plin" ? "YAPE_PLIN" : paymentMethod.toUpperCase(),
        montoEfectivo,
        montoDigital,
      };
      const res = await fetch(`${API_URL}/tables/${tableId}/checkout`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo cobrar la mesa";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const order = await res.json();
      // Se sabe exactamente cómo queda la mesa (libre, sin orden) sin tener que
      // releerla; el historial de pedidos y el stock se refrescan en segundo plano.
      set((state) => ({
        mesas: state.mesas.map((m) =>
          m.id === tableId
            ? { ...m, status: "AVAILABLE", currentOrderId: null, currentOrder: null }
            : m
        ),
      }));
      get().fetchPedidos();
      get().fetchInsumos();
      return {
        ...order,
        status: normalizeStatusFromBackend(order.status),
        paymentMethod: normalizePaymentMethodFromBackend(order.paymentMethod),
      };
    } catch (error) {
      console.error("Error al cobrar mesa:", error);
      return null;
    }
  },

  fetchPedidos: async () => {
    try {
      set({ loading: true });
      const res = await fetch(`${API_URL}/pedidos`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo pedidos");
      const data = await res.json();
      // 🔧 Las mesas con cuenta abierta (status OPEN) se gestionan desde la vista de
      // Mesas, no desde Pedidos: se excluyen aquí para no duplicar/confundir la comanda.
      const normalizados: Order[] = data
        .filter((o: any) => String(o.status || "").toUpperCase() !== "OPEN")
        .map((o: any) => ({
          ...o,
          status: normalizeStatusFromBackend(o.status),
          paymentMethod: normalizePaymentMethodFromBackend(o.paymentMethod),
        }));
      set({ pedidos: normalizados, loading: false });
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      set({ loading: false });
    }
  },

  login: async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) return null;
      const user = await res.json();
      set({ currentUser: user });
      return user;
    } catch (error) {
      console.error("Error en login:", error);
      return null;
    }
  },

  setCurrentUser: (user) => set({ currentUser: user }),
  logout: () => set({ currentUser: null }),

  addStockMovement: async (insumoId, cantidad, tipo, motivo, _usuario = "Administrador") => {
    try {
      const res = await fetch(`${API_URL}/insumos/${insumoId}/movimiento`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ cantidad, tipo, motivo }),
      });

      if (res.ok) {
        await Promise.all([get().fetchInsumos(), get().fetchMovimientos()]);
      } else {
        console.error("Error en la respuesta del servidor al mover stock:", await res.json());
      }
    } catch (error) {
      console.error("Error al registrar movimiento:", error);
    }
  },

  updateInsumoMinimo: async (insumoId, stockMinimo) => {
    try {
      await fetch(`${API_URL}/insumos/${insumoId}/minimo`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ stockMinimo }),
      });
      await get().fetchInsumos();
    } catch (error) {
      console.error("Error al actualizar insumo:", error);
    }
  },

  addProduct: async (producto) => {
    try {
      await fetch(`${API_URL}/productos`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(producto),
      });
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al agregar producto:", error);
    }
  },

  updateProduct: async (producto) => {
    try {
      await fetch(`${API_URL}/productos/${producto.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(producto),
      });
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al actualizar producto:", error);
    }
  },

  toggleProductAvailability: async (id) => {
    const prod = get().productos.find((p) => p.id === id);
    if (!prod) return;
    try {
      await fetch(`${API_URL}/productos/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isAvailable: !prod.isAvailable }),
      });
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al cambiar disponibilidad:", error);
    }
  },

  deleteProduct: async (id) => {
    try {
      await fetch(`${API_URL}/productos/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al eliminar producto:", error);
    }
  },

  addOrder: async (order) => {
    try {
      const payload = {
        code: order.code,
        customer: order.customer,
        type: (order.type || "MESA").toUpperCase(),
        status: statusToBackend(order.status),
        paymentMethod:
          order.paymentMethod === "Yape/Plin"
            ? "YAPE_PLIN"
            : (order.paymentMethod || "EFECTIVO").toUpperCase(),
        montoEfectivo: order.montoEfectivo,
        montoDigital: order.montoDigital,
        items: order.items.map((item) => ({
          productoId: item.productoId || item.sku,
          sku: item.sku,
          nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          notas: item.notas,
          extras: item.extras || [],
        })),
      };

      const res = await fetch(`${API_URL}/pedidos`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        console.error("Error al crear pedido, respuesta del servidor:", errorBody);
        const msg = errorBody?.message || "No se pudo registrar el pedido";
        if (res.status === 401) {
          alert("Tu sesión ha expirado o no es válida. Por favor cierra sesión e inicia de nuevo.");
        } else {
          alert(`No se pudo crear el pedido: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
        }
        return;
      }

      const createdOrder = await res.json();
      const normalizado: Order = {
        ...createdOrder,
        status: normalizeStatusFromBackend(createdOrder.status),
        paymentMethod: normalizePaymentMethodFromBackend(createdOrder.paymentMethod),
      };
      set((state) => ({ pedidos: [normalizado, ...state.pedidos] }));
      get().fetchInsumos();
    } catch (error) {
      console.error("Error al crear pedido:", error);
      alert("No se pudo crear el pedido. Revisa tu conexión e intenta de nuevo.");
    }
  },

  completeOrder: async (orderId) => {
    try {
      await fetch(`${API_URL}/pedidos/${orderId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "ENTREGADO" }),
      });
      await get().fetchPedidos();
      await get().fetchInsumos();
    } catch (error) {
      console.error("Error al completar pedido:", error);
    }
  },

  updateOrderStatus: async (orderId, newStatus) => {
    try {
      await fetch(`${API_URL}/pedidos/${orderId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: statusToBackend(newStatus) }),
      });
      await get().fetchPedidos();
      if (newStatus === "entregado") {
        await get().fetchInsumos();
      }
    } catch (error) {
      console.error("Error al cambiar estado del pedido:", error);
    }
  },
  updateOrderItemKitchenStatus: async (orderId, itemId, kitchenStatus) => {
    try {
      const res = await fetch(`${API_URL}/pedidos/${orderId}/items/${itemId}/kitchen-status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ kitchenStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || "No se pudo actualizar el ítem");
        return;
      }
      const updatedOrder = await res.json();
      const normalizado: Order = {
        ...updatedOrder,
        status: normalizeStatusFromBackend(updatedOrder.status),
        paymentMethod: normalizePaymentMethodFromBackend(updatedOrder.paymentMethod),
      };
      set((state) => ({
        pedidos: state.pedidos.map((o) => (o.id === orderId ? normalizado : o)),
      }));
    } catch (error) {
      console.error("Error al actualizar estado del ítem:", error);
    }
  },

  fetchCierres: async () => {
    try {
      const res = await fetch(`${API_URL}/caja/cierres`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo cierres");
      const data = await res.json();
      set({ cierresCaja: data });
    } catch (error) {
      console.error("Error al obtener cierres:", error);
    }
  },

  cerrarCaja: async (_usuario = "Administrador", notas = "Cierre de caja") => {
    try {
      const res = await fetch(`${API_URL}/caja/cierre`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ notas }),
      });
      if (res.ok) {
        await Promise.all([get().fetchPedidos(), get().fetchCierres()]);
      } else {
        const err = await res.json().catch(() => null);
        console.error("Error al cerrar caja:", err);
      }
    } catch (error) {
      console.error("Error al cerrar caja:", error);
    }
  },
}));