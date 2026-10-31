import { useState, useEffect, type ComponentType } from "react";
import Sidebar from "./components/layout/Sidebar";
import DashboardPage from "./features/DashboardPage";
import MesasPage from "./features/MesasPage";
import ProductosPage from "./features/ProductosPage";
import PedidosPage from "./features/PedidosPage";
import PagosPage from "./features/PagosPage";
import InventarioPage from "./features/InventarioPage";
import HistorialPage from "./features/HistorialPage";
import LoginPage from "./features/LoginPage";
import ErrorBoundary from "./components/ErrorBoundary";
import PwaInstallBanner from "./components/PwaInstallBanner";
import { API_URL, usePosStore, type UserAccount } from "./store/usePosStore";
import KitchenPage from "./features/kitchenPage";

const pages = {
  dashboard: DashboardPage,
  mesas: MesasPage,
  pedidos: PedidosPage,
  cocina: KitchenPage,
  productos: ProductosPage,
  pagos: PagosPage,
  inventario: InventarioPage,
  historial: HistorialPage,
} as const;

type PageKey = keyof typeof pages;

async function loginWithApi(username: string, password: string) {
  let response: Response;
  try {
    // Misma base que el resto de la app (VITE_API_URL ya incluye /api): antes el login
    // agregaba "/api" por su cuenta y quedaba desalineado si se definía VITE_API_URL.
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    const err = new Error("Servidor API no disponible");
    (err as unknown as { isNetworkError: boolean }).isNetworkError = true;
    throw err;
  }

  if (!response.ok) {
    let errorText: string;
    try {
      const errJson = await response.json();
      errorText = Array.isArray(errJson.message) ? errJson.message.join(", ") : (errJson.message || errJson.error || "");
    } catch {
      errorText = await response.text();
    }
    const err = new Error(errorText || "Credenciales inválidas");
    (err as unknown as { status: number }).status = response.status;
    throw err;
  }

  return response.json();
}

export default function App() {
  const {
    currentUser,
    setCurrentUser,
    logout: storeLogout,
    fetchProductos,
    fetchInsumos,
    fetchPedidos,
    fetchMesas,
    fetchCajaEstado,
  } = usePosStore();

  // La sesión guardada (localStorage) ya la carga el store al iniciar, así que la
  // primera pantalla sale correcta sin pasar por el login ni por un efecto.
  const [activePage, setActivePage] = useState<PageKey>(() =>
    usePosStore.getState().currentUser?.role === "empleado" ? "mesas" : "dashboard"
  );
  const [authError, setAuthError] = useState("");

  // Si la sesión expira, authFetch (store) limpia currentUser y se vuelve al login;
  // al entrar de nuevo se recarga todo.
  const sesionActiva = !!currentUser;

  // 🔥 Apenas la sesión quede activa, cargamos TODOS los datos inmediatamente
  useEffect(() => {
    if (!sesionActiva) return;
    console.log("⚡ Cargando base de datos inicial...");
    Promise.all([
      fetchProductos(),
      fetchInsumos(),
      fetchPedidos(),
      fetchMesas(),
      fetchCajaEstado(),
    ])
      .then(() => console.log("✅ Toda la base de datos cargada con éxito"))
      .catch((error) => console.error("❌ Error al cargar la base de datos:", error));
  }, [sesionActiva, fetchProductos, fetchInsumos, fetchPedidos, fetchMesas, fetchCajaEstado]);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    setAuthError("");

    if (!username.trim() || !password.trim()) {
      setAuthError("Ingrese usuario y contraseña");
      return false;
    }

    try {
      const data = await loginWithApi(username, password);
      
      const apiRole = (data.user?.role || data.user?.rol?.nombre || "").toString().toLowerCase();
      
      const isJefeRole = apiRole.includes("jefe") || 
                         apiRole.includes("admin") || 
                         username.trim().toLowerCase() === "admin";

      const user: UserAccount = {
        id: data.user?.id || "u-api",
        name: data.user?.name || username,
        username: data.user?.username || username,
        role: isJefeRole ? "jefe" : "empleado",
        turn: data.user?.turn || "Lun - Dom",
      };

      const token = data.accessToken || data.token || "demo-token";

      localStorage.setItem("eqln_token", token);
      localStorage.setItem("eqln_user", JSON.stringify(user));
      setCurrentUser(user);
      setActivePage(user.role === "empleado" ? "mesas" : "dashboard");

      return true;
    } catch (apiError: unknown) {
      const err = apiError as { status?: number; isNetworkError?: boolean; message?: string };

      if (err.status === 401 || err.status === 400) {
        setAuthError(err.message || "Credenciales inválidas");
        return false;
      }

      if (err.isNetworkError) {
        setAuthError(
          "No se pudo conectar con el servidor. Verifica que la API esté corriendo (npm run dev) en el puerto 3000."
        );
        return false;
      }

      setAuthError(err.message || "Credenciales inválidas");
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("eqln_token");
    localStorage.removeItem("eqln_user");
    storeLogout();
    setAuthError("");
    setActivePage("dashboard");
  };

  if (!sesionActiva) {
    return (
      <>
        <LoginPage onLogin={handleLogin} authError={authError} />
        <PwaInstallBanner />
      </>
    );
  }

  const isJefe = currentUser?.role === "jefe";
  const isRestrictedPage = (activePage === "dashboard" || activePage === "historial") && !isJefe;
  const pageToRender = isRestrictedPage ? "mesas" : activePage;
  // "pedidos" se renderiza aparte (necesita onGoToMesas); el resto no toma props.
  const ActivePageComponent = pages[pageToRender] as ComponentType<object>;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#F4F5F7]">
      <Sidebar activePage={pageToRender} onChangePage={setActivePage} onLogout={handleLogout} />
      <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">
        <ErrorBoundary key={pageToRender} fallbackTitle="Esta sección no se pudo cargar">
          {pageToRender === "pedidos" ? (
            <PedidosPage onGoToMesas={() => setActivePage("mesas")} />
          ) : (
            <ActivePageComponent />
          )}
        </ErrorBoundary>
      </main>
      <PwaInstallBanner />
    </div>
  );
}