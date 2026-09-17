import { useState, useEffect } from "react";
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
import { usePosStore, type UserAccount } from "./store/usePosStore";

const pages = {
  dashboard: DashboardPage,
  mesas: MesasPage,
  productos: ProductosPage,
  pedidos: PedidosPage,
  pagos: PagosPage,
  inventario: InventarioPage,
  historial: HistorialPage,
} as const;

type PageKey = keyof typeof pages;

async function loginWithApi(username: string, password: string) {
  let response: Response;
  try {
    response = await fetch("http://localhost:3000/api/auth/login", {
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
    let errorText = "";
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
    login: storeLogin, 
    logout: storeLogout,
    fetchProductos,
    fetchInsumos,
    fetchPedidos,
    fetchMesas,
  } = usePosStore();

  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");

  // Carga masiva de la base de datos desde NestJS
  const cargarTodaLaBaseDeDatos = async () => {
    try {
      console.log("⚡ Cargando base de datos inicial...");
      await Promise.all([
        fetchProductos(),
        fetchInsumos(),
        fetchPedidos(),
        fetchMesas(),
      ]);
      console.log("✅ Toda la base de datos cargada con éxito");
    } catch (error) {
      console.error("❌ Error al cargar la base de datos:", error);
    }
  };

  // 1. Restaurar sesión al abrir la página
  useEffect(() => {
    const savedUserStr = localStorage.getItem("eqln_user");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr) as UserAccount;
        setCurrentUser(user);
        setIsLoggedIn(true);
        setActivePage(user.role === "empleado" ? "mesas" : "dashboard");
      } catch {
        localStorage.removeItem("eqln_user");
        localStorage.removeItem("eqln_token");
        setCurrentUser(null);
        setIsLoggedIn(false);
      }
    } else {
      setCurrentUser(null);
      setIsLoggedIn(false);
    }
  }, []);

  // 2. 🔥 EFECTO CLAVE: Apenas 'isLoggedIn' cambie a TRUE, cargamos TODOS los datos inmediatamente
  useEffect(() => {
    if (isLoggedIn) {
      cargarTodaLaBaseDeDatos();
    }
  }, [isLoggedIn]);

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
        turn: data.user?.turn || "Lun - Sáb",
      };

      const token = data.accessToken || data.token || "demo-token";

      localStorage.setItem("eqln_token", token);
      localStorage.setItem("eqln_user", JSON.stringify(user));
      setCurrentUser(user);
      setIsLoggedIn(true);
      setActivePage(user.role === "empleado" ? "mesas" : "dashboard");

      return true;
    } catch (apiError: unknown) {
      const err = apiError as { status?: number; isNetworkError?: boolean; message?: string };

      if (err.status === 401 || err.status === 400) {
        setAuthError(err.message || "Credenciales inválidas");
        return false;
      }

      if (err.isNetworkError) {
        const localUser = await storeLogin(username, password);
        if (localUser) {
          localStorage.setItem("eqln_token", "demo-token");
          localStorage.setItem("eqln_user", JSON.stringify(localUser));
          setCurrentUser(localUser);
          setIsLoggedIn(true);
          setActivePage(localUser.role === "empleado" ? "mesas" : "dashboard");
          return true;
        } else {
          setAuthError("Credenciales incorrectas");
          return false;
        }
      }

      setAuthError(err.message || "Credenciales inválidas");
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("eqln_token");
    localStorage.removeItem("eqln_user");
    storeLogout();
    setIsLoggedIn(false);
    setAuthError("");
    setActivePage("dashboard");
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} authError={authError} />;
  }

  const isJefe = currentUser?.role === "jefe";
  const isRestrictedPage = (activePage === "dashboard" || activePage === "historial") && !isJefe;
  const pageToRender = isRestrictedPage ? "mesas" : activePage;
  const ActivePageComponent = pages[pageToRender];

  return (
    <div className="flex min-h-screen bg-[#F4F5F7]">
      <Sidebar activePage={pageToRender} onChangePage={setActivePage} onLogout={handleLogout} />
      <main className="flex-1 p-8">
        <ErrorBoundary key={pageToRender} fallbackTitle="Error al cargar esta sección">
          <ActivePageComponent />
        </ErrorBoundary>
      </main>
    </div>
  );
}