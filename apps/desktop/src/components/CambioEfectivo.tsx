import { useState } from "react";

// Billetes que circulan en Perú; los botones rápidos proponen el siguiente
// monto redondo con el que suele pagar el cliente.
const BILLETES = [10, 20, 50, 100, 200];

const montosSugeridos = (total: number) => {
  const sugeridos = BILLETES.map((b) => Math.ceil(total / b) * b).filter((m) => m > total);
  return [...new Set(sugeridos)].sort((a, b) => a - b).slice(0, 3);
};

type CambioEfectivoProps = {
  total: number;
};

/**
 * "Paga con" para cobros en efectivo: calcula el vuelto en el momento del cobro.
 * Es solo una ayuda para la cajera (como Toast o Square): no se guarda ni cambia
 * lo que se envía al backend. Vacío = pagó exacto.
 */
export default function CambioEfectivo({ total }: CambioEfectivoProps) {
  const [pagaCon, setPagaCon] = useState("");

  // Acepta coma o punto decimal: el teclado del celular en español escribe "35,50"
  const recibido = parseFloat(pagaCon.replace(",", ".")) || 0;
  const diferencia = Math.round((recibido - total) * 100) / 100;

  if (total <= 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <label className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold text-slate-600">Paga con (S/)</span>
        <input
          type="text"
          inputMode="decimal"
          value={pagaCon}
          onChange={(e) => setPagaCon(e.target.value)}
          placeholder={total.toFixed(2)}
          className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-right text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
      </label>

      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() => setPagaCon("")}
          className={`py-1.5 rounded-md text-[11px] font-bold border transition ${
            pagaCon === ""
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
          }`}
        >
          Exacto
        </button>
        {montosSugeridos(total).map((monto) => (
          <button
            key={monto}
            type="button"
            onClick={() => setPagaCon(String(monto))}
            className={`py-1.5 rounded-md text-[11px] font-bold border transition ${
              recibido === monto
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            S/ {monto}
          </button>
        ))}
      </div>

      {recibido > 0 && (
        diferencia >= 0 ? (
          <div className="flex items-baseline justify-between rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
            <span className="text-xs font-bold text-emerald-800">Vuelto</span>
            <span className="text-2xl font-display text-emerald-700">S/ {diferencia.toFixed(2)}</span>
          </div>
        ) : (
          <div className="flex items-baseline justify-between rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
            <span className="text-xs font-bold text-rose-800">Falta</span>
            <span className="text-2xl font-display text-rose-700">S/ {Math.abs(diferencia).toFixed(2)}</span>
          </div>
        )
      )}
    </div>
  );
}
