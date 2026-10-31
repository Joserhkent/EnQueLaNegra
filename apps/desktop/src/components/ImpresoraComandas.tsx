import { useEffect, useState } from "react";
import { usePosStore } from "../store/usePosStore";
import TicketReceiptModal from "./TicketReceiptModal";
import {
  comandasActuales,
  esEstacionComandas,
  fueImpresa,
  marcarImpresas,
  sonarAviso,
  type Comanda,
} from "../lib/estacionComandas";

const CADA_MS = 5000;

/**
 * Corre solo en el equipo marcado como estación de comandas (la laptop con la
 * ticketera). Revisa cada pocos segundos si llegaron tandas nuevas desde otros
 * equipos (celulares de los mesoneros) y las imprime una por una.
 */
export default function ImpresoraComandas() {
  const { fetchMesas, fetchPedidos } = usePosStore();
  const [activa, setActiva] = useState(esEstacionComandas);
  const [cola, setCola] = useState<Comanda[]>([]);

  useEffect(() => {
    const actualizar = () => setActiva(esEstacionComandas());
    window.addEventListener("estacion-comandas", actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener("estacion-comandas", actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);

  useEffect(() => {
    if (!activa) return;
    const revisar = () => {
      fetchMesas();
      fetchPedidos();
    };
    revisar();
    const intervalo = setInterval(revisar, CADA_MS);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa]);

  // Cada vez que cambian mesas o pedidos (lo que trae la revisión periódica, o una
  // tanda enviada desde este mismo equipo) se encola lo que no se imprimió todavía
  // y se marca para no repetirlo
  useEffect(() => {
    if (!activa) return;
    return usePosStore.subscribe((estado, previo) => {
      if (estado.mesas === previo.mesas && estado.pedidos === previo.pedidos) return;
      const nuevas = comandasActuales(estado.mesas, estado.pedidos).filter((c) => !fueImpresa(c.clave));
      if (nuevas.length === 0) return;
      marcarImpresas(nuevas.map((c) => c.clave));
      sonarAviso();
      setCola((prev) => [...prev, ...nuevas]);
    });
  }, [activa]);

  const actual = cola[0];
  const [mostrando, setMostrando] = useState<string | null>(null);

  // Si hay otro ticket abierto en pantalla (una boleta, una precuenta) se espera a
  // que lo cierren, para no mandar los dos juntos a la ticketera
  useEffect(() => {
    if (!actual || mostrando === actual.clave) return;
    const intentar = () => {
      if (document.getElementById("printable-ticket")) return false;
      setMostrando(actual.clave);
      return true;
    };
    if (intentar()) return;
    const t = setInterval(() => intentar() && clearInterval(t), 1000);
    return () => clearInterval(t);
  }, [actual, mostrando]);

  if (!actual || mostrando !== actual.clave) return null;

  return (
    <TicketReceiptModal
      key={actual.clave}
      order={actual.order}
      mode="comanda"
      mesaNumero={actual.mesaNumero}
      soloRonda={actual.ronda}
      autoPrint
      onClose={() => {
        setMostrando(null);
        setCola((prev) => prev.slice(1));
      }}
    />
  );
}
