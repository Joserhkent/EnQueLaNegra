import { useState, useMemo } from "react";
import {
  Loader2,
  User,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  UserCheck,
  UtensilsCrossed,
  ChefHat,
  Wallet,
  Boxes,
} from "lucide-react";

const MODULOS = [
  { icon: UtensilsCrossed, titulo: "Mesas y pedidos", detalle: "Toma y para llevar" },
  { icon: ChefHat, titulo: "Cocina", detalle: "Comandas por tanda" },
  { icon: Wallet, titulo: "Caja", detalle: "Efectivo, Yape y Plin" },
  { icon: Boxes, titulo: "Inventario", detalle: "Stock por receta" },
];

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<boolean>;
  authError?: string;
};

export default function LoginPage({ onLogin, authError }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fecha en vivo en español, ej: "VIERNES, 23 DE OCTUBRE"
  const formattedDate = useMemo(() => {
    const now = new Date();
    return now
      .toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      .toUpperCase();
  }, []);

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (!username.trim() || !password.trim()) {
      return;
    }

    setIsSubmitting(true);
    const startTime = Date.now();
    await onLogin(username.trim(), password);
    const elapsedTime = Date.now() - startTime;
    const minLoadingTime = 500;

    if (elapsedTime < minLoadingTime) {
      await new Promise((resolve) =>
        setTimeout(resolve, minLoadingTime - elapsedTime)
      );
    }

    setIsSubmitting(false);
  };

  const handleSelectDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col lg:flex-row antialiased selection:bg-amber-500 selection:text-stone-950">
      {/* Columna Izquierda: Información del Restaurante & Módulos (Desktop: Visible en pantalla grande; Móvil: Oculto para que el Login esté arriba sin scroll) */}
      <section 
        aria-label="Información del restaurante y módulos"
        className="hidden lg:flex lg:w-7/12 xl:w-8/12 px-14 py-12 flex-col bg-[#2a1710] relative overflow-hidden"
      >
        <div className="franja-marca absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />

        <p className="text-sm text-amber-400 font-semibold">{formattedDate}</p>

        {/* Logo y eslogan al centro. El logo tiene fondo negro: con mix-blend-screen
            el negro desaparece sobre el fondo tostado y los colores quedan vivos */}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8">
          <img
            src="/logo.jpg"
            alt="En que la Negra"
            className="w-full max-w-2xl object-contain mix-blend-screen"
          />
          <h1 className="text-5xl xl:text-6xl text-white leading-none">
            Sabor que nos une
          </h1>
          <p className="text-base text-orange-100/70 mt-2">
            Todo listo para abrir el turno.
          </p>
        </div>

        <ul className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {MODULOS.map(({ icon: Icon, titulo, detalle }) => (
            <li
              key={titulo}
              className="flex items-center gap-3 rounded-lg border border-orange-200/15 bg-black/20 px-3.5 py-3"
            >
              <span className="w-9 h-9 shrink-0 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Icon className="w-4.5 h-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{titulo}</span>
                <span className="block text-xs text-orange-100/60 truncate">{detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Columna Derecha: Formulario de Login (En móvil: Ocupa toda la pantalla centrada y visible al instante) */}
      <section 
        aria-label="Formulario de inicio de sesión"
        className="w-full lg:w-5/12 xl:w-4/12 min-h-screen lg:min-h-0 p-5 sm:p-8 lg:p-12 flex flex-col justify-start lg:justify-center bg-stone-950 relative"
      >
        <div className="w-full max-w-sm mx-auto space-y-5 lg:my-auto">
          {/* Header Móvil con Logo */}
          <div className="lg:hidden -mx-5 sm:-mx-[calc((100vw-24rem)/2)] -mt-5 sm:-mt-8 mb-2 px-5 pt-6 pb-5 bg-[#2a1710] flex flex-col items-center text-center relative">
            <div className="franja-marca absolute inset-x-0 top-0 h-1" aria-hidden="true" />
            <img
              src="/logo.jpg"
              alt="En que la Negra"
              className="w-full max-w-[280px] object-contain mix-blend-screen"
            />
            <p className="text-2xl font-display text-white">Sabor que nos une</p>
          </div>

          <header className="space-y-1">
            <h2 className="text-3xl sm:text-4xl font-display text-white">
              Inicia sesión
            </h2>
            <p className="text-xs text-stone-400">
              {import.meta.env.DEV
                ? "Entra con tu usuario o elige un perfil de prueba."
                : "Entra con tu usuario."}
            </p>
          </header>

          {/* Acceso rápido SOLO en desarrollo (npm run dev): en el build de producción
              Vite reemplaza import.meta.env.DEV por false y este bloque no existe */}
          {import.meta.env.DEV && (
          <div className="space-y-1.5 bg-stone-900/60 p-2.5 rounded-lg border border-stone-800/80">
            <p className="text-[10px] font-bold text-stone-400 px-1">
              Perfiles de prueba (solo en desarrollo)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectDemo("admin", "123456")}
                className={`p-2 rounded-md border text-left transition flex items-center gap-2 ${
                  username === "admin"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                    : "bg-stone-800/60 border-stone-700/60 hover:bg-stone-800 text-stone-300 text-xs"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="truncate">
                  <div className="text-[11px] font-bold leading-tight">Jefa / Admin</div>
                  <div className="text-[9px] text-stone-400">admin</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDemo("empleado", "123456")}
                className={`p-2 rounded-md border text-left transition flex items-center gap-2 ${
                  username === "empleado"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-stone-800/60 border-stone-700/60 hover:bg-stone-800 text-stone-300 text-xs"
                }`}
              >
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="text-[11px] font-bold leading-tight">Mesonero</div>
                  <div className="text-[9px] text-stone-400">empleado</div>
                </div>
              </button>
            </div>
          </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Campo Usuario */}
            <div className="space-y-1">
              <label
                htmlFor="username"
                className="text-xs font-bold text-stone-300 flex items-center justify-between"
              >
                <span>Usuario</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="admin o empleado"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-md border border-stone-800 bg-stone-900/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-stone-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-xs font-bold text-stone-300 flex items-center justify-between"
              >
                <span>Contraseña</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-stone-800 bg-stone-900/90 pl-10 pr-11 py-2.5 text-sm text-white placeholder-stone-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition"
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Checkbox Recordar */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-stone-400 hover:text-stone-300">
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  className="rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-stone-950 w-4 h-4"
                />
                <span>Recordar sesión en este equipo</span>
              </label>
            </div>

            {/* Alerta de Error si ocurre */}
            {authError && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {authError}
              </div>
            )}

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-bold text-sm active:scale-98 transition transform cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                  <span>Entrando…</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>

          {/* Soporte Footer */}
          <div className="text-center pt-1">
            <p className="text-xs text-stone-500">
              ¿Olvidaste tu contraseña? La jefa puede restablecerla desde «Mi cuenta».
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
