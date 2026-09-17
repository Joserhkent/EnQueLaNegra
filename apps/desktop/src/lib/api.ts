import type { Producto, Insumo, MovimientoStock, Order, CierreCaja, UserAccount } from "../store/usePosStore";
import { CREMA_INSUMO_MAP, AGREGADO_INSUMO_MAP } from "../constants/insumosExtras";
const API_URL = "http://localhost:3000/api";

function getHeaders() {
  const token = localStorage.getItem("eqln_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}



// --- AUTENTICACIÓN ---
// --- AUTENTICACIÓN ---
export async function loginApi(username: string, password: string): Promise<UserAccount | null> {
  try {
    const data = await apiFetch<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (data.accessToken) {
      localStorage.setItem("eqln_token", data.accessToken);
    }

    const user = data.user || data;

    // 1. Obtenemos el nombre del rol desde la API (si existe)
    const rolNombre = (data.rol?.nombre || user.rol?.nombre || user.role || "").toString().toLowerCase();

    // 2. Evaluamos si es JEFE: por rol de BD o porque el usuario ingresado es "admin"
    const isJefe = rolNombre.includes("jefe") || 
                   rolNombre.includes("admin") || 
                   username.trim().toLowerCase() === "admin";

    return {
      id: user.id || "1",
      name: user.name || (isJefe ? "Administrador" : "Empleado"),
      username: user.username || username,
      role: isJefe ? "jefe" : "empleado", // 👈 Asigna 'jefe' para admin, 'empleado' para empleado
      turn: user.turn || "Mañana",
    };
  } catch (error) {
    console.error("Error en login:", error);
    return null;
  }
}
// --- INSUMOS Y PRODUCTOS ---
export async function fetchInsumosApi(): Promise<Insumo[]> {
  const data = await apiFetch<any[]>("/insumos");
  return data.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    unidadMedida: i.unidadMedida,
    stockActual: i.stockActual,
    stockMinimo: i.stockMinimo,
    costoUnitario: i.costoUnitario,
    categoria: i.categoria?.nombre || "Panes y Carnes",
  }));
}

export async function fetchProductosApi(): Promise<Producto[]> {
  const data = await apiFetch<any[]>("/productos");
  return data.map((p) => ({
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    // Asegura que no rompa si categoria viene como texto plano o como objeto relacional
    categoria: typeof p.categoria === "object" ? (p.categoria?.nombre || "General") : (p.categoria || "General"),
    precio: Number(p.precio),
    isAvailable: p.isAvailable ?? true,
    isPopular: p.isPopular ?? false,
    descripcion: p.descripcion || "",
    iconoEmoji: p.iconoEmoji || "🍔",
    receta: p.recetaItems ? p.recetaItems.map((r: any) => r.insumoId) : [],
  }));
}

export async function fetchMovimientosApi(): Promise<MovimientoStock[]> {
  const data = await apiFetch<any[]>("/insumos/movimientos");
  return data.map((m) => ({
    id: m.id,
    insumoId: m.insumoId,
    tipo: m.tipo.toLowerCase() as "entrada" | "salida" | "ajuste",
    cantidad: m.cantidad,
    motivo: m.motivo,
    fecha:
      typeof m.fecha === "string"
        ? m.fecha.replace("T", " ").substring(0, 16)
        : new Date(m.fecha).toISOString().replace("T", " ").substring(0, 16),
    usuario: m.usuario || "Sistema POS",
  }));
}

// --- PEDIDOS (SINCRONIZADO CON NESTJS) ---
export async function fetchPedidosApi(productos: Producto[]): Promise<Order[]> {
  const data = await apiFetch<any[]>("/pedidos");
  return data.map((o) => {
    const items = (o.items || []).map((it: any) => {
      const prod = productos.find((p) => p.id === it.productoId || p.sku === it.sku);
      return {
        sku: it.sku,
        nombre: it.nombre,
        precio: it.precio,
        cantidad: it.cantidad,
        notas: it.notas || "",
        cremas: [] as string[], // el backend no distingue cremas de agregados, ambos son "extras"
        agregados: (it.extras || []).map((e: any) => ({
          nombre: e.insumo?.nombre || e.insumoId,
          precio: e.precioExtra,
        })),
        receta: prod ? prod.receta : [],
      };
    });

    let paymentMethod: Order["paymentMethod"] = "Efectivo";
    if (o.paymentMethod === "MIXTO") {
      paymentMethod = "Mixto";
    } else if (o.pagos && o.pagos.length > 0) {
      const p = o.pagos[0].metodoPago;
      if (p === "YAPE_PLIN") paymentMethod = "Yape/Plin";
      else paymentMethod = "Efectivo";
    } else if (o.paymentMethod === "YAPE_PLIN") paymentMethod = "Yape/Plin";

    let type: Order["type"] = "Mesa";
    if (o.type === "LLEVAR") type = "Llevar";
    if (o.type === "DELIVERY") type = "Delivery";

    return {
      id: o.id,
      code: o.code,
      customer: o.customer,
      items,
      total: o.total,
      type,
      paymentMethod,
      montoEfectivo: o.montoEfectivo,
      montoDigital: o.montoDigital,
      status: o.status.toLowerCase() as Order["status"],
      fecha: o.fecha,
      hora: o.hora,
    };
  });
}

export async function createPedidoApi(order: any, productos: Producto[]): Promise<any> {
  const paymentMethod =
    order.paymentMethod === "Yape/Plin"
      ? "YAPE_PLIN"
      : order.paymentMethod === "Mixto"
      ? "MIXTO"
      : "EFECTIVO";

  const type = order.type === "Llevar" ? "LLEVAR" : order.type === "Delivery" ? "DELIVERY" : "MESA";

  const payload = {
    code: order.code,
    customer: order.customer,
    type,
    paymentMethod,
    ...(paymentMethod === "MIXTO" && {
      montoEfectivo: Number(order.montoEfectivo || 0),
      montoDigital: Number(order.montoDigital || 0),
    }),
    items: order.items.map((item: any) => {
      const prod = productos.find((p) => p.sku === item.sku || p.id === item.productoId);

      // Cremas: se buscan por nombre en el mapeo, siempre precioExtra 0 (no se cobran, sí descuentan stock)
      const extrasFromCremas = (item.cremas || [])
        .map((nombreCrema: string) => {
          const insumoId = CREMA_INSUMO_MAP[nombreCrema];
          if (!insumoId) return null;
          return { insumoId, cantidad: 1, precioExtra: 0 };
        })
        .filter(Boolean);

      // Agregados: se buscan por nombre, llevan su propio precioExtra (lo que se le cobra al cliente)
      const extrasFromAgregados = (item.agregados || [])
        .map((ag: { nombre: string; precio: number }) => {
          const mapping = AGREGADO_INSUMO_MAP[ag.nombre];
          if (!mapping) return null;
          return { insumoId: mapping.insumoId, cantidad: 1, precioExtra: ag.precio ?? mapping.precio };
        })
        .filter(Boolean);

      const extras = [...extrasFromCremas, ...extrasFromAgregados];

      return {
        productoId: prod?.id || item.productoId,
        sku: item.sku,
        nombre: item.nombre,
        precio: Number(item.precio),
        cantidad: Number(item.cantidad),
        notas: item.notas || undefined,
        extras: extras.length > 0 ? extras : undefined,
      };
    }),
  };

  return apiFetch("/pedidos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrderStatusApi(orderId: string, status: string): Promise<any> {
  return apiFetch(`/pedidos/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: status.toUpperCase() }),
  });
}

// --- OTROS MÓDULOS ---
export async function fetchCierresApi(): Promise<CierreCaja[]> {
  const data = await apiFetch<any[]>("/caja/cierres");
  return data.map((c) => ({
    id: c.id,
    fecha: c.fecha,
    hora: c.hora,
    totalVendido: c.totalVendido,
    efectivo: c.efectivo,
    yapePlin: c.yapePlin,
    tarjeta: c.tarjeta,
    cantidadPedidos: c.cantidadPedidos,
    usuario: c.user?.name || c.usuario || "Administrador",
    notas: c.notas,
  }));
}

export async function addStockMovementApi(
  insumoId: string,
  cantidad: number,
  tipo: "entrada" | "salida" | "ajuste",
  motivo: string
): Promise<any> {
  const delta = tipo === "salida" ? -cantidad : cantidad;
  return apiFetch(`/insumos/${insumoId}/movimiento`, {
    method: "POST",
    body: JSON.stringify({ cantidad: delta, motivo }),
  });
}

export async function updateInsumoMinimoApi(insumoId: string, stockMinimo: number): Promise<any> {
  return apiFetch(`/insumos/${insumoId}/minimo`, {
    method: "PATCH",
    body: JSON.stringify({ stockMinimo }),
  });
}

export async function createProductoApi(producto: Producto): Promise<any> {
  return apiFetch("/productos", {
    method: "POST",
    body: JSON.stringify(producto),
  });
}

export async function updateProductoApi(producto: Producto): Promise<any> {
  return apiFetch(`/productos/${producto.id}`, {
    method: "PUT",
    body: JSON.stringify(producto),
  });
}

export async function toggleProductAvailabilityApi(id: string): Promise<any> {
  return apiFetch(`/productos/${id}/toggle-availability`, {
    method: "PATCH",
  });
}

export async function deleteProductApi(id: string): Promise<any> {
  return apiFetch(`/productos/${id}`, {
    method: "DELETE",
  });
}

export async function cerrarCajaApi(notas?: string): Promise<any> {
  return apiFetch("/caja/cierre", {
    method: "POST",
    body: JSON.stringify({ notas: notas || "Cierre de turno registrado" }),
  });
}