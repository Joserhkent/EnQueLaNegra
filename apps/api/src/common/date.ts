// Fecha y hora del negocio (Perú, UTC-5, sin horario de verano), independientes de la
// zona horaria del servidor: en un hosting en UTC, `getDate()` y `toISOString()`
// cambian de día a las 7 pm hora local.
const TIME_ZONE = 'America/Lima';

function partsOf(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
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
