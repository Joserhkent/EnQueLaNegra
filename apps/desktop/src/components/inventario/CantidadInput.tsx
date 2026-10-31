import { leerNumero, nombreOpcion, type OpcionUnidad } from "../../lib/cantidades";

type CantidadInputProps = {
  opciones: OpcionUnidad[];
  clave: OpcionUnidad["clave"];
  valor: string;
  onValor: (valor: string) => void;
  onClave: (clave: OpcionUnidad["clave"]) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

/**
 * Campo de cantidad con la unidad al lado. Si el insumo se puede escribir en más
 * de una unidad (g, kg, latas…), la unidad es un botón que pasa a la siguiente.
 * El valor se guarda tal cual se escribe; quien lo usa lo convierte con el factor.
 */
export default function CantidadInput({
  opciones,
  clave,
  valor,
  onValor,
  onClave,
  placeholder = "0",
  autoFocus,
}: CantidadInputProps) {
  const indice = Math.max(0, opciones.findIndex((o) => o.clave === clave));
  const actual = opciones[indice];
  const siguiente = opciones[(indice + 1) % opciones.length];
  const etiqueta = nombreOpcion(actual, leerNumero(valor) ?? 2);

  return (
    <div className="flex items-stretch rounded-md border border-slate-300 bg-white focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => onValor(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full min-w-0 px-2.5 py-2 bg-transparent text-right text-sm font-bold text-slate-900 outline-none"
      />
      {opciones.length > 1 ? (
        <button
          type="button"
          onClick={() => onClave(siguiente.clave)}
          title={`Cambiar a ${nombreOpcion(siguiente, 2)}`}
          className="shrink-0 max-w-[6.5rem] truncate px-2.5 border-l border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-r-md"
        >
          {etiqueta} ⇄
        </button>
      ) : (
        <span className="shrink-0 px-2.5 flex items-center border-l border-slate-200 text-xs font-semibold text-slate-500">
          {etiqueta}
        </span>
      )}
    </div>
  );
}
