import { useEffect, useState } from "react";
import { KeyRound, X, Loader2, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { usePosStore, type UsuarioSistema } from "../store/usePosStore";

const MIN = 8;

type Props = { onClose: () => void };

// "Mi cuenta": cada usuario cambia su contraseña (pide la actual). El Jefe además
// puede restablecer la de otro usuario si la olvidó (sin conocer la anterior).
export default function CuentaModal({ onClose }: Props) {
  const { currentUser, cambiarPassword, listarUsuarios, restablecerPassword } = usePosStore();
  const isJefe = currentUser?.role === "jefe";

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [restableciendo, setRestableciendo] = useState<string | null>(null);
  const [nuevaOtro, setNuevaOtro] = useState("");
  const [avisoOtro, setAvisoOtro] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    if (isJefe) listarUsuarios().then(setUsuarios);
  }, [isJefe, listarUsuarios]);

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

  const handleRestablecer = async (u: UsuarioSistema) => {
    if (nuevaOtro.length < MIN) {
      return setAvisoOtro({ tipo: "error", texto: `Mínimo ${MIN} caracteres` });
    }
    const err = await restablecerPassword(u.id, nuevaOtro);
    setAvisoOtro(
      err ? { tipo: "error", texto: err } : { tipo: "ok", texto: `Contraseña de ${u.name} restablecida` }
    );
    if (!err) {
      setRestableciendo(null);
      setNuevaOtro("");
    }
  };

  const input =
    "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-md text-sm text-slate-900 focus:outline-none focus:border-amber-500";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden my-auto">
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

        {isJefe && (
          <div className="px-6 pb-6 space-y-3 border-t border-slate-100 pt-5">
            <div>
              <h4 className="text-xs font-bold text-slate-500">Restablecer contraseña de un usuario</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Si alguien olvidó la suya, ponle una nueva y díselo en persona.
              </p>
            </div>
            {avisoOtro && (
              <p className={`text-xs font-semibold ${avisoOtro.tipo === "ok" ? "text-emerald-700" : "text-rose-600"}`}>
                {avisoOtro.texto}
              </p>
            )}
            <div className="space-y-2">
              {usuarios
                .filter((u) => u.id !== currentUser?.id)
                .map((u) => (
                  <div key={u.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {u.role === "jefe" ? (
                          <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{u.name}</div>
                          <div className="text-[10px] text-slate-500">{u.username}</div>
                        </div>
                      </div>
                      {restableciendo !== u.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setRestableciendo(u.id);
                            setNuevaOtro("");
                            setAvisoOtro(null);
                          }}
                          className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition"
                        >
                          Restablecer
                        </button>
                      )}
                    </div>
                    {restableciendo === u.id && (
                      <div className="flex gap-2">
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder={`Nueva (mín. ${MIN})`}
                          value={nuevaOtro}
                          onChange={(e) => setNuevaOtro(e.target.value)}
                          className={`${input} py-2 text-xs`}
                        />
                        <button
                          type="button"
                          onClick={() => handleRestablecer(u)}
                          className="text-[11px] font-bold bg-slate-900 text-white rounded-md px-3 hover:bg-slate-800 transition shrink-0"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestableciendo(null)}
                          className="text-[11px] font-bold text-slate-500 px-1 shrink-0"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
