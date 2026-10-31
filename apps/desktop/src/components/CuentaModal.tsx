import { useState } from "react";
import { KeyRound, X, Loader2, CheckCircle2 } from "lucide-react";
import { usePosStore } from "../store/usePosStore";
import EquipoPanel from "./EquipoPanel";

const MIN = 8;

type Props = { onClose: () => void };

// "Mi cuenta": cada usuario cambia su contraseña (pide la actual). El Jefe además
// administra el equipo: crea usuarios, cambia roles, restablece contraseñas y desactiva.
export default function CuentaModal({ onClose }: Props) {
  const { currentUser, cambiarPassword } = usePosStore();
  const isJefe = currentUser?.role === "jefe";

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const handleCambiar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(false);
    if (nueva.length < MIN) return setError(`La contraseña nueva debe tener al menos ${MIN} caracteres`);
    if (nueva !== confirmar) return setError("La confirmación no coincide con la contraseña nueva");
    setGuardando(true);
    const err = await cambiarPassword(actual, nueva);
    setGuardando(false);
    setError(err);
    if (!err) {
      setOk(true);
      setActual("");
      setNueva("");
      setConfirmar("");
    }
  };

  const input =
    "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-md text-sm text-slate-900 focus:outline-none focus:border-amber-500";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-xl overflow-hidden my-auto">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Mi cuenta</h3>
              <p className="text-[11px] text-slate-400">
                {currentUser?.name}, usuario {currentUser?.username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCambiar} className="p-6 space-y-3">
          <h4 className="text-xs font-bold text-slate-500">Cambiar mi contraseña</h4>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Contraseña actual"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className={input}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder={`Contraseña nueva (mínimo ${MIN} caracteres)`}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className={input}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repite la contraseña nueva"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className={input}
            required
          />
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          {ok && (
            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Contraseña cambiada. Úsala la próxima vez que inicies sesión.
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="w-full py-2.5 rounded-md bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar contraseña
          </button>
        </form>

        {isJefe && <EquipoPanel />}
      </div>
    </div>
  );
}
