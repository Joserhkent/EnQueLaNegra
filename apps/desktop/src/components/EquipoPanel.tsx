import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, ShieldCheck, UserCheck, UserX, KeyRound } from "lucide-react";
import { usePosStore, type RolSistema, type UsuarioSistema } from "../store/usePosStore";

const MIN = 8;

const input =
  "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500";

// Nombre corto y claro del rol para la lista
const etiquetaRol = (nombre?: string) => {
  const n = (nombre || "").toLowerCase();
  if (n === "jefe" || n === "admin" || n === "administrador") return "Jefe";
  if (n === "empleado") return "Mesonero";
  return nombre || "";
};

type Form = { name: string; username: string; password: string; rolId: string; turn: string };
const VACIO: Form = { name: "", username: "", password: "", rolId: "", turn: "" };

// Equipo (solo Jefe): crear usuarios, editar nombre/usuario/rol/turno, restablecer
// contraseña y activar o desactivar. No se borran: así sus ventas y cierres de caja
// siguen mostrando quién los hizo. Desactivar corta su sesión al instante.
export default function EquipoPanel() {
  const { currentUser, listarUsuarios, listarRoles, guardarUsuario, restablecerPassword } = usePosStore();
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [roles, setRoles] = useState<RolSistema[]>([]);
  // "nuevo", id del usuario que se edita, o null
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(VACIO);
  const [restableciendo, setRestableciendo] = useState<string | null>(null);
  const [nuevaOtro, setNuevaOtro] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const recargar = useCallback(() => listarUsuarios().then(setUsuarios), [listarUsuarios]);

  useEffect(() => {
    recargar();
    listarRoles().then(setRoles);
  }, [recargar, listarRoles]);

  const abrirNuevo = () => {
    setEditando("nuevo");
    setRestableciendo(null);
    setAviso(null);
    const mesonero = roles.find((r) => r.nombre.toLowerCase() === "empleado");
    setForm({ ...VACIO, rolId: mesonero?.id ?? roles[0]?.id ?? "" });
  };

  const abrirEditar = (u: UsuarioSistema) => {
    setEditando(u.id);
    setRestableciendo(null);
    setAviso(null);
    setForm({ name: u.name, username: u.username, password: "", rolId: u.rolId ?? "", turn: u.turn ?? "" });
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const esNuevo = editando === "nuevo";
    const username = form.username.trim().toLowerCase();
    if (!form.name.trim()) return setAviso({ tipo: "error", texto: "Escribe el nombre" });
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return setAviso({
        tipo: "error",
        texto: "El usuario va sin espacios ni tildes, de 3 a 30 letras o números (ej. maria.p)",
      });
    }
    if (esNuevo && form.password.length < MIN) {
      return setAviso({ tipo: "error", texto: `La contraseña debe tener al menos ${MIN} caracteres` });
    }
    if (!form.rolId) return setAviso({ tipo: "error", texto: "Elige un rol" });
    setGuardando(true);
    const err = await guardarUsuario(esNuevo ? null : editando, {
      name: form.name.trim(),
      username,
      rolId: form.rolId,
      turn: form.turn.trim(),
      ...(esNuevo ? { password: form.password } : {}),
    });
    setGuardando(false);
    if (err) return setAviso({ tipo: "error", texto: err });
    setAviso({
      tipo: "ok",
      texto: esNuevo ? `${form.name.trim()} ya puede entrar con el usuario «${username}»` : "Cambios guardados",
    });
    setEditando(null);
    recargar();
  };

  const cambiarActivo = async (u: UsuarioSistema) => {
    if (u.active && !window.confirm(`¿Desactivar a ${u.name}? No podrá entrar y su sesión se cierra ahora mismo.`)) {
      return;
    }
    const err = await guardarUsuario(u.id, { active: !u.active });
    setAviso(
      err
        ? { tipo: "error", texto: err }
        : { tipo: "ok", texto: u.active ? `${u.name} desactivado` : `${u.name} puede volver a entrar` }
    );
    if (!err) recargar();
  };

  const restablecer = async (u: UsuarioSistema) => {
    if (nuevaOtro.length < MIN) return setAviso({ tipo: "error", texto: `Mínimo ${MIN} caracteres` });
    const err = await restablecerPassword(u.id, nuevaOtro);
    setAviso(err ? { tipo: "error", texto: err } : { tipo: "ok", texto: `Contraseña de ${u.name} restablecida` });
    if (!err) {
      setRestableciendo(null);
      setNuevaOtro("");
    }
  };

  const formulario = (
    <form onSubmit={guardar} className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 space-y-2">
      <input
        placeholder="Nombre (ej. María Pérez)"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className={input}
        maxLength={60}
        autoFocus
      />
      <input
        placeholder="Usuario para entrar (ej. maria.p)"
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
        className={input}
        autoCapitalize="none"
        autoCorrect="off"
        maxLength={30}
      />
      {editando === "nuevo" && (
        <input
          type="password"
          autoComplete="new-password"
          placeholder={`Contraseña (mínimo ${MIN} caracteres)`}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className={input}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={form.rolId}
          onChange={(e) => setForm({ ...form, rolId: e.target.value })}
          className={input}
          aria-label="Rol"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {etiquetaRol(r.nombre)}
            </option>
          ))}
        </select>
        <input
          placeholder="Turno (opcional)"
          value={form.turn}
          onChange={(e) => setForm({ ...form, turn: e.target.value })}
          className={input}
          maxLength={60}
        />
      </div>
      <p className="text-[11px] text-slate-500">
        {etiquetaRol(roles.find((r) => r.id === form.rolId)?.nombre) === "Jefe"
          ? "Jefe: acceso total (caja, reportes, carta, inventario y equipo)."
          : "Mesonero: mesas, pedidos, cobros y consulta de inventario."}
      </p>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 py-2 rounded-md bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          {editando === "nuevo" ? "Crear usuario" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setEditando(null)}
          className="px-3 py-2 rounded-md text-sm font-bold text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <div className="px-6 pb-6 space-y-3 border-t border-slate-100 pt-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-500">Equipo</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Crea usuarios, cambia su rol o desactívalos cuando dejen de trabajar.
          </p>
        </div>
        {editando !== "nuevo" && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="shrink-0 text-[11px] font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </button>
        )}
      </div>

      {aviso && (
        <p className={`text-xs font-semibold ${aviso.tipo === "ok" ? "text-emerald-700" : "text-rose-600"}`}>
          {aviso.texto}
        </p>
      )}

      {editando === "nuevo" && formulario}

      <div className="space-y-2">
        {usuarios.map((u) => {
          const yo = u.id === currentUser?.id;
          const esJefe = etiquetaRol(u.rolNombre ?? u.role) === "Jefe";
          if (editando === u.id) return <div key={u.id}>{formulario}</div>;
          return (
            <div
              key={u.id}
              className={`border rounded-lg p-3 space-y-2 ${u.active ? "bg-slate-50 border-slate-200" : "bg-white border-dashed border-slate-300"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`flex items-center gap-2 min-w-0 ${u.active ? "" : "opacity-60"}`}>
                  {!u.active ? (
                    <UserX className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : esJefe ? (
                    <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {u.name} {yo && <span className="font-semibold text-slate-400">(tú)</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {u.username} · {etiquetaRol(u.rolNombre ?? u.role)}
                      {u.turn ? ` · ${u.turn}` : ""}
                      {!u.active && " · desactivado"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirEditar(u)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200"
                    aria-label={`Editar a ${u.name}`}
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!yo && u.active && (
                    <button
                      type="button"
                      onClick={() => {
                        setRestableciendo(restableciendo === u.id ? null : u.id);
                        setNuevaOtro("");
                        setAviso(null);
                      }}
                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200"
                      aria-label={`Restablecer contraseña de ${u.name}`}
                      title="Restablecer contraseña"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!yo && (
                    <button
                      type="button"
                      onClick={() => cambiarActivo(u)}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1.5 border transition ${
                        u.active
                          ? "text-rose-600 border-rose-200 bg-white hover:bg-rose-50"
                          : "text-emerald-700 border-emerald-200 bg-white hover:bg-emerald-50"
                      }`}
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                  )}
                </div>
              </div>
              {restableciendo === u.id && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={`Contraseña nueva (mín. ${MIN})`}
                    value={nuevaOtro}
                    onChange={(e) => setNuevaOtro(e.target.value)}
                    className={`${input} py-2 text-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => restablecer(u)}
                    className="text-[11px] font-bold bg-slate-900 text-white rounded-md px-3 hover:bg-slate-800 transition shrink-0"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
