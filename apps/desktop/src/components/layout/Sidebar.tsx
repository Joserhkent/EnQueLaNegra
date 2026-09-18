import {
  LayoutDashboard,
  LayoutGrid,
  UtensilsCrossed,
  ShoppingBag,
  CreditCard,
  Boxes,
  History,
  UserCheck,
  Shield,
  LogOut,
  type LucideIcon
} from "lucide-react";
import { usePosStore } from "../../store/usePosStore";

type SidebarProps = {
  activePage: "dashboard" | "mesas" | "productos" | "pedidos" | "pagos" | "inventario" | "historial";
  onChangePage: (page: SidebarProps["activePage"]) => void;
  onLogout: () => void;
};

interface MenuItem {
  key: SidebarProps["activePage"];
  label: string;
  icon: LucideIcon;
  badge?: string;
  badgeAlert?: boolean;
  jefeOnly?: boolean;
}

export default function Sidebar({ activePage, onChangePage, onLogout }: SidebarProps) {
  const { currentUser, pedidos = [], insumos = [], mesas = [] } = usePosStore();

  const isJefe = currentUser?.role === "jefe";

  // Conteo en vivo de comandas activas en cocina (en preparación o listas)
  const activeOrdersCount = pedidos.filter(
    (p) => p.status === "preparacion" || p.status === "listo"
  ).length;

  // Conteo en vivo de mesas ocupadas o pidiendo cuenta
  const activeMesasCount = mesas.filter(
    (m) => m.status === "OCCUPIED" || m.status === "BILLING"
  ).length;

  // Alerta en vivo si hay insumos en o por debajo del stock mínimo
  const hasCriticalStock = insumos.some(
    (i) => i.stockActual <= i.stockMinimo
  );

  const allMenuItems: MenuItem[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, jefeOnly: true },
    {
      key: "mesas",
      label: "Mesas",
      icon: LayoutGrid,
      badge: activeMesasCount > 0 ? String(activeMesasCount) : undefined,
    },
    { key: "productos", label: "Productos", icon: UtensilsCrossed },
    {
      key: "pedidos",
      label: "Pedidos",
      icon: ShoppingBag,
      badge: activeOrdersCount > 0 ? String(activeOrdersCount) : undefined,
    },
    { key: "pagos", label: "Pagos", icon: CreditCard },
    {
      key: "inventario",
      label: "Inventario",
      icon: Boxes,
      badgeAlert: hasCriticalStock,
    },
    { key: "historial", label: "Historial", icon: History, jefeOnly: true },
  ];

  // Filter menu items according to permissions matrix
  const menuItems = allMenuItems.filter((item) => {
    if (item.jefeOnly && !isJefe) return false;
    return true;
  });

  return (
    <aside className="h-screen w-[280px] bg-slate-900 text-white flex flex-col justify-between p-5 border-r border-slate-800 shrink-0 sticky top-0">
      <div className="space-y-8">
        {/* Brand Logo & Header */}
        <div className="px-2 pt-2">
          <img src="/logo.jpg" alt="En que la Negra" className="w-full rounded-2xl object-contain" />
        </div>

        {/* User Card with Role Badge */}
        <div className="bg-slate-800/60 border border-slate-700/50 p-3.5 rounded-2xl flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${isJefe ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
            {isJefe ? <Shield className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold text-white truncate">{currentUser?.name || "Usuario POS"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${isJefe ? "bg-amber-500 text-slate-950" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"}`}>
                {isJefe ? "Rol Jefe" : "Rol Empleado"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{currentUser?.turn || "Lun - Dom"}</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Menú Principal</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activePage;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChangePage(item.key)}
                className={`flex w-full items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20 translate-x-1"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? "bg-slate-950 text-amber-400" : "bg-amber-500/20 text-amber-400"}`}>
                    {item.badge}
                  </span>
                )}

                {item.badgeAlert && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status & Logout */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </span>
        </button>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 font-medium">
          <span>Servidor API</span>
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Conectado
          </span>
        </div>
      </div>
    </aside>
  );
}
