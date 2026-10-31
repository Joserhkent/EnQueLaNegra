import type { Mesa, Order } from "../store/usePosStore";

// La "estación de comandas" es el equipo que tiene la ticketera (la laptop de caja).
// Es un ajuste de ESTE navegador, no del usuario: solo un equipo debe tenerlo
// encendido para que cada comanda salga una sola vez.
const CLAVE_ESTACION = "estacion_comandas";
const CLAVE_IMPRESAS = "comandas_impresas";
const MAX_IMPRESAS = 500;

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const escribir = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): la estación no recuerda nada, no se rompe
  }
};

export const esEstacionComandas = () => leer(CLAVE_ESTACION) === "1";

const impresas = (): string[] => {
  try {
    return JSON.parse(leer(CLAVE_IMPRESAS) || "[]");
  } catch {
    return [];
  }
};

export const fueImpresa = (clave: string) => impresas().includes(clave);

export const marcarImpresas = (claves: string[]) => {
  if (claves.length === 0) return;
  const lista = [...new Set([...impresas(), ...claves])].slice(-MAX_IMPRESAS);
  escribir(CLAVE_IMPRESAS, JSON.stringify(lista));
};

// Una comanda pendiente: una tanda de una mesa o un pedido para llevar/delivery
export type Comanda = {
  clave: string;
  order: Order;
  mesaNumero: number | null;
  ronda: number | null;
};

export const claveTanda = (orderId: string, ronda: number) => `${orderId}-r${ronda}`;
export const clavePedido = (orderId: string) => `pedido-${orderId}`;

export const comandasActuales = (mesas: Mesa[], pedidos: Order[]): Comanda[] => {
  const lista: Comanda[] = [];
  for (const mesa of mesas) {
    const order = mesa.currentOrder;
    if (!order?.id || !order.items.length) continue;
    const rondas = [...new Set(order.items.map((i) => i.ronda ?? 1))].sort((a, b) => a - b);
    for (const ronda of rondas) {
      lista.push({ clave: claveTanda(order.id, ronda), order, mesaNumero: mesa.number, ronda });
    }
  }
  for (const order of pedidos) {
    if (order.status !== "preparacion" || order.type === "Mesa") continue;
    lista.push({ clave: clavePedido(order.id), order, mesaNumero: null, ronda: null });
  }
  return lista;
};

// Al encender la estación no se imprime lo que ya estaba en curso: solo lo nuevo
export const activarEstacionComandas = (activa: boolean, actuales: Comanda[]) => {
  escribir(CLAVE_ESTACION, activa ? "1" : "0");
  if (activa) marcarImpresas(actuales.map((c) => c.clave));
  window.dispatchEvent(new Event("estacion-comandas"));
};

// Aviso corto al llegar una comanda (sin archivos de audio)
export const sonarAviso = () => {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.16);
    });
  } catch {
    // Sin audio disponible: se imprime igual
  }
};
