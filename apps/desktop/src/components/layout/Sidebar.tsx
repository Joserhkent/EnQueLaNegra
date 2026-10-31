import { useState, useEffect } from "react";
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
  ChefHat,
  LogOut,
  Menu,
  X,
  Download,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { usePosStore } from "../../store/usePosStore";
import CuentaModal from "../CuentaModal";

type SidebarProps = {
  activePage:
    | "dashboard"
    | "mesas"
    | "pedidos"
    | "cocina"
    | "productos"
    | "pagos"
    | "inventario"
    | "historial";
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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Sidebar({
  activePage,
  onChangePage,
  onLogout,
}: SidebarProps) {
  const { currentUser, pedidos = [], insumos = [], mesas = [], cajaEstado } = usePosStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCuentaOpen, setIsCuentaOpen] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const isJefe = currentUser?.role === "jefe";

  // Conteo en vivo de comandas activas en cocina (en preparación o listas)
  const activeOrdersCount = pedidos.filter(
    (p) => p.status === "preparacion" || p.status === "listo"
  ).length;

  // Conteo en vivo de mesas ocupadas o pidiendo cuenta
  const activeMesasCount = mesas.filter(
    (m) => m.status === "OCCUPIED" || m.status === "BILLING"
  ).length;

  // Ítems pendientes en cocina: tandas de mesas activas + pedidos para llevar/delivery en preparación
  const pendingKitchenItems =
    mesas.reduce((acc, m) => {
      if (m.status !== "OCCUPIED" && m.status !== "BILLING") return acc;
      return (
        acc +
        (m.currentOrder?.items.filter((i) => i.kitchenStatus !== "READY")
          .length ?? 0)
      );
    }, 0) +
    pedidos
      .filter((p) => p.status === "preparacion")
      .reduce(
        (acc, p) =>
          acc +
          p.items.filter((i) => i.kitchenStatus !== "READY").length,
        0
      );

  // Alerta en vivo si hay insumos en o por debajo del stock mínimo
  const hasCriticalStock = insumos.some(
    (i) => i.stockActual <= i.stockMinimo
  );

  const allMenuItems: MenuItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      jefeOnly: true,
    },
    {
      key: "mesas",
      label: "Mesas",
      icon: LayoutGrid,
      badge: activeMesasCount > 0 ? String(activeMesasCount) : undefined,
    },
    {
      key: "pedidos",
      label: "Pedidos",
      icon: ShoppingBag,
      badge: activeOrdersCount > 0 ? String(activeOrdersCount) : undefined,
    },
    {
      key: "cocina",
      label: "Cocina",
      icon: ChefHat,
      badge: pendingKitchenItems > 0 ? String(pendingKitchenItems) : undefined,
    },
    { key: "productos", label: "Productos", icon: UtensilsCrossed },
    { key: "pagos", label: "Pagos / Caja", icon: CreditCard },
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

  const renderNavContent = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Brand Logo & Header */}
        <div className="px-2 pt-2 flex items-center justify-between">
          <img
            src="/logo.jpg"
            alt="En que la Negra"
            className="w-full max-h-16 rounded-lg object-contain bg-black"
          />
          {isMobile && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white ml-2"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User Card with Role Badge: abre "Mi cuenta" (cambiar contraseña) */}
        <button
          type="button"
          onClick={() => {
            setIsMobileOpen(false);
            setIsCuentaOpen(true);
          }}
          title="Mi cuenta: cambiar contraseña"
          className="w-full text-left bg-slate-800/60 border border-slate-700/50 hover:border-amber-500/60 hover:bg-slate-800 p-3.5 rounded-lg flex items-center gap-3 transition"
        >
          <div
            className={`w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm ${
              isJefe
                ? "bg-amber-500/20 text-amber-400"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {isJefe ? (
              <Shield className="w-5 h-5" />
            ) : (
              <UserCheck className="w-5 h-5" />
            )}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold text-white truncate">
              {currentUser?.name || "Usuario"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                  isJefe
                    ? "bg-amber-500 text-slate-950"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {isJefe ? "Jefe" : "Mesonero"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              {currentUser?.turn || "Lun - Dom"}
            </p>
          </div>
          <KeyRound className="w-4 h-4 text-slate-500 shrink-0" />
        </button>

        {/* Navigation Menu */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activePage;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChangePage(item.key);
                  if (isMobile) setIsMobileOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-amber-500 text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-slate-950" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      isActive
                        ? "bg-slate-950 text-amber-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
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

        {/* PWA Install Button (if available) */}
        {installPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Instalar app</span>
          </button>
        )}
      </div>

      {/* Footer System Status & Logout */}
      <div className="pt-4 border-t border-slate-800 space-y-3 shrink-0">
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </span>
        </button>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 font-medium">
          <span>Caja</span>
          <span
            className={`flex items-center gap-1 font-semibold ${
              cajaEstado?.isOpen ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                cajaEstado?.isOpen ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {cajaEstado?.isOpen ? "Abierta" : "Cerrada"}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="franja-marca absolute inset-x-0 top-0 h-[3px]" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-md bg-slate-800 text-white hover:bg-slate-700 transition"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/pwa-192x192.png"
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain bg-black"
            />
            <span className="font-bold text-white text-sm truncate max-w-[120px] sm:max-w-none">En que la Negra</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1"
              title="Instalar App"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
              cajaEstado?.isOpen
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}
          >
            {cajaEstado?.isOpen ? "Caja Abierta" : "Caja Cerrada"}
          </span>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setIsMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-[280px] bg-slate-900 text-white p-5 border-r border-slate-800 shadow-xl z-50">
            {renderNavContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex h-screen w-[260px] bg-slate-900 text-white flex-col justify-between p-4 pt-5 border-r border-slate-800 shrink-0 sticky top-0">
        <div className="franja-marca absolute inset-x-0 top-0 h-[3px]" aria-hidden="true" />
        {renderNavContent(false)}
      </aside>

      {isCuentaOpen && <CuentaModal onClose={() => setIsCuentaOpen(false)} />}
    </>
  );
}
