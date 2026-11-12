import { getFechaNegocio, getHoraCorteSesion, partsOf, verificarSesionOlvidada } from './date';

describe('REGLAS DE FECHA DE NEGOCIO Y CORTE (06:00 a.m. Lima)', () => {
  describe('partsOf con hourCycle h23', () => {
    it('garantiza formato 00 en medianoche (nunca "24")', () => {
      // 2026-11-12 00:00:00 Lima = 2026-11-12 05:00:00 UTC
      const d00 = new Date('2026-11-12T05:00:00.000Z');
      const parts = partsOf(d00);
      expect(parts.hour).toBe('00');
      expect(parts.minute).toBe('00');
      expect(parts.second).toBe('00');
      expect(parseInt(parts.hour, 10)).toBe(0);
    });

    it('extrae correctamente las horas en puntos clave del servicio nocturno', () => {
      // 00:30 Lima = 05:30 UTC
      const d0030 = new Date('2026-11-12T05:30:00.000Z');
      expect(partsOf(d0030).hour).toBe('00');
      expect(partsOf(d0030).minute).toBe('30');
      expect(parseInt(partsOf(d0030).hour, 10)).toBe(0);

      // 00:59 Lima = 05:59 UTC
      const d0059 = new Date('2026-11-12T05:59:00.000Z');
      expect(partsOf(d0059).hour).toBe('00');
      expect(partsOf(d0059).minute).toBe('59');
      expect(parseInt(partsOf(d0059).hour, 10)).toBe(0);

      // 01:48 Lima = 06:48 UTC (cierre tardío)
      const d0148 = new Date('2026-11-12T06:48:00.000Z');
      expect(partsOf(d0148).hour).toBe('01');
      expect(partsOf(d0148).minute).toBe('48');
      expect(parseInt(partsOf(d0148).hour, 10)).toBe(1);

      // 05:59:59 Lima = 10:59:59 UTC (justo antes del corte)
      const d0559 = new Date('2026-11-12T10:59:59.000Z');
      expect(partsOf(d0559).hour).toBe('05');
      expect(partsOf(d0559).minute).toBe('59');
      expect(parseInt(partsOf(d0559).hour, 10)).toBe(5);

      // 06:00:00 Lima = 11:00:00 UTC (momento exacto del corte)
      const d0600 = new Date('2026-11-12T11:00:00.000Z');
      expect(partsOf(d0600).hour).toBe('06');
      expect(partsOf(d0600).minute).toBe('00');
      expect(parseInt(partsOf(d0600).hour, 10)).toBe(6);
    });
  });

  describe('getFechaNegocio: corte a las 06:00 a.m. Lima', () => {
    it('viernes 15:00 Lima -> pertenece a la fecha de negocio del viernes', () => {
      const d = new Date('2026-11-13T20:00:00.000Z'); // 15:00 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-13');
    });

    it('viernes 23:55 Lima -> pertenece a la fecha de negocio del viernes', () => {
      const d = new Date('2026-11-14T04:55:00.000Z'); // 23:55 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-13');
    });

    it('sábado 00:00:00 Lima (medianoche) -> pertenece al viernes (fecha de negocio del turno anterior)', () => {
      const d = new Date('2026-11-14T05:00:00.000Z'); // 00:00 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-13');
    });

    it('sábado 00:50 Lima -> pertenece al viernes', () => {
      const d = new Date('2026-11-14T05:50:00.000Z'); // 00:50 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-13');
    });

    it('sábado 01:48 Lima -> pertenece al viernes', () => {
      const d = new Date('2026-11-14T06:48:00.000Z'); // 01:48 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-13');
    });

    it('sábado 05:59:59 Lima -> pertenece al viernes', () => {
      const d = new Date('2026-11-14T10:59:59.000Z'); // 05:59:59 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-13');
    });

    it('sábado 06:00:00 Lima -> corta y pertenece al sábado', () => {
      const d = new Date('2026-11-14T11:00:00.000Z'); // 06:00:00 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-14');
    });

    it('sábado 12:00:00 Lima -> pertenece al sábado', () => {
      const d = new Date('2026-11-14T17:00:00.000Z'); // 12:00:00 Lima
      expect(getFechaNegocio(d)).toBe('2026-11-14');
    });
  });

  describe('getHoraCorteSesion: corte de la sesión abierta es (fechaNegocio + 1 día) 06:00 a.m. Lima', () => {
    it('para una sesión abierta el viernes 2026-11-13 (a las 15:00 o 23:55), la hora de corte es sábado 14 a las 06:00 Lima', () => {
      const corte = getHoraCorteSesion('2026-11-13');
      // 2026-11-14 06:00:00 Lima = 2026-11-14 11:00:00 UTC
      expect(corte.toISOString()).toBe('2026-11-14T11:00:00.000Z');
    });

    it('evaluación de esSesionOlvidada con reloj simulado', () => {
      const fechaNegocioSesion = '2026-11-13';
      const horaCorte = getHoraCorteSesion(fechaNegocioSesion);

      // Viernes 15:00 Lima
      const t1500 = new Date('2026-11-13T20:00:00.000Z');
      expect(t1500.getTime() >= horaCorte.getTime()).toBe(false);
      expect(verificarSesionOlvidada(fechaNegocioSesion, t1500)).toBe(false);

      // Viernes 23:55 Lima
      const t2355 = new Date('2026-11-14T04:55:00.000Z');
      expect(t2355.getTime() >= horaCorte.getTime()).toBe(false);
      expect(verificarSesionOlvidada(fechaNegocioSesion, t2355)).toBe(false);

      // Sábado 00:50 Lima (medianoche pasada)
      const t0050 = new Date('2026-11-14T05:50:00.000Z');
      expect(t0050.getTime() >= horaCorte.getTime()).toBe(false);
      expect(verificarSesionOlvidada(fechaNegocioSesion, t0050)).toBe(false);

      // Sábado 01:48 Lima (cierre tardío)
      const t0148 = new Date('2026-11-14T06:48:00.000Z');
      expect(t0148.getTime() >= horaCorte.getTime()).toBe(false);
      expect(verificarSesionOlvidada(fechaNegocioSesion, t0148)).toBe(false);

      // Sábado 05:59:59 Lima
      const t0559 = new Date('2026-11-14T10:59:59.000Z');
      expect(t0559.getTime() >= horaCorte.getTime()).toBe(false);
      expect(verificarSesionOlvidada(fechaNegocioSesion, t0559)).toBe(false);

      // Sábado 06:00:00 Lima -> sesión olvidada activa aviso
      const t0600 = new Date('2026-11-14T11:00:00.000Z');
      expect(t0600.getTime() >= horaCorte.getTime()).toBe(true);
      expect(verificarSesionOlvidada(fechaNegocioSesion, t0600)).toBe(true);

      // Sábado 06:01:00 Lima -> sesión olvidada activa aviso
      const t0601 = new Date('2026-11-14T11:01:00.000Z');
      expect(t0601.getTime() >= horaCorte.getTime()).toBe(true);
      expect(verificarSesionOlvidada(fechaNegocioSesion, t0601)).toBe(true);
    });
  });
});
