import { useState, useMemo } from "react";
import {
  Loader2,
  UtensilsCrossed,
  ChefHat,
  Boxes,
  CreditCard,
  User,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

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
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row antialiased selection:bg-amber-500 selection:text-zinc-950">
      {/* Columna Izquierda: Información del Restaurante & Módulos (Desktop: Visible en pantalla grande; Móvil: Oculto para que el Login esté arriba sin scroll) */}
      <section 
        aria-label="Información del restaurante y módulos"
        className="hidden lg:flex lg:w-7/12 xl:w-8/12 p-8 lg:p-14 flex-col justify-between border-r border-zinc-800/80 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black relative overflow-hidden"
      >
        {/* Glow de fondo */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-8 max-w-2xl">
          {/* Header Marca */}
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Logo"
              className="w-11 h-11 rounded-2xl bg-black border border-zinc-800 object-contain shadow-lg"
            />
            <div>
              <h2 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                En que la Negra
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase">
                  POS
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Espacio de trabajo gastronómico</p>
            </div>
          </div>

          {/* Banner Fotográfico con Overlay */}
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800/80 shadow-2xl group max-h-56 sm:max-h-64 bg-black">
            <img
              src="/logo.jpg"
              alt="En que la Negra Especialidades"
              className="w-full h-full object-cover opacity-90 group-hover:scale-102 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5 font-bold text-amber-400 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-amber-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                Arepas, Cachapas & Comida Venezolana
              </span>
              <span className="text-[11px] text-zinc-400 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                Lima, Perú
              </span>
            </div>
          </div>

          {/* Mensaje de Bienvenida */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black tracking-wider uppercase">
              <span>{formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Todo listo para abrir el turno
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
              Salón, mesas, cocina (KDS), caja e inventario conectados en tiempo real. Inicia sesión y continúa justo donde lo dejaste.
            </p>
          </div>

          {/* Tarjetas de Funcionalidades en 2x2 */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Punto de venta</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Mesas, comandas y cobros rápidos</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Cocina (KDS)</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Tandas y pedidos en tiempo real</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Inventario</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Descuento automático de stock (BOM)</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Caja & Turnos</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Apertura, arqueo y cierre seguro</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Izquierdo */}
        <div className="pt-8 text-xs text-zinc-500 flex items-center justify-between border-t border-zinc-900 mt-8">
          <span>Powered by <strong>En que la Negra POS</strong></span>
          <span>Sistema Gastronómico</span>
        </div>
      </section>

      {/* Columna Derecha: Formulario de Login (En móvil: Ocupa toda la pantalla centrada y visible al instante) */}
      <section 
        aria-label="Formulario de inicio de sesión"
        className="w-full lg:w-5/12 xl:w-4/12 min-h-screen lg:min-h-0 p-5 sm:p-8 lg:p-12 flex flex-col justify-center bg-zinc-950 relative"
      >
        <div className="w-full max-w-sm mx-auto space-y-5 my-auto">
          {/* Header Móvil con Logo */}
          <div className="lg:hidden flex items-center gap-3 pb-3 border-b border-zinc-800/80">
            <img
              src="/pwa-192x192.png"
              alt="Logo"
              className="w-10 h-10 rounded-2xl bg-black border border-zinc-800 object-contain shadow-md shrink-0"
            />
            <div>
              <h2 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                En que la Negra
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase">
                  POS
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">Espacio de trabajo gastronómico</p>
            </div>
          </div>

          <header className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
              ACCESO AL SISTEMA
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Inicia sesión
            </h2>
            <p className="text-xs text-zinc-400">
              {import.meta.env.DEV
                ? "Entra con tu usuario de turno o selecciona un perfil demo."
                : "Entra con tu usuario de turno."}
            </p>
          </header>

          {/* Acceso rápido SOLO en desarrollo (npm run dev): en el build de producción
              Vite reemplaza import.meta.env.DEV por false y este bloque no existe */}
          {import.meta.env.DEV && (
          <div className="space-y-1.5 bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
              Perfil rápido con 1 clic:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectDemo("admin", "123456")}
                className={`p-2 rounded-xl border text-left transition flex items-center gap-2 ${
                  username === "admin"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                    : "bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800 text-zinc-300 text-xs"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="truncate">
                  <div className="text-[11px] font-bold leading-tight">Jefa / Admin</div>
                  <div className="text-[9px] text-zinc-400">admin</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDemo("empleado", "123456")}
                className={`p-2 rounded-xl border text-left transition flex items-center gap-2 ${
                  username === "empleado"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800 text-zinc-300 text-xs"
                }`}
              >
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="text-[11px] font-bold leading-tight">Mesonero</div>
                  <div className="text-[9px] text-zinc-400">empleado</div>
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
                className="text-xs font-bold text-zinc-300 flex items-center justify-between"
              >
                <span>Usuario o Documento</span>
                <span className="text-[10px] text-amber-500/80 font-medium">*Requerido</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="admin o empleado"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-xs font-bold text-zinc-300 flex items-center justify-between"
              >
                <span>Contraseña</span>
                <span className="text-[10px] text-amber-500/80 font-medium">*Requerido</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-10 pr-11 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
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
              <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-300">
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-950 w-4 h-4"
                />
                <span>Recordar sesión en este equipo</span>
              </label>
            </div>

            {/* Alerta de Error si ocurre */}
            {authError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {authError}
              </div>
            )}

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-98 transition transform cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Entrando al sistema...</span>
                </>
              ) : (
                <>
                  <span>Entrar a En que la Negra</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Soporte Footer */}
          <div className="text-center pt-1">
            <p className="text-[11px] text-zinc-500">
              ¿Problemas para acceder?{" "}
              <span className="text-amber-400/90 font-semibold cursor-pointer hover:underline">
                Contacta al administrador
              </span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
