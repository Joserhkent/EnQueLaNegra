/* eslint-disable @typescript-eslint/no-explicit-any -- el store normaliza respuestas crudas de la API, cuya forma no está tipada */
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
  // Presentación de compra: "lata" que trae 130 (en unidadMedida)
  presentacionNombre?: string | null;
  presentacionCantidad?: number | null;
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
  /** Cantidad requerida por insumo (BOM). Si falta, se asume 1. */
  recetaCantidades?: Record<string, number>;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: "PRODUCTO" | "INSUMO";
  orden?: number;
}

// Lo que se envía al crear/editar un producto: la receta va con su cantidad por insumo.
export type ProductoPayload = Omit<Producto, "receta" | "recetaCantidades"> & {
  receta: { insumoId: string; cantidad: number }[];
};

export interface MovimientoStock {
  id: string;
  insumoId: string;
  insumo?: { nombre: string };
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
  // Al pedir: el servidor toma precio, insumo y consumo de este agregado
  agregadoId?: string;
  insumo?: { nombre: string };
}

// Agregado que se cobra aparte ("+ tocineta"); consumo en la unidad del insumo
export interface Agregado {
  id: string;
  nombre: string;
  precio: number;
  insumoId: string;
  consumo: number;
  activo: boolean;
  orden: number;
}

export type AgregadoDatos = Omit<Agregado, "id" | "orden">;

export interface OrderItem {
  id?: string;
  productoId?: string;
  sku: string;
  nombre: string;
  precio: number;
  cantidad: number;
  receta: string[];
  recetaCantidades?: Record<string, number>;
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
  montoRecibido?: number;
  vuelto?: number;
  status: "preparacion" | "listo" | "entregado" | "cancelado";
  fecha: string;
  hora: string;
  tableId?: string | null;
  table?: { number: number } | null;
  user?: { id: string; name: string; username: string } | null;
  pagos?: { id: string; metodoPago: string; monto: number; fecha?: string }[];
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
  joinedToId?: string | null;
  joinedTables?: Mesa[];
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

export interface CajaSesion {
  id: string;
  estado: "ABIERTA" | "CERRADA";
  montoInicial: number;
  fechaApertura: string;
  usuarioAperturaId?: string | null;
  usuarioApertura: string;
  notasApertura?: string | null;
  fechaCierre?: string | null;
  usuarioCierreId?: string | null;
  usuarioCierre?: string | null;
  totalVendido?: number | null;
  efectivoVentas?: number | null;
  yapePlin?: number | null;
  tarjeta?: number | null;
  cantidadPedidos?: number | null;
  efectivoEsperado?: number | null;
  efectivoReal?: number | null;
  diferencia?: number | null;
  notasCierre?: string | null;
  createdAt: string;
}

export interface CajaEstadoResponse {
  isOpen: boolean;
  sesion: CajaSesion | null;
  lastSession?: CajaSesion | null;
  resumenActual?: {
    montoInicial: number;
    totalVendido: number;
    efectivoVentas: number;
    yapePlin: number;
    tarjeta: number;
    efectivoEsperado: number;
    cantidadPedidos: number;
  };
}

interface PosStore {
  currentUser: UserAccount | null;
  users: UserAccount[];
  insumos: Insumo[];
  productos: Producto[];
  categorias: Categoria[];
  movimientos: MovimientoStock[];
  pedidos: Order[];
  cierresCaja: CierreCaja[];
  cajaEstado: CajaEstadoResponse | null;
  cajaSesiones: CajaSesion[];
  mesas: Mesa[];
  loading: boolean;

  fetchProductos: () => Promise<void>;
  fetchInsumos: () => Promise<void>;
  fetchPedidos: () => Promise<void>;
  fetchMovimientos: () => Promise<void>;
  fetchMesas: () => Promise<void>;
  fetchCajaEstado: () => Promise<CajaEstadoResponse | null>;
  fetchCajaSesiones: () => Promise<void>;
  abrirCaja: (montoInicial: number, notas?: string) => Promise<boolean>;
  cerrarCajaSesion: (efectivoReal?: number, notas?: string) => Promise<boolean>;
  createMesa: (capacity: number) => Promise<Mesa | null>;
  updateMesa: (tableId: string, changes: { number?: number; capacity?: number }) => Promise<Mesa | null>;
  deleteMesa: (tableId: string) => Promise<boolean>;
  joinMesas: (mainTableId: string, tableIds: string[]) => Promise<Mesa | null>;
  unjoinMesas: (tableId: string) => Promise<boolean>;
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
  partialPaymentMesa: (tableId: string, paymentMethod: Order["paymentMethod"], monto: number) => Promise<Mesa | null>;
  checkoutMesa: (
    tableId: string,
    paymentMethod: Order["paymentMethod"],
    montoEfectivo?: number,
    montoDigital?: number
  ) => Promise<Order | null>;

  login: (username: string, password?: string) => Promise<UserAccount | null>;
  setCurrentUser: (user: UserAccount | null) => void;
  logout: () => void;
  // Contraseñas: devuelven null si salió bien o el mensaje de error para mostrarlo
  cambiarPassword: (actual: string, nueva: string) => Promise<string | null>;
  listarUsuarios: () => Promise<UsuarioSistema[]>;
  restablecerPassword: (userId: string, nueva: string) => Promise<string | null>;

  addStockMovement: (
    insumoId: string,
    cantidad: number,
    tipo: "entrada" | "salida" | "ajuste",
    motivo: string,
    usuario?: string
  ) => Promise<void>;
  // Recibir mercadería ("entrada") o conteo de inventario ("ajuste") de varios insumos
  // de una vez. Devuelve null si salió bien, o el mensaje de error.
  registrarLoteStock: (
    tipo: "entrada" | "ajuste",
    items: { insumoId: string; cantidad: number; costoUnitario?: number }[],
    motivo?: string
  ) => Promise<string | null>;
  updateInsumoMinimo: (insumoId: string, stockMinimo: number) => Promise<void>;
  // Ajustes del insumo (mínimo, costo, presentación). Devuelve null o el error.
  updateInsumo: (
    insumoId: string,
    cambios: {
      stockMinimo?: number;
      costoUnitario?: number;
      presentacionNombre?: string | null;
      presentacionCantidad?: number | null;
    }
  ) => Promise<string | null>;

  addProduct: (producto: ProductoPayload) => Promise<void>;
  updateProduct: (producto: ProductoPayload) => Promise<void>;
  toggleProductAvailability: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  fetchCategorias: () => Promise<void>;

  agregados: Agregado[];
  fetchAgregados: () => Promise<void>;
  // Crea (id null) o edita un agregado. Devuelve null o el error.
  guardarAgregado: (id: string | null, datos: Partial<AgregadoDatos>) => Promise<string | null>;
  borrarAgregado: (id: string) => Promise<string | null>;
  addCategoria: (nombre: string, tipo: "PRODUCTO" | "INSUMO") => Promise<boolean>;
  deleteCategoria: (id: string) => Promise<boolean>;

  addInsumo: (data: {
    nombre: string;
    categoria: string;
    unidadMedida: string;
    stockActual: number;
    stockMinimo: number;
    costoUnitario: number;
  }) => Promise<boolean>;
  deleteInsumo: (id: string) => Promise<boolean>;

  completeOrder: (orderId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, newStatus: Order["status"]) => Promise<void>;
  /** Devuelve el pedido tal como quedó guardado, o null si el backend lo rechazó. */
  addOrder: (order: Order) => Promise<Order | null>;
  fetchCierres: () => Promise<void>;
  cerrarCaja: (usuario?: string, notas?: string) => Promise<void>;
}

export const API_URL = import.meta.env.VITE_API_URL || "/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("eqln_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Todas las rutas de la API piden token. Si caduca (dura 1 día) o deja de ser válido,
// la API responde 401 a todo: en vez de dejar las pantallas vacías sin explicación, se
// cierra la sesión una sola vez y App vuelve al login.
let avisoSesionExpirada = false;
const authFetch = async (input: string, init?: RequestInit): Promise<Response> => {
  const res = await fetch(input, init);
  if (res.status === 401 && localStorage.getItem("eqln_token")) {
    localStorage.removeItem("eqln_token");
    localStorage.removeItem("eqln_user");
    usePosStore.getState().logout();
    if (!avisoSesionExpirada) {
      avisoSesionExpirada = true;
      alert("Tu sesión expiró. Vuelve a iniciar sesión.");
    }
  }
  return res;
};

// Mensaje de error de la API (string o lista de validaciones) en un solo texto.
const mensajeError = async (res: Response, porDefecto: string): Promise<string> => {
  const err = await res.json().catch(() => null);
  const msg = err?.message || porDefecto;
  return Array.isArray(msg) ? msg.join(", ") : msg;
};

// Muestra el mensaje de error de la API.
const alertarError = async (res: Response, porDefecto: string) => {
  if (res.status === 401) return; // authFetch ya avisó y cerró la sesión
  alert(await mensajeError(res, porDefecto));
};

export interface UsuarioSistema {
  id: string;
  name: string;
  username: string;
  active: boolean;
  role: string;
}

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
  return exists
    ? mesas.map((current) =>
        current.id === mesa.id
          ? {
              ...current,
              ...mesa,
              joinedToId:
                mesa.joinedToId === undefined ? current.joinedToId : mesa.joinedToId,
              joinedTables: mesa.joinedTables ?? current.joinedTables,
            }
          : current
      )
    : [...mesas, mesa];
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

const normalizeOrderTypeFromBackend = (type: unknown): Order["type"] => {
  const normalizedType = String(type || "").toUpperCase();
  if (normalizedType === "DELIVERY") return "Delivery";
  if (normalizedType === "LLEVAR") return "Llevar";
  return "Mesa";
};

// Sesión guardada del último login (si el JSON está dañado, se descarta).
const leerUsuarioGuardado = (): UserAccount | null => {
  try {
    const guardado = localStorage.getItem("eqln_user");
    return guardado ? (JSON.parse(guardado) as UserAccount) : null;
  } catch {
    localStorage.removeItem("eqln_user");
    localStorage.removeItem("eqln_token");
    return null;
  }
};

export const usePosStore = create<PosStore>((set, get) => ({
  currentUser: leerUsuarioGuardado(),
  users: [],
  insumos: [],
  productos: [],
  categorias: [],
  agregados: [],
  movimientos: [],
  pedidos: [],
  cierresCaja: [],
  cajaEstado: null,
  cajaSesiones: [],
  mesas: [],
  loading: false,

  fetchProductos: async () => {
    try {
      set({ loading: true });
      const res = await authFetch(`${API_URL}/productos`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo productos");
      const data = await res.json();
      // 🔧 El backend manda `recetaItems: [{ insumoId, insumo }]`, no un `receta: string[]`
      // plano. Sin esto, el formulario de editar producto nunca ve la receta actual.
      // También extrae `cantidadRequerida` por insumo para mostrar/editar en el BOM.
      const normalizados: Producto[] = data.map((p: any) => ({
        ...p,
        receta: Array.isArray(p.recetaItems)
          ? p.recetaItems.map((ri: any) => ri.insumoId)
          : [],
        recetaCantidades: Array.isArray(p.recetaItems)
          ? Object.fromEntries(
              p.recetaItems.map((ri: any) => [
                ri.insumoId,
                Number(ri.cantidadRequerida) || 1,
              ]),
            )
          : {},
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
      const res = await authFetch(`${API_URL}/insumos`, {
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
      const res = await authFetch(`${API_URL}/insumos/movimientos`, {
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
      const res = await authFetch(`${API_URL}/tables`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo mesas");
      const data = await res.json();
      set({ mesas: data });
    } catch (error) {
      console.error("Error al obtener mesas:", error);
    }
  },

  createMesa: async (capacity) => {
    try {
      const res = await authFetch(`${API_URL}/tables`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ capacity }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo crear la mesa";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa: Mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      return mesa;
    } catch (error) {
      console.error("Error al crear mesa:", error);
      alert("No se pudo conectar con el servidor para crear la mesa.");
      return null;
    }
  },

  updateMesa: async (tableId, changes) => {
    try {
      const res = await authFetch(`${API_URL}/tables/${tableId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo actualizar la mesa";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa: Mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      return mesa;
    } catch (error) {
      console.error("Error al editar mesa:", error);
      alert("No se pudo conectar con el servidor para editar la mesa.");
      return null;
    }
  },

  deleteMesa: async (tableId) => {
    try {
      const res = await authFetch(`${API_URL}/tables/${tableId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo eliminar la mesa";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return false;
      }
      set((state) => ({ mesas: state.mesas.filter((mesa) => mesa.id !== tableId) }));
      return true;
    } catch (error) {
      console.error("Error al eliminar mesa:", error);
      alert("No se pudo conectar con el servidor para eliminar la mesa.");
      return false;
    }
  },

  joinMesas: async (mainTableId, tableIds) => {
    try {
      const res = await authFetch(`${API_URL}/tables/${mainTableId}/join`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ tableIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudieron unir las mesas";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa: Mesa = await res.json();
      await get().fetchMesas();
      return mesa;
    } catch (error) {
      console.error("Error al unir mesas:", error);
      alert("No se pudo conectar con el servidor para unir las mesas.");
      return null;
    }
  },

  unjoinMesas: async (tableId) => {
    try {
      const res = await authFetch(`${API_URL}/tables/${tableId}/unjoin`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudieron desagrupar las mesas";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return false;
      }
      await get().fetchMesas();
      return true;
    } catch (error) {
      console.error("Error al desagrupar mesas:", error);
      alert("No se pudo conectar con el servidor para desagrupar las mesas.");
      return false;
    }
  },

  openMesa: async (tableId, customer) => {
    try {
      const res = await authFetch(`${API_URL}/tables/${tableId}/open`, {
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
      const res = await authFetch(`${API_URL}/tables/${tableId}/items`, {
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
      const res = await authFetch(`${API_URL}/tables/${tableId}/items/${itemId}`, {
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
      const res = await authFetch(`${API_URL}/tables/${tableId}/items/${itemId}`, {
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
      const res = await authFetch(`${API_URL}/tables/${tableId}/pre-bill`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo emitir la pre-cuenta";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      return mesa;
    } catch (error) {
      console.error("Error al emitir pre-cuenta:", error);
      return null;
    }
  },

  partialPaymentMesa: async (tableId, paymentMethod, monto) => {
    try {
      const payload = {
        paymentMethod: paymentMethod === "Yape/Plin" ? "YAPE_PLIN" : paymentMethod.toUpperCase(),
        monto,
      };
      const res = await authFetch(`${API_URL}/tables/${tableId}/partial-payment`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo registrar el pago parcial";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return null;
      }
      const mesa = await res.json();
      set((state) => ({ mesas: upsertMesa(state.mesas, mesa) }));
      get().fetchPedidos();
      return mesa;
    } catch (error) {
      console.error("Error al registrar pago parcial:", error);
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
      const res = await authFetch(`${API_URL}/tables/${tableId}/checkout`, {
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
      // El cobro también disuelve el grupo, por eso se vuelve a cargar la lista.
      await get().fetchMesas();
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
      const res = await authFetch(`${API_URL}/pedidos`, {
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
          type: normalizeOrderTypeFromBackend(o.type),
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

  setCurrentUser: (user) => {
    if (user) avisoSesionExpirada = false;
    set({ currentUser: user });
  },
  logout: () => set({ currentUser: null }),

  cambiarPassword: async (actual, nueva) => {
    try {
      const res = await authFetch(`${API_URL}/auth/password`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ actual, nueva }),
      });
      return res.ok ? null : await mensajeError(res, "No se pudo cambiar la contraseña");
    } catch {
      return "No se pudo conectar con el servidor";
    }
  },

  listarUsuarios: async () => {
    try {
      const res = await authFetch(`${API_URL}/auth/usuarios`, { headers: getAuthHeaders() });
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  },

  restablecerPassword: async (userId, nueva) => {
    try {
      const res = await authFetch(`${API_URL}/auth/usuarios/${userId}/password`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ nueva }),
      });
      return res.ok ? null : await mensajeError(res, "No se pudo restablecer la contraseña");
    } catch {
      return "No se pudo conectar con el servidor";
    }
  },

  addStockMovement: async (insumoId, cantidad, tipo, motivo, _usuario = "Administrador") => {
    try {
      const res = await authFetch(`${API_URL}/insumos/${insumoId}/movimiento`, {
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

  registrarLoteStock: async (tipo, items, motivo) => {
    try {
      const ruta = tipo === "entrada" ? "entrada" : "conteo";
      const res = await authFetch(`${API_URL}/insumos/lote/${ruta}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ items, motivo }),
      });
      if (!res.ok) return await mensajeError(res, "No se pudo guardar");
      await Promise.all([get().fetchInsumos(), get().fetchMovimientos()]);
      return null;
    } catch {
      return "No se pudo conectar con el servidor";
    }
  },

  fetchAgregados: async () => {
    try {
      const res = await authFetch(`${API_URL}/agregados`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Error obteniendo agregados");
      set({ agregados: await res.json() });
    } catch (error) {
      console.error("Error al obtener agregados:", error);
    }
  },

  guardarAgregado: async (id, datos) => {
    try {
      const res = await authFetch(`${API_URL}/agregados${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(datos),
      });
      if (!res.ok) return await mensajeError(res, "No se pudo guardar el agregado");
      await get().fetchAgregados();
      return null;
    } catch {
      return "No se pudo conectar con el servidor";
    }
  },

  borrarAgregado: async (id) => {
    try {
      const res = await authFetch(`${API_URL}/agregados/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) return await mensajeError(res, "No se pudo borrar el agregado");
      await get().fetchAgregados();
      return null;
    } catch {
      return "No se pudo conectar con el servidor";
    }
  },

  updateInsumo: async (insumoId, cambios) => {
    try {
      const res = await authFetch(`${API_URL}/insumos/${insumoId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(cambios),
      });
      if (!res.ok) return await mensajeError(res, "No se pudo guardar el insumo");
      await get().fetchInsumos();
      return null;
    } catch {
      return "No se pudo conectar con el servidor";
    }
  },

  updateInsumoMinimo: async (insumoId, stockMinimo) => {
    try {
      const res = await authFetch(`${API_URL}/insumos/${insumoId}/minimo`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ stockMinimo }),
      });
      if (!res.ok) await alertarError(res, "No se pudo actualizar el stock mínimo");
      await get().fetchInsumos();
    } catch (error) {
      console.error("Error al actualizar insumo:", error);
    }
  },

  addProduct: async (producto) => {
    try {
      const res = await authFetch(`${API_URL}/productos`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(producto),
      });
      if (!res.ok) await alertarError(res, "No se pudo crear el producto");
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al agregar producto:", error);
    }
  },

  updateProduct: async (producto) => {
    try {
      const res = await authFetch(`${API_URL}/productos/${producto.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(producto),
      });
      if (!res.ok) await alertarError(res, "No se pudo actualizar el producto");
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al actualizar producto:", error);
    }
  },

  toggleProductAvailability: async (id) => {
    try {
      // Endpoint propio (no el PATCH general, que es solo del Jefe): los empleados
      // también marcan un producto como agotado durante el turno.
      const res = await authFetch(`${API_URL}/productos/${id}/toggle-availability`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) await alertarError(res, "No se pudo cambiar la disponibilidad");
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al cambiar disponibilidad:", error);
    }
  },

  deleteProduct: async (id) => {
    try {
      const res = await authFetch(`${API_URL}/productos/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) await alertarError(res, "No se pudo eliminar el producto");
      await get().fetchProductos();
    } catch (error) {
      console.error("Error al eliminar producto:", error);
    }
  },

  fetchCategorias: async () => {
    try {
      const res = await authFetch(`${API_URL}/categorias`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      set({ categorias: Array.isArray(data) ? data : [] });
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    }
  },

  addCategoria: async (nombre, tipo) => {
    try {
      const res = await authFetch(`${API_URL}/categorias`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ nombre: nombre.trim(), tipo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || "No se pudo crear la categoría");
        return false;
      }
      await get().fetchCategorias();
      return true;
    } catch (error) {
      console.error("Error al crear categoría:", error);
      alert("No se pudo crear la categoría");
      return false;
    }
  },

  deleteCategoria: async (id) => {
    try {
      const res = await authFetch(`${API_URL}/categorias/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || "No se pudo eliminar la categoría");
        return false;
      }
      await get().fetchCategorias();
      return true;
    } catch (error) {
      console.error("Error al eliminar categoría:", error);
      alert("No se pudo eliminar la categoría");
      return false;
    }
  },

  addInsumo: async (data) => {
    try {
      // El backend exige un id único: se genera un slug a partir del nombre.
      const slug = data.nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      // Necesitamos el id real de la categoría (UUID), la buscamos por nombre.
      const categoria = get().categorias.find(
        (c) => c.tipo === "INSUMO" && c.nombre === data.categoria
      );

      const res = await authFetch(`${API_URL}/insumos`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: slug || `insumo_${Date.now()}`,
          categoriaId: categoria?.id || data.categoria,
          nombre: data.nombre.trim(),
          unidadMedida: data.unidadMedida,
          stockActual: data.stockActual,
          stockMinimo: data.stockMinimo,
          costoUnitario: data.costoUnitario,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || "No se pudo crear el insumo");
        return false;
      }
      await get().fetchInsumos();
      return true;
    } catch (error) {
      console.error("Error al crear insumo:", error);
      alert("No se pudo crear el insumo");
      return false;
    }
  },

  deleteInsumo: async (id) => {
    try {
      const res = await authFetch(`${API_URL}/insumos/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || "No se pudo eliminar el insumo");
        return false;
      }
      await Promise.all([get().fetchInsumos(), get().fetchMovimientos()]);
      return true;
    } catch (error) {
      console.error("Error al eliminar insumo:", error);
      alert("No se pudo eliminar el insumo");
      return false;
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
          recetaCantidades: item.recetaCantidades || {},
          notas: item.notas,
          extras: item.extras || [],
        })),
      };

      const res = await authFetch(`${API_URL}/pedidos`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        console.error("Error al crear pedido, respuesta del servidor:", errorBody);
        const msg = errorBody?.message || "No se pudo registrar el pedido";
        // Con 401, authFetch ya avisó y cerró la sesión
        if (res.status !== 401) {
          alert(`No se pudo crear el pedido: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
        }
        return null;
      }

      const createdOrder = await res.json();
      const normalizado: Order = {
        ...createdOrder,
        status: normalizeStatusFromBackend(createdOrder.status),
        type: normalizeOrderTypeFromBackend(createdOrder.type),
        paymentMethod: normalizePaymentMethodFromBackend(createdOrder.paymentMethod),
      };
      set((state) => ({ pedidos: [normalizado, ...state.pedidos] }));
      get().fetchInsumos();
      return normalizado;
    } catch (error) {
      console.error("Error al crear pedido:", error);
      alert("No se pudo crear el pedido. Revisa tu conexión e intenta de nuevo.");
      return null;
    }
  },

  completeOrder: async (orderId) => {
    try {
      await authFetch(`${API_URL}/pedidos/${orderId}/status`, {
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
      await authFetch(`${API_URL}/pedidos/${orderId}/status`, {
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
      const res = await authFetch(`${API_URL}/pedidos/${orderId}/items/${itemId}/kitchen-status`, {
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
        type: normalizeOrderTypeFromBackend(updatedOrder.type),
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
      const res = await authFetch(`${API_URL}/caja/cierres`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error obteniendo cierres");
      const data = await res.json();
      set({ cierresCaja: data });
    } catch (error) {
      console.error("Error al obtener cierres:", error);
    }
  },

  fetchCajaEstado: async () => {
    try {
      const res = await authFetch(`${API_URL}/caja/estado`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      const data: CajaEstadoResponse = await res.json();
      set({ cajaEstado: data });
      return data;
    } catch (error) {
      console.error("Error al obtener estado de caja:", error);
      return null;
    }
  },

  fetchCajaSesiones: async () => {
    try {
      const res = await authFetch(`${API_URL}/caja/sesiones`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      set({ cajaSesiones: data });
    } catch (error) {
      console.error("Error al obtener sesiones de caja:", error);
    }
  },

  abrirCaja: async (montoInicial: number, notas?: string) => {
    try {
      const res = await authFetch(`${API_URL}/caja/abrir`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ montoInicial, notas }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo abrir la caja";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return false;
      }
      await Promise.all([get().fetchCajaEstado(), get().fetchCajaSesiones()]);
      return true;
    } catch (error) {
      console.error("Error al abrir caja:", error);
      alert("Error de conexión al abrir caja.");
      return false;
    }
  },

  cerrarCajaSesion: async (efectivoReal?: number, notas?: string) => {
    try {
      const res = await authFetch(`${API_URL}/caja/cerrar`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ efectivoReal, notas }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.message || "No se pudo cerrar la caja";
        alert(Array.isArray(msg) ? msg.join(", ") : msg);
        return false;
      }
      await Promise.all([
        get().fetchCajaEstado(),
        get().fetchCajaSesiones(),
        get().fetchCierres(),
        get().fetchPedidos(),
      ]);
      return true;
    } catch (error) {
      console.error("Error al cerrar caja:", error);
      alert("Error de conexión al cerrar caja.");
      return false;
    }
  },

  cerrarCaja: async (_usuario = "Administrador", notas = "Cierre de caja") => {
    try {
      const res = await authFetch(`${API_URL}/caja/cierre`, {
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