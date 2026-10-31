import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Tags, Trash2, X } from "lucide-react";
import { usePosStore, type Categoria } from "../store/usePosStore";
import { labelCategoria } from "../lib/menuCategories";

type Props = {
  tipo: "PRODUCTO" | "INSUMO";
  onClose: () => void;
  // Para seleccionar la categoría recién creada en la pantalla que abrió la ventana
  onCreada?: (nombre: string) => void;
};

const input =
  "px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500";

// Categorías de la carta o del inventario: crear, renombrar, ordenar (el orden es
// el de las pestañas al tomar pedidos) y borrar las que están vacías. En la carta
// también se marca si sus productos llevan agregados y notas por plato.
export default function CategoriasModal({ tipo, onClose, onCreada }: Props) {
  const { categorias, addCategoria, deleteCategoria, updateCategoria, ordenarCategorias } = usePosStore();
  const lista = categorias.filter((c) => c.tipo === tipo);
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const esCarta = tipo === "PRODUCTO";

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nueva.trim();
    if (!n) return;
    if (await addCategoria(n, tipo)) {
      setNueva("");
      onCreada?.(n);
    }
  };

  const mover = async (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const ids = lista.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setError(await ordenarCategorias(tipo, ids));
  };

  const guardarNombre = async (c: Categoria) => {
    const n = nombre.trim();
    if (!n || n === c.nombre) return setEditando(null);
    const err = await updateCategoria(c.id, { nombre: n });
    setError(err);
    if (!err) setEditando(null);
  };

  const cuantos = (c: Categoria) => (esCarta ? c._count?.productos : c._count?.insumos) ?? 0;

  const borrar = async (c: Categoria) => {
    if (cuantos(c) > 0) {
      setError(
        `«${c.nombre}» tiene ${cuantos(c)} ${esCarta ? "producto(s)" : "insumo(s)"}. Muévelos a otra categoría antes de borrarla.`
      );
      return;
    }
    if (window.confirm(`¿Borrar la categoría «${c.nombre}»?`)) {
      setError(null);
      await deleteCategoria(c.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">{esCarta ? "Categorías de la carta" : "Categorías de insumos"}</h3>
              <p className="text-[11px] text-slate-400">
                {esCarta ? "El orden es el mismo de las pestañas al tomar pedidos" : "Agrupan los insumos en Inventario"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <form onSubmit={crear} className="flex items-center gap-2">
            <input
              type="text"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              className={`${input} flex-1 py-2.5`}
              placeholder={esCarta ? "Nueva categoría (ej. Postres)" : "Nueva categoría (ej. Limpieza)"}
              maxLength={60}
            />
            <button
              type="submit"
              disabled={!nueva.trim()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition shrink-0 disabled:opacity-50"
            >
              Crear
            </button>
          </form>

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

          <div className="space-y-1.5">
            {lista.length === 0 && <p className="text-center text-xs text-slate-400 py-4">Aún no hay categorías.</p>}
            {lista.map((c, i) => (
              <div key={c.id} className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col shrink-0">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      className="p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-25"
                      aria-label={`Subir ${c.nombre}`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === lista.length - 1}
                      className="p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-25"
                      aria-label={`Bajar ${c.nombre}`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {editando === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        guardarNombre(c);
                      }}
                      className="flex-1 flex items-center gap-1.5 min-w-0"
                    >
                      <input
                        autoFocus
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setEditando(null)}
                        className={`${input} flex-1 min-w-0`}
                        maxLength={60}
                        aria-label="Nuevo nombre"
                      />
                      <button
                        type="submit"
                        className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                        aria-label="Guardar nombre"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {c.nombre}
                        {esCarta && labelCategoria(c.nombre) !== c.nombre && (
                          <span className="font-medium text-slate-400"> · se muestra como «{labelCategoria(c.nombre)}»</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {cuantos(c)} {esCarta ? "producto(s)" : "insumo(s)"}
                      </div>
                    </div>
                  )}

                  {editando !== c.id && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(c.id);
                          setNombre(c.nombre);
                          setError(null);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white transition"
                        aria-label={`Renombrar ${c.nombre}`}
                        title="Renombrar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => borrar(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        aria-label={`Borrar ${c.nombre}`}
                        title="Borrar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {esCarta && editando !== c.id && (
                  <label className="mt-1.5 ml-7 flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none w-fit">
                    <input
                      type="checkbox"
                      checked={c.aceptaAgregados !== false}
                      onChange={async (e) => setError(await updateCategoria(c.id, { aceptaAgregados: e.target.checked }))}
                      className="accent-amber-500 w-3.5 h-3.5"
                    />
                    Lleva agregados y notas por plato
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
