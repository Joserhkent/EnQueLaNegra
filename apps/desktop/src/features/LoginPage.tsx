import { useState } from "react";
import { Loader2 } from "lucide-react";

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<boolean>;
  authError?: string;
};

export default function LoginPage({ onLogin, authError }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const minLoadingTime = 600; // 600ms para asegurar la visualización fluida de la animación

    if (elapsedTime < minLoadingTime) {
      await new Promise((resolve) => setTimeout(resolve, minLoadingTime - elapsedTime));
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E6E6E6] px-4 py-8">
      <div className="flex w-full max-w-5xl overflow-hidden rounded-[32px] shadow-[0_40px_120px_rgba(15,23,42,0.12)]">
        <div className="w-full bg-white p-10 sm:w-1/2 sm:p-16">
          <div className="mx-auto max-w-sm">
            <p className="mb-10 text-4xl font-black uppercase tracking-[0.18em] text-slate-900">Iniciar sesión</p>

            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-900">
                  Usuario
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-bold uppercase tracking-[0.12em] text-slate-900">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {authError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <p>{authError}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !username.trim() || !password.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-950 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
                    <span>Iniciando...</span>
                  </>
                ) : (
                  "iniciar sesión"
                )}
              </button>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-bold text-slate-800">Cuentas demo de acceso:</p>
                <p className="mt-0.5">• <span className="font-semibold">Empleado:</span> <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-900 font-mono">empleado</code> (clave: 123456)</p>
                <p className="mt-0.5">• <span className="font-semibold">Jefe:</span> <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-900 font-mono">admin</code> (clave: 123456)</p>
              </div>
            </form>
          </div>
        </div>

        <div className="hidden w-1/2 bg-black sm:flex">
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 p-10 text-center">
            <img src="/logo.jpg" alt="En que la Negra" className="w-full max-w-sm object-contain" />
            <p className="max-w-xs text-sm font-medium text-amber-200/80">Sabor venezolano de siempre: arepas, cachapas, patacones y más.</p>
          </div>
        </div>
      </div>
    </div>
  );
}