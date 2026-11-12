// Fecha y hora del negocio (Perú, UTC-5, sin horario de verano), independientes de la
// zona horaria del servidor: en un hosting en UTC, `getDate()` y `toISOString()`
// cambian de día a las 7 pm hora local.
const TIME_ZONE = 'America/Lima';

export function partsOf(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function formatFecha(d: Date = new Date()): string {
  const { year, month, day } = partsOf(d);
  return `${year}-${month}-${day}`;
}

export function formatHora(d: Date = new Date()): string {
  const { hour, minute } = partsOf(d);
  return `${hour}:${minute}`;
}

/**
 * Fecha de negocio en America/Lima con hora de corte a las 06:00 a.m.
 * Cualquier transacción antes de las 06:00 a.m. pertenece a la jornada del día anterior.
 */
export function getFechaNegocio(d: Date = new Date()): string {
  const { year, month, day, hour } = partsOf(d);
  const hourNum = parseInt(hour, 10);
  if (hourNum < 6) {
    const prevDay = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const prevParts = partsOf(prevDay);
    return `${prevParts.year}-${prevParts.month}-${prevParts.day}`;
  }
  return `${year}-${month}-${day}`;
}

/**
 * Calcula el timestamp exacto de corte para una sesión olvidada:
 * (fechaNegocio + 1 día) a las 06:00 a.m. America/Lima (UTC-5).
 */
export function getHoraCorteSesion(fechaNegocio: string): Date {
  const [y, m, d] = fechaNegocio.split('-').map(Number);
  const siguienteDia = new Date(Date.UTC(y, m - 1, d + 1));
  const sy = siguienteDia.getUTCFullYear();
  const sm = String(siguienteDia.getUTCMonth() + 1).padStart(2, '0');
  const sd = String(siguienteDia.getUTCDate()).padStart(2, '0');
  return new Date(`${sy}-${sm}-${sd}T06:00:00-05:00`);
}

/**
 * Determina si una sesión quedó abierta de una jornada anterior (olvidada):
 * Retorna true únicamente cuando el momento actual supera (fechaNegocio + 1 día) a las 06:00 a.m. Lima.
 */
export function verificarSesionOlvidada(fechaNegocio: string, ahora: Date = new Date()): boolean {
  const horaCorte = getHoraCorteSesion(fechaNegocio);
  return ahora.getTime() >= horaCorte.getTime();
}
