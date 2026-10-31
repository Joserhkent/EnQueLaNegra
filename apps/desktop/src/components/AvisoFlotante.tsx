import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const EVENTO = "aviso-flotante";

// Muestra un aviso corto abajo de la pantalla desde cualquier parte de la app
// eslint-disable-next-line react-refresh/only-export-components
export const avisar = (texto: string) =>
  window.dispatchEvent(new CustomEvent<string>(EVENTO, { detail: texto }));

export default function AvisoFlotante() {
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null);

  useEffect(() => {
    const mostrar = (e: Event) =>
      setAviso({ texto: (e as CustomEvent<string>).detail, id: Date.now() });
    window.addEventListener(EVENTO, mostrar);
    return () => window.removeEventListener(EVENTO, mostrar);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!aviso) return null;

  return (
    <div
      role="status"
      key={aviso.id}
      className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 z-[60] max-w-[calc(100vw-2rem)] flex items-center gap-2 rounded-md bg-slate-900 text-white px-4 py-3 text-sm font-semibold shadow-lg print:hidden"
    >
      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
      {aviso.texto}
    </div>
  );
}
