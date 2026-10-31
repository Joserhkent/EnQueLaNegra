import { useEffect, useMemo, useState } from "react";
import { usePosStore, type Order, type OrderItem } from "../store/usePosStore";
import { ChefHat, Clock, CheckCircle2, Circle, Flame, UtensilsCrossed, ShoppingBag, Printer } from "lucide-react";
import { activarEstacionComandas, comandasActuales, esEstacionComandas } from "../lib/estacionComandas";

function isOlderThan(startIso: string | null | undefined, ms: number): boolean {
  return startIso ? Date.now() - new Date(startIso).getTime() > ms : false;
}

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

// Ciclo real de un ítem en cocina (coincide con el enum ItemKitchenStatus de Prisma):
// PENDING (no empezado) -> IN_KITCHEN (en preparación) -> DELIVERED (listo/entregado) -> vuelve a PENDING.
const KITCHEN_STATUS_ORDER = ["PENDING", "IN_KITCHEN", "DELIVERED"] as const;
type KitchenStatus = (typeof KITCHEN_STATUS_ORDER)[number];

const nextKitchenStatus = (current?: string): KitchenStatus => {
  const idx = KITCHEN_STATUS_ORDER.indexOf((current as KitchenStatus) || "PENDING");
  return KITCHEN_STATUS_ORDER[(idx + 1) % KITCHEN_STATUS_ORDER.length];
};

// Una tarjeta de cocina = una tanda que debe prepararse junta: una ronda de una
// mesa, o un pedido completo para llevar/delivery.
type KitchenTicket = {
  ticketId: string;
  title: string;
  subtitle: string;
  createdAt?: string | null;
  items: OrderItem[];
  kind: "mesa" | "pedido";
  tableId?: string;
  orderId?: string;
};

export default function KitchenPage() {
  const {
    mesas,
    pedidos,
    fetchMesas,
    fetchPedidos,
    updateMesaItem,
    updateOrderItemKitchenStatus,
    updateOrderStatus,
    currentUser,
  } = usePosStore();

  useEffect(() => {
    fetchMesas();
    fetchPedidos();
    const interval = setInterval(() => {
      fetchMesas();
      fetchPedidos();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tickets = useMemo<KitchenTicket[]>(() => {
    const list: KitchenTicket[] = [];

    mesas
      .filter((m) => (m.status === "OCCUPIED" || m.status === "BILLING") && m.currentOrder?.items.length)
      .forEach((mesa) => {
        const order = mesa.currentOrder as Order;
        const porRonda = new Map<number, OrderItem[]>();
        order.items.forEach((item) => {
          const ronda = item.ronda ?? 1;
          if (!porRonda.has(ronda)) porRonda.set(ronda, []);
          porRonda.get(ronda)!.push(item);
        });
        [...porRonda.entries()]
          .sort((a, b) => a[0] - b[0])
          .forEach(([ronda, items]) => {
            list.push({
              ticketId: `mesa-${mesa.id}-r${ronda}`,
              title: `Mesa #${mesa.number}`,
              subtitle: `Ronda ${ronda}`,
              createdAt: order.createdAt,
              items,
              kind: "mesa",
              tableId: mesa.id,
            });
          });
      });

    pedidos
      .filter((o) => o.status === "preparacion" && (o.type === "Llevar" || o.type === "Delivery"))
      .forEach((order) => {
        list.push({
          ticketId: `pedido-${order.id}`,
          title: order.code,
          subtitle: `${order.type} · ${order.customer}`,
          createdAt: order.createdAt,
          items: order.items,
          kind: "pedido",
          orderId: order.id,
        });
      });

    return list.sort((a, b) => {
      const aReady = a.items.every((i) => i.kitchenStatus === "DELIVERED");
      const bReady = b.items.every((i) => i.kitchenStatus === "DELIVERED");
      if (aReady !== bReady) return aReady ? 1 : -1;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
  }, [mesas, pedidos]);

  const toggleItem = async (ticket: KitchenTicket, item: OrderItem) => {
    if (!item.id) return;
    const nuevoEstado = nextKitchenStatus(item.kitchenStatus);
    if (ticket.kind === "mesa" && ticket.tableId) {
      await updateMesaItem(ticket.tableId, item.id, { kitchenStatus: nuevoEstado });
    } else if (ticket.kind === "pedido" && ticket.orderId) {
      await updateOrderItemKitchenStatus(ticket.orderId, item.id, nuevoEstado);
    }
  };

  // Marca TODOS los ítems de la tarjeta como DELIVERED de un solo clic (reutiliza
  // los mismos endpoints del toggle individual). Para pedidos de llevar/delivery,
  // además avanza el pedido completo a "listo" para que aparezca en esa pestaña
  // de la vista de Pedidos. Las mesas no cambian de estado acá — eso lo sigue
  // manejando por completo la vista de Mesas hasta que se cobra.
  const markTicketReady = async (ticket: KitchenTicket) => {
    await Promise.all(
      ticket.items
        .filter((item) => item.id && item.kitchenStatus !== "DELIVERED")
        .map((item) =>
          ticket.kind === "mesa" && ticket.tableId
            ? updateMesaItem(ticket.tableId, item.id!, { kitchenStatus: "DELIVERED" })
            : ticket.kind === "pedido" && ticket.orderId
            ? updateOrderItemKitchenStatus(ticket.orderId, item.id!, "DELIVERED")
            : Promise.resolve(null)
        )
    );

    if (ticket.kind === "pedido" && ticket.orderId) {
      await updateOrderStatus(ticket.orderId, "listo");
    }
  };

  const isAllReady = (items: OrderItem[]) => items.length > 0 && items.every((i) => i.kitchenStatus === "DELIVERED");

  // Estación de comandas: el equipo con la ticketera imprime solo cada tanda nueva
  const [esEstacion, setEsEstacion] = useState(esEstacionComandas);
  const cambiarEstacion = (activa: boolean) => {
    activarEstacionComandas(activa, comandasActuales(mesas, pedidos));
    setEsEstacion(activa);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-3xl text-slate-900 flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-slate-900" /> Cocina
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Toca un plato para pasarlo a preparación y otra vez para marcarlo listo.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-sm font-bold whitespace-nowrap">
          {tickets.filter((t) => !isAllReady(t.items)).length} pendientes
        </span>
      </div>

      {(currentUser?.role === "jefe" || esEstacion) && (
      <label
        className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
          esEstacion ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <input
          type="checkbox"
          checked={esEstacion}
          onChange={(e) => cambiarEstacion(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-emerald-600 shrink-0"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Printer className="w-4 h-4" /> Este equipo imprime las comandas
          </span>
          <span className="block text-xs text-slate-600 mt-0.5">
            {esEstacion
              ? "Activo: cada tanda nueva se imprime aquí sola, aunque la envíen desde un celular. Deja la app abierta."
              : "Actívalo solo en la laptop que tiene la ticketera. Los demás equipos solo envían."}
          </span>
        </span>
      </label>
      )}

      {tickets.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm bg-white rounded-lg border border-dashed border-slate-300">
          Sin comandas pendientes.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {tickets.map((ticket) => {
            const allReady = isAllReady(ticket.items);
            const elapsed = formatElapsed(ticket.createdAt);
            const isSlow = isOlderThan(ticket.createdAt, 20 * 60 * 1000);

            return (
              <div
                key={ticket.ticketId}
                className={`min-w-0 p-4 rounded-lg border border-t-4 transition-colors ${
                  allReady
                    ? "bg-emerald-50 border-emerald-200 border-t-emerald-500"
                    : isSlow
                    ? "bg-white border-rose-200 border-t-rose-600"
                    : "bg-white border-slate-200 border-t-slate-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex min-w-0 items-center gap-1.5 font-display text-xl text-slate-900">
                    {ticket.kind === "mesa" ? (
                      <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="break-words">{ticket.title}</span>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${
                      isSlow && !allReady ? "text-rose-600" : "text-slate-500"
                    }`}
                  >
                    <Clock className="w-3 h-3" /> {elapsed}
                  </span>
                </div>
                <div className="mb-3 break-words text-xs text-slate-500">{ticket.subtitle}</div>

                <div className="space-y-1.5">
                  {ticket.items.map((item) => {
                    const status = (item.kitchenStatus as KitchenStatus) || "PENDING";
                    const ready = status === "DELIVERED";
                    const cooking = status === "IN_KITCHEN";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(ticket, item)}
                        className={`flex w-full min-w-0 items-start gap-2 rounded-md p-2 text-left transition ${
                          ready ? "bg-emerald-100/60" : cooking ? "bg-amber-100/60" : "bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        {ready ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : cooking ? (
                          <Flame className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className={`break-words whitespace-normal text-sm font-semibold ${
                              ready ? "text-emerald-700 line-through" : cooking ? "text-amber-700" : "text-slate-800"
                            }`}
                          >
                            {item.cantidad}x {item.nombre}
                          </div>
                          {item.notas && (
                            <div className="mt-1 break-words whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                              "{item.notas}"
                            </div>
                          )}
                          {item.extras && item.extras.length > 0 && (
                            <div className="mt-1 break-words whitespace-normal text-xs leading-relaxed text-slate-600">
                              + {item.extras.map((e) => e.insumo?.nombre).filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {allReady ? (
                  <div className="mt-3 pt-3 border-t border-emerald-200 text-center text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Todo listo
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => markTicketReady(ticket)}
                    className="mt-3 w-full py-2.5 bg-slate-900 hover:bg-emerald-600 text-white font-bold rounded-md text-sm transition-colors active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ticket.kind === "mesa" ? "Tanda lista" : "Pedido listo"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}