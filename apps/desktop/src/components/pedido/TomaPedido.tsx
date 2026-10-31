import { useMemo, useState } from "react";
import { ChevronLeft, Loader2, Minus, Plus, Receipt, Search, Send, X } from "lucide-react";
import type { Agregado, Insumo, Producto } from "../../store/usePosStore";
import { productoSinStock } from "../../lib/stock";
import { getCategoriaNombre, labelCategoria, permitePersonalizacion } from "../../lib/menuCategories";
import { useMediaQuery } from "../../lib/useMediaQuery";

export type CartLine = { product: Producto; quantity: number; notes: string; agregados: string[] };

// Notas que más se repiten, para no escribirlas en el celular
const NOTAS_COMIDA = ["Para llevar", "Sin vegetales", "Sin salsas", "Sin cebolla"];
const NOTAS_BEBIDA = ["Para llevar", "Sin hielo", "Poco hielo", "Sin azúcar"];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soles = (n: number) => `S/ ${n.toFixed(2)}`;

type Props = {
  numero: number;
  titulo: string;
  subtitulo: string;
  categorias: string[];
  productos: Producto[];
  insumos: Insumo[];
  agregados: Agregado[];
  cart: Record<string, CartLine>;
  precioLinea: (line: CartLine) => number;
  onAgregar: (prod: Producto) => void;
  onQuitar: (prod: Producto) => void;
  onCantidadLinea: (lineId: string, delta: number) => void;
  onNotaLinea: (lineId: string, nota: string) => void;
  onAgregadoLinea: (lineId: string, agregado: string) => void;
  onEnviar: () => void;
  enviando: boolean;
  cajaAbierta: boolean;
  onVerCuenta: () => void;
  onCerrar: () => void;
};

// Toma de pedido para celular y tablet, a pantalla completa. Solo sirve para anotar
// y mandar a cocina; los cobros y la precuenta están en «Cuenta».
export default function TomaPedido(props: Props) {
  const { numero, titulo, subtitulo, categorias, productos, insumos, cart, precioLinea, onAgregar, onQuitar, onEnviar, enviando, cajaAbierta, onVerCuenta, onCerrar } = props;
  const esTablet = useMediaQuery("(min-width: 768px)");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pedidoAbierto, setVerPedido] = useState(false);

  const disponibles = useMemo(() => productos.filter((p) => p.isAvailable), [productos]);
  const lineas = Object.entries(cart);
  const totalUnidades = lineas.reduce((s, [, l]) => s + l.quantity, 0);
  const total = lineas.reduce((s, [, l]) => s + precioLinea(l), 0);

  const cantidadProducto = (id: string) => lineas.reduce((s, [, l]) => s + (l.product.id === id ? l.quantity : 0), 0);
  const cantidadCategoria = (cat: string) =>
    lineas.reduce((s, [, l]) => s + (getCategoriaNombre(l.product) === cat ? l.quantity : 0), 0);
  const productosDe = (cat: string) => disponibles.filter((p) => getCategoriaNombre(p) === cat);

  const resultados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    if (!q) return null;
    return disponibles.filter((p) => sinTildes(p.nombre).includes(q) || sinTildes(getCategoriaNombre(p)).includes(q));
  }, [busqueda, disponibles]);

  // En tablet siempre hay una categoría elegida; en celular se empieza por la cuadrícula
  const categoriaTablet = categoria && categorias.includes(categoria) ? categoria : (categorias[0] ?? "");

  // Al enviar la tanda el carrito queda vacío y el resumen del pedido se cierra solo
  if (pedidoAbierto && lineas.length === 0) setVerPedido(false);
  // Tras enviar a cocina el carrito queda vacío: se vuelve al inicio para el siguiente pedido
  const [enviado, setEnviado] = useState(false);
  if (enviado && lineas.length === 0) {
    setEnviado(false);
    setCategoria(null);
    setBusqueda("");
  }
  const verPedido = pedidoAbierto && lineas.length > 0;

  const cerrar = () => {
    if (totalUnidades > 0 && !window.confirm(`Hay ${totalUnidades} producto(s) sin enviar a cocina. ¿Salir y descartarlos?`)) return;
    onCerrar();
  };

  const control = (prod: Producto, agotado: boolean, compacto = false) => {
    const q = cantidadProducto(prod.id);
    const alto = compacto ? "h-11" : "h-12";
    if (q > 0) {
      return (
        <div className={`flex items-center bg-slate-900 rounded-xl ${alto} shrink-0`}>
          <button type="button" onClick={() => onQuitar(prod)} aria-label={`Quitar un ${prod.nombre}`} className={`${compacto ? "w-10" : "w-11"} h-full grid place-items-center text-white active:bg-white/10 rounded-l-xl`}>
            <Minus className="w-5 h-5" />
          </button>
          <span className="min-w-6 text-center text-amber-400 font-black text-[17px] tabular-nums">{q}</span>
          <button type="button" disabled={agotado} onClick={() => onAgregar(prod)} aria-label={`Agregar otro ${prod.nombre}`} className={`${compacto ? "w-10" : "w-11"} h-full grid place-items-center text-white active:bg-white/10 rounded-r-xl disabled:opacity-40`}>
            <Plus className="w-5 h-5" />
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={agotado}
        onClick={() => onAgregar(prod)}
        aria-label={`Agregar ${prod.nombre}`}
        className={`${compacto ? "w-11 h-11" : "w-12 h-12"} shrink-0 rounded-xl border-[1.5px] border-slate-900 bg-white grid place-items-center active:bg-amber-100 disabled:opacity-30 disabled:border-slate-300`}
      >
        <Plus className="w-5 h-5" />
      </button>
    );
  };

  const filaProducto = (prod: Producto, mostrarCategoria = false) => {
    const agotado = productoSinStock(prod, insumos);
    const enPedido = cantidadProducto(prod.id) > 0;
    return (
      <div key={prod.id} className={`flex items-center gap-3 py-3 min-h-[68px] border-b border-slate-200 ${enPedido ? "bg-gradient-to-r from-amber-50 to-transparent" : ""}`}>
        <span className="text-[26px] w-9 text-center shrink-0">{prod.iconoEmoji}</span>
        <div className="flex-1 min-w-0">
          {mostrarCategoria && (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{labelCategoria(getCategoriaNombre(prod))}</div>
          )}
          <div className="font-bold text-[15px] leading-tight text-slate-900">{prod.nombre}</div>
          <div className="text-sm font-bold text-slate-600 mt-0.5 tabular-nums">
            {soles(Number(prod.precio || 0))}
            {agotado && <span className="ml-1.5 text-rose-600">· Sin stock</span>}
          </div>
        </div>
        {control(prod, agotado)}
      </div>
    );
  };

  const tarjetaProducto = (prod: Producto) => {
    const agotado = productoSinStock(prod, insumos);
    const enPedido = cantidadProducto(prod.id) > 0;
    return (
      <div key={prod.id} className={`rounded-xl border p-3 grid gap-2 ${enPedido ? "border-slate-900 bg-amber-50" : "border-slate-200 bg-white"} ${agotado ? "opacity-60" : ""}`}>
        <span className="text-[28px]">{prod.iconoEmoji}</span>
        <div className="font-bold text-sm leading-tight text-slate-900 min-h-[34px]">{prod.nombre}</div>
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-extrabold tabular-nums text-slate-900">
            {soles(Number(prod.precio || 0))}
            {agotado && <span className="block text-[11px] text-rose-600">Sin stock</span>}
          </span>
          {control(prod, agotado, true)}
        </div>
      </div>
    );
  };

  const buscador = (
    <div className="px-3.5 pt-3 pb-2 shrink-0">
      <label className="flex items-center gap-2 h-12 px-3 rounded-xl bg-slate-100 border border-slate-200 focus-within:border-slate-900">
        <Search className="w-[18px] h-[18px] text-slate-400 shrink-0" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar: arepa, coca, batido…"
          autoComplete="off"
          className="flex-1 min-w-0 h-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none"
        />
        {busqueda && (
          <button type="button" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda" className="p-1 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
    </div>
  );

  const sinResultados = <div className="py-8 text-center text-slate-400">No hay productos con «{busqueda}».</div>;

  // Líneas del pedido con cantidad, nota para cocina y agregados
  const detallePedido = lineas.length === 0
    ? <div className="py-8 text-center text-slate-400">Toca un producto para agregarlo.</div>
    : lineas.map(([lineId, line]) => <LineaPedido key={lineId} lineId={lineId} line={line} {...props} />);

  const pieEnvio = (
    <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-slate-200 grid gap-2.5 shrink-0 bg-white">
      <div className="flex justify-between font-extrabold text-xl tabular-nums">
        <span>{totalUnidades} producto{totalUnidades === 1 ? "" : "s"}</span>
        <span>{soles(total)}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          setEnviado(true);
          onEnviar();
        }}
        disabled={!lineas.length || !cajaAbierta || enviando}
        className="h-14 rounded-xl bg-slate-900 text-amber-400 font-extrabold text-[17px] flex items-center justify-center gap-2 active:scale-[.98] transition disabled:opacity-35"
      >
        {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        {!cajaAbierta ? "Caja cerrada" : enviando ? "Enviando…" : "Enviar a cocina"}
      </button>
    </div>
  );

  const cabecera = (
    <div className="bg-slate-900 text-white flex items-center gap-2.5 px-3 pb-3 pt-[max(12px,env(safe-area-inset-top))] shrink-0">
      <button type="button" onClick={cerrar} aria-label="Volver a las mesas" className="w-10 h-10 rounded-lg bg-white/10 grid place-items-center shrink-0">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="bg-amber-500 text-slate-950 font-black rounded-lg px-2.5 py-1.5 text-[15px] shrink-0">#{numero}</span>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-base leading-tight truncate">{titulo}</div>
        <div className="text-xs text-slate-400 truncate">{subtitulo}</div>
      </div>
      <button type="button" onClick={onVerCuenta} className="h-10 px-3 rounded-lg bg-white/10 flex items-center gap-1.5 text-sm font-bold shrink-0">
        <Receipt className="w-4 h-4" /> Cuenta
      </button>
    </div>
  );

  if (esTablet) {
    const lista = resultados ?? productosDe(categoriaTablet);
    return (
      <div className="fixed inset-0 z-50 bg-white text-slate-900 flex flex-col">
        {cabecera}
        <div className="flex-1 min-h-0 grid grid-cols-[200px_minmax(0,1fr)_320px] lg:grid-cols-[230px_minmax(0,1fr)_360px]">
          <nav className="border-r border-slate-200 bg-slate-50 overflow-y-auto overflow-x-hidden p-2.5 grid gap-1 content-start">
            {categorias.map((cat) => {
              const q = cantidadCategoria(cat);
              const activa = !resultados && cat === categoriaTablet;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setCategoria(cat); setBusqueda(""); }}
                  className={`min-w-0 flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm font-bold ${activa ? "bg-slate-900 text-amber-400" : "text-slate-700 active:bg-slate-200"}`}
                >
                  <span className="text-lg">{productosDe(cat)[0]?.iconoEmoji}</span>
                  <span lang="es" className="flex-1 min-w-0 leading-tight hyphens-auto [overflow-wrap:anywhere]">{labelCategoria(cat)}</span>
                  {q > 0 && <span className="bg-amber-500 text-slate-950 rounded-full text-xs font-black px-2 py-0.5 tabular-nums">{q}</span>}
                </button>
              );
            })}
          </nav>
          <div className="flex flex-col min-h-0">
            {buscador}
            <div className="flex-1 overflow-y-auto">
              {lista.length ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 px-3.5 pb-4">{lista.map(tarjetaProducto)}</div>
              ) : sinResultados}
            </div>
          </div>
          <div className="border-l border-slate-200 flex flex-col min-h-0">
            <div className="px-4 py-3.5 border-b border-slate-200 font-extrabold text-lg">Pedido · {titulo}</div>
            <div className="flex-1 overflow-y-auto px-4">{detallePedido}</div>
            {pieEnvio}
          </div>
        </div>
      </div>
    );
  }

  // Celular: cuadrícula de categorías → productos de la categoría, y la barra del pedido abajo
  let cuerpo;
  if (resultados) {
    cuerpo = resultados.length
      ? <div className="px-3.5 pb-28">{resultados.map((p) => filaProducto(p, true))}</div>
      : sinResultados;
  } else if (categoria && categorias.includes(categoria)) {
    cuerpo = (
      <>
        <div className="flex items-center gap-2 px-3.5 pt-1 pb-2">
          <button type="button" onClick={() => setCategoria(null)} className="h-10 px-3 rounded-lg border border-slate-200 flex items-center gap-1 text-sm font-bold shrink-0">
            <ChevronLeft className="w-[18px] h-[18px]" /> Categorías
          </button>
          <h3 className="font-extrabold text-lg leading-tight truncate">{labelCategoria(categoria)}</h3>
        </div>
        <div className="px-3.5 pb-28">{productosDe(categoria).map((p) => filaProducto(p))}</div>
      </>
    );
  } else {
    cuerpo = (
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 px-3.5 pt-1 pb-28">
        {categorias.map((cat) => {
          const q = cantidadCategoria(cat);
          const items = productosDe(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoria(cat)}
              className="relative min-w-0 min-h-[92px] rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex flex-col items-start justify-between text-left active:bg-amber-50"
            >
              {q > 0 ? (
                <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black grid place-items-center tabular-nums">{q}</span>
              ) : (
                <span className="absolute top-2 right-2 text-[11px] font-bold text-slate-400 tabular-nums">{items.length}</span>
              )}
              <span className="text-2xl">{items[0]?.iconoEmoji}</span>
              <span lang="es" className="font-bold text-[13px] leading-tight text-slate-900 max-w-full hyphens-auto [overflow-wrap:anywhere]">{labelCategoria(cat)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white text-slate-900 flex flex-col">
      {cabecera}
      {buscador}
      <div className="flex-1 min-h-0 overflow-y-auto">{cuerpo}</div>

      <div className="absolute left-3 right-3 bottom-[max(14px,env(safe-area-inset-bottom))]">
        {lineas.length ? (
          <button
            type="button"
            onClick={() => setVerPedido(true)}
            className="w-full h-[60px] rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-between px-4 font-extrabold text-base shadow-lg active:scale-[.98] transition"
          >
            <span className="flex items-center gap-2">
              <span className="bg-slate-900 text-amber-400 rounded-lg px-2.5 py-0.5 tabular-nums">{totalUnidades}</span>
              Ver pedido
            </span>
            <span className="tabular-nums">{soles(total)}</span>
          </button>
        ) : (
          <div className="w-full h-[60px] rounded-2xl bg-slate-100 text-slate-500 grid place-items-center text-sm font-semibold">
            Toca un producto para agregarlo
          </div>
        )}
      </div>

      {verPedido && (
        <div className="absolute inset-0 bg-black/45 flex items-end" onClick={() => setVerPedido(false)}>
          <div className="bg-white w-full max-h-[88%] rounded-t-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-[5px] rounded-full bg-slate-300 mx-auto mt-2.5 mb-1" />
            <div className="flex items-center justify-between px-4 pt-1.5 pb-2.5 border-b border-slate-200">
              <span className="font-extrabold text-lg">Pedido · {titulo}</span>
              <button type="button" onClick={() => setVerPedido(false)} aria-label="Cerrar pedido" className="w-10 h-10 rounded-lg bg-slate-100 grid place-items-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4">{detallePedido}</div>
            {pieEnvio}
          </div>
        </div>
      )}
    </div>
  );
}

function LineaPedido({ lineId, line, agregados, precioLinea, onCantidadLinea, onNotaLinea, onAgregadoLinea }: Props & { lineId: string; line: CartLine }) {
  const [editando, setEditando] = useState(false);
  const categoria = getCategoriaNombre(line.product);
  const personalizable = permitePersonalizacion(categoria);
  const sugerencias = personalizable ? NOTAS_COMIDA : NOTAS_BEBIDA;
  const partes = line.notes.split(",").map((s) => s.trim()).filter(Boolean);

  const alternarSugerencia = (texto: string) => {
    const nuevas = partes.includes(texto) ? partes.filter((p) => p !== texto) : [...partes, texto];
    onNotaLinea(lineId, nuevas.join(", "));
  };

  return (
    <div className="py-3 border-b border-slate-200 grid gap-2">
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="font-bold leading-tight text-slate-900">{line.product.nombre}</div>
          <div className="text-[13px] font-semibold text-slate-500 tabular-nums">
            {soles(precioLinea(line))}
            {line.agregados.length > 0 && <span> · {line.agregados.map((a) => `+ ${a}`).join(", ")}</span>}
          </div>
        </div>
        <div className="flex items-center bg-slate-900 rounded-xl h-11 shrink-0">
          <button type="button" onClick={() => onCantidadLinea(lineId, -1)} aria-label="Quitar uno" className="w-10 h-full grid place-items-center text-white">
            <Minus className="w-5 h-5" />
          </button>
          <span className="min-w-6 text-center text-amber-400 font-black text-[17px] tabular-nums">{line.quantity}</span>
          <button type="button" onClick={() => onCantidadLinea(lineId, 1)} aria-label="Agregar uno" className="w-10 h-full grid place-items-center text-white">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {editando ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {sugerencias.map((texto) => (
              <button
                key={texto}
                type="button"
                onClick={() => alternarSugerencia(texto)}
                className={`px-3 py-2 rounded-full border text-[13px] font-bold ${partes.includes(texto) ? "bg-slate-900 text-amber-400 border-slate-900" : "bg-slate-50 border-slate-200 text-slate-700"}`}
              >
                {texto}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={line.notes}
            onChange={(e) => onNotaLinea(lineId, e.target.value)}
            placeholder="Otra indicación para cocina"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-base text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:border-slate-900"
          />
          {personalizable && agregados.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Agregados (por unidad)</div>
              <div className="flex flex-wrap gap-1.5">
                {agregados.map((a) => {
                  const activo = line.agregados.includes(a.nombre);
                  return (
                    <button
                      key={a.nombre}
                      type="button"
                      onClick={() => onAgregadoLinea(lineId, a.nombre)}
                      className={`px-3 py-2 rounded-full border text-[13px] font-bold ${activo ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                    >
                      {a.nombre} +{soles(a.precio)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button type="button" onClick={() => setEditando(false)} className="justify-self-start px-3 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-bold">
            Listo
          </button>
        </div>
      ) : (
        <>
          {line.notes && <div className="text-[13px] italic text-slate-600">“{line.notes}”</div>}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="justify-self-start px-3 py-2 rounded-lg border border-dashed border-slate-400 text-[13px] font-bold text-slate-700"
          >
            {line.notes || line.agregados.length ? "Cambiar nota o agregados" : personalizable && agregados.length ? "+ Nota o agregados" : "+ Nota para cocina"}
          </button>
        </>
      )}
    </div>
  );
}
