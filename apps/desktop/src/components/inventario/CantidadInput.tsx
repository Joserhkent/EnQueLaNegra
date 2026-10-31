import { unidadGrande } from "../../lib/cantidades";
import { formatUnidad } from "../../lib/utils";

type CantidadInputProps = {
  unidad: string;
  valor: string;
  enGrande: boolean;
  onValor: (valor: string) => void;
  onEnGrande: (enGrande: boolean) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

/**
 * Campo de cantidad con la unidad al lado. Si la unidad tiene una más grande
 * (g -> kg, ml -> L), la unidad es un botón para cambiar entre las dos.
 * El valor se guarda tal cual se escribe; quien lo usa lo convierte con el factor.
 */
export default function CantidadInput({
  unidad,
  valor,
  enGrande,
  onValor,
  onEnGrande,
  placeholder = "0",
  autoFocus,
}: CantidadInputProps) {
  const grande = unidadGrande(unidad);

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
      {grande ? (
        <button
          type="button"
          onClick={() => onEnGrande(!enGrande)}
          title={`Cambiar a ${enGrande ? unidad : grande.nombre}`}
          className="shrink-0 px-2.5 border-l border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-r-md"
        >
          {enGrande ? grande.nombre : unidad} ⇄
        </button>
      ) : (
        <span className="shrink-0 px-2.5 flex items-center border-l border-slate-200 text-xs font-semibold text-slate-500">
          {formatUnidad(unidad, 2)}
        </span>
      )}
    </div>
  );
}
