import { useEffect, useMemo } from "react";
import { usePosStore, type Order, type OrderItem } from "../store/usePosStore";
import { ChefHat, Clock, CheckCircle2, Circle, Flame, UtensilsCrossed, ShoppingBag } from "lucide-react";

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

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      <div className="flex items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-500" /> Cocina
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Toca un ítem para avanzar su estado: pendiente → en preparación → listo. O marca toda la tanda de una vez.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
          {tickets.filter((t) => !isAllReady(t.items)).length} pendientes
        </span>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm font-medium bg-white rounded-3xl border border-slate-200/80">
          No hay tandas pendientes en este momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tickets.map((ticket) => {
            const allReady = isAllReady(ticket.items);
            const elapsed = formatElapsed(ticket.createdAt);
            const isSlow = ticket.createdAt
              ? Date.now() - new Date(ticket.createdAt).getTime() > 20 * 60 * 1000
              : false;

            return (
              <div
                key={ticket.ticketId}
                className={`p-4 rounded-3xl border-2 shadow-sm transition ${
                  allReady
                    ? "bg-emerald-50 border-emerald-300"
                    : isSlow
                    ? "bg-rose-50 border-rose-300"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
                    {ticket.kind === "mesa" ? (
                      <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                    )}
                    {ticket.title}
                  </div>
                  <span
                    className={`flex items-center gap-1 text-[10px] font-bold ${
                      isSlow && !allReady ? "text-rose-600" : "text-slate-400"
                    }`}
                  >
                    <Clock className="w-3 h-3" /> {elapsed}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-semibold mb-3">{ticket.subtitle}</div>

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
                        className={`w-full flex items-start gap-2 p-2 rounded-xl text-left transition ${
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
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-bold ${
                              ready ? "text-emerald-700 line-through" : cooking ? "text-amber-700" : "text-slate-800"
                            }`}
                          >
                            {item.cantidad}x {item.nombre}
                          </div>
                          {item.notas && (
                            <div className="text-[10px] text-slate-400 italic truncate">"{item.notas}"</div>
                          )}
                          {item.extras && item.extras.length > 0 && (
                            <div className="text-[10px] text-slate-400 truncate">
                              + {item.extras.map((e) => e.insumo?.nombre).filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {allReady ? (
                  <div className="mt-3 pt-3 border-t border-emerald-200 text-center text-[11px] font-extrabold text-emerald-700 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Todo Listo
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => markTicketReady(ticket)}
                    className="mt-3 w-full py-2.5 bg-slate-900 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-[11px] transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ticket.kind === "mesa" ? "Marcar Ronda Lista" : "Pedido Listo"}
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