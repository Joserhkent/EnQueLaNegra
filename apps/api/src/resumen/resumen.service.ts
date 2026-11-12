import { Injectable } from '@nestjs/common';
import { EstadoCaja, OrderStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  formatHoraLabel,
  getDayOfWeekFromFechaNegocio,
  getFechaNegocio,
  getRangoMesNegocio,
  getRangoSemanaNegocio,
  partsOf,
} from '../common/date';
import { fromCents, toCents } from '../common/order-totals';
import {
  BarraGraficoDto,
  HoraPicoDto,
  RangoDashboard,
  ResumenDashboardResponseDto,
  ResumenQueryDto,
  TopProductoDto,
} from './dto/resumen-dashboard.dto';
import { ComandasQueryDto } from './dto/comandas-query.dto';

const DIAS_SEMANA_NOMBRES = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
];

const DIAS_SEMANA_ABREV = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export interface HorarioAtencion {
  diaSemana: string;
  apertura: number; // hora 24h
  cierre: number;   // hora 24h (madrugada = 1 o 2)
  toleranciaMargen: number; // +1 hora
}

@Injectable()
export class ResumenService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resuelve la fechaNegocio actual para el Resumen:
   * 1. Si el usuario la envía explícitamente, se usa esa.
   * 2. Si hay caja ABIERTA, se toma su fechaNegocio.
   * 3. Si no hay caja abierta, se toma la última fechaNegocio registrada en CajaSesion.
   * 4. Si la BD está vacía, se calcula getFechaNegocio() con el reloj actual (corte 06:00 a.m.).
   */
  async getJornadaActual(fechaNegocioInput?: string): Promise<string> {
    if (fechaNegocioInput && /^\d{4}-\d{2}-\d{2}$/.test(fechaNegocioInput)) {
      return fechaNegocioInput;
    }

    const sesionAbierta = await this.prisma.cajaSesion.findFirst({
      where: { estado: EstadoCaja.ABIERTA },
      select: { fechaNegocio: true },
    });
    if (sesionAbierta) {
      return sesionAbierta.fechaNegocio;
    }

    const ultimaSesion = await this.prisma.cajaSesion.findFirst({
      where: { id: { not: 'legacy-session-migracion' } },
      orderBy: { fechaApertura: 'desc' },
      select: { fechaNegocio: true },
    });
    if (ultimaSesion) {
      return ultimaSesion.fechaNegocio;
    }

    return getFechaNegocio(new Date());
  }

  /**
   * Obtiene la configuración de horario del restaurante según el día de la semana de la fechaNegocio:
   * - Sábado (6) y Domingo (0): 12:00 p.m. a 01:00 a.m. (+1h margen -> 02:00 a.m.)
   * - Lunes a Viernes (1-5): 3:00 p.m. a 01:00 a.m. (+1h margen -> 02:00 a.m.)
   */
  getHorarioConfig(fechaNegocio: string): HorarioAtencion {
    const diaNum = getDayOfWeekFromFechaNegocio(fechaNegocio);
    const diaSemana = DIAS_SEMANA_NOMBRES[diaNum] || 'DÍA';
    const esFinDeSemana = diaNum === 0 || diaNum === 6;

    return {
      diaSemana,
      apertura: esFinDeSemana ? 12 : 15,
      cierre: 1,
      toleranciaMargen: 1, // cubre hasta las 02:00 a.m.
    };
  }

  /**
   * Genera el eje cronológico de horas continuo para el turno que cruza medianoche:
   * Ej. Lunes a Viernes: 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2
   */
  generarEjeHorasCronologico(
    apertura: number,
    cierre: number,
    toleranciaMargen: number,
    horasConVentasExtra: number[] = [],
  ): number[] {
    const axis: number[] = [];
    let curr = apertura;
    const fin = (cierre + toleranciaMargen) % 24;

    while (true) {
      axis.push(curr);
      if (curr === fin) break;
      curr = (curr + 1) % 24;
      if (axis.length > 24) break;
    }

    // Si hubo ventas en horas fuera del horario habitual (ej. 14:00 o 03:00), expandir eje
    for (const h of horasConVentasExtra) {
      if (!axis.includes(h)) {
        if (h >= 12 && h < apertura) {
          // Venta antes de la apertura habitual: anteponer
          axis.unshift(h);
        } else {
          // Venta posterior: agregar al final
          axis.push(h);
        }
      }
    }

    return axis;
  }

  /**
   * Endpoint principal de agregación para el dashboard
   */
  async getDashboard(query: ResumenQueryDto): Promise<ResumenDashboardResponseDto> {
    const rango = query.rango || RangoDashboard.JORNADA;
    const fechaNegocio = await this.getJornadaActual(query.fechaNegocio);
    const horarioConfig = this.getHorarioConfig(fechaNegocio);

    let fechaInicio: string;
    let fechaFin: string;
    let esFiltroMes = false;

    if (rango === RangoDashboard.JORNADA) {
      fechaInicio = fechaNegocio;
      fechaFin = fechaNegocio;
    } else if (rango === RangoDashboard.SEMANA) {
      const semana = getRangoSemanaNegocio(fechaNegocio);
      fechaInicio = semana.inicio;
      fechaFin = semana.fin;
    } else {
      esFiltroMes = true;
      const mes = getRangoMesNegocio(fechaNegocio);
      fechaInicio = mes.inicio;
      fechaFin = mes.siguienteMes; // Exclusivo con lt
    }

    // 1. Obtener todos los pagos correspondientes a las sesiones de la jornada/periodo
    // (SUM de Pago.monto agrupado desde Pago vinculado a CajaSesion.fechaNegocio)
    const fechaCondition = esFiltroMes
      ? { gte: fechaInicio, lt: fechaFin }
      : { gte: fechaInicio, lte: fechaFin };

    const pagos = await this.prisma.pago.findMany({
      where: {
        cajaSesion: {
          fechaNegocio: fechaCondition,
        },
        order: {
          status: { not: OrderStatus.CANCELADO },
        },
      },
      include: {
        cajaSesion: { select: { id: true, fechaNegocio: true } },
        order: {
          select: {
            id: true,
            code: true,
            status: true,
            items: {
              select: {
                productoId: true,
                nombre: true,
                cantidad: true,
                precio: true,
              },
            },
          },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    // 2. Totales contables basados en Pago
    let totalVentasCents = 0;
    let efectivoTotalCents = 0;
    let digitalTotalCents = 0;
    const distinctOrderIds = new Set<string>();

    for (const p of pagos) {
      const montoCents = toCents(p.monto);
      totalVentasCents += montoCents;
      if (p.metodoPago === PaymentMethod.EFECTIVO) {
        efectivoTotalCents += montoCents;
      } else {
        digitalTotalCents += montoCents;
      }
      if (p.orderId) {
        distinctOrderIds.add(p.orderId);
      }
    }

    const totalVentas = fromCents(totalVentasCents);
    const efectivoTotal = fromCents(efectivoTotalCents);
    const digitalTotal = fromCents(digitalTotalCents);
    const totalComandas = distinctOrderIds.size;
    const ticketPromedio =
      totalComandas > 0 ? fromCents(Math.round(totalVentasCents / totalComandas)) : 0;

    // 3. Conteos por estado de las comandas de la jornada (subtítulo: "X en cocina, Y entregadas")
    const ordersInPeriod = await this.prisma.order.findMany({
      where: {
        fechaNegocio: fechaCondition,
        status: { not: OrderStatus.CANCELADO },
      },
      select: { id: true, status: true },
    });

    const conteosPorEstado = {
      enCocina: ordersInPeriod.filter((o) => o.status === OrderStatus.PREPARACION).length,
      listos: ordersInPeriod.filter((o) => o.status === OrderStatus.LISTO).length,
      entregados: ordersInPeriod.filter((o) => o.status === OrderStatus.ENTREGADO).length,
      abiertas: ordersInPeriod.filter((o) => o.status === OrderStatus.OPEN).length,
    };

    // 4. Generación del gráfico y horas pico
    let barras: BarraGraficoDto[] = [];
    let horaPico: HoraPicoDto | null = null;
    let franjas: ResumenDashboardResponseDto['franjas'] | undefined;

    if (rango === RangoDashboard.JORNADA) {
      // Extracción de la hora en America/Lima para cada pago
      const pagosConHoraLima = pagos.map((p) => {
        const parts = partsOf(p.fecha);
        const hourNum = parseInt(parts.hour, 10);
        return {
          ...p,
          hourNum,
        };
      });

      const horasConVentas = Array.from(new Set(pagosConHoraLima.map((p) => p.hourNum)));
      const ejeHoras = this.generarEjeHorasCronologico(
        horarioConfig.apertura,
        horarioConfig.cierre,
        horarioConfig.toleranciaMargen,
        horasConVentas,
      );

      // Agrupación por bucket de hora
      const bucketMap = new Map<
        number,
        {
          totalCents: number;
          efectivoCents: number;
          digitalCents: number;
          orderIds: Set<string>;
        }
      >();

      for (const h of ejeHoras) {
        bucketMap.set(h, {
          totalCents: 0,
          efectivoCents: 0,
          digitalCents: 0,
          orderIds: new Set<string>(),
        });
      }

      // Franjas del día: Tarde (12..18), Noche (19..23), Madrugada (0..5)
      let tardeCents = 0;
      let tardeOrders = new Set<string>();
      let nocheCents = 0;
      let nocheOrders = new Set<string>();
      let madrugadaCents = 0;
      let madrugadaOrders = new Set<string>();

      for (const p of pagosConHoraLima) {
        const b = bucketMap.get(p.hourNum);
        const montoCents = toCents(p.monto);
        if (b) {
          b.totalCents += montoCents;
          if (p.metodoPago === PaymentMethod.EFECTIVO) b.efectivoCents += montoCents;
          else b.digitalCents += montoCents;
          if (p.orderId) b.orderIds.add(p.orderId);
        }

        if (p.hourNum >= 12 && p.hourNum <= 18) {
          tardeCents += montoCents;
          if (p.orderId) tardeOrders.add(p.orderId);
        } else if (p.hourNum >= 19 && p.hourNum <= 23) {
          nocheCents += montoCents;
          if (p.orderId) nocheOrders.add(p.orderId);
        } else {
          madrugadaCents += montoCents;
          if (p.orderId) madrugadaOrders.add(p.orderId);
        }
      }

      // Encontrar hora pico
      let maxVentaHoraCents = 0;
      let maxHoraNum: number | null = null;
      for (const h of ejeHoras) {
        const b = bucketMap.get(h)!;
        if (b.totalCents > maxVentaHoraCents) {
          maxVentaHoraCents = b.totalCents;
          maxHoraNum = h;
        }
      }

      if (maxHoraNum !== null && maxVentaHoraCents > 0) {
        const b = bucketMap.get(maxHoraNum)!;
        horaPico = {
          hora: maxHoraNum,
          label: formatHoraLabel(maxHoraNum),
          total: fromCents(b.totalCents),
          comandas: b.orderIds.size,
        };
      }

      barras = ejeHoras.map((h) => {
        const b = bucketMap.get(h)!;
        return {
          clave: String(h),
          label: formatHoraLabel(h),
          total: fromCents(b.totalCents),
          comandas: b.orderIds.size,
          efectivo: fromCents(b.efectivoCents),
          digital: fromCents(b.digitalCents),
          esPico: maxHoraNum === h && b.totalCents > 0,
        };
      });

      // Franjas porcentuales
      const totalT = fromCents(tardeCents);
      const totalN = fromCents(nocheCents);
      const totalM = fromCents(madrugadaCents);
      franjas = {
        tarde: {
          total: totalT,
          porcentaje: totalVentas > 0 ? Math.round((totalT / totalVentas) * 100) : 0,
          comandas: tardeOrders.size,
        },
        noche: {
          total: totalN,
          porcentaje: totalVentas > 0 ? Math.round((totalN / totalVentas) * 100) : 0,
          comandas: nocheOrders.size,
        },
        madrugada: {
          total: totalM,
          porcentaje: totalVentas > 0 ? Math.round((totalM / totalVentas) * 100) : 0,
          comandas: madrugadaOrders.size,
        },
      };
    } else {
      // Rango SEMANA o MES: Gráfico por jornada (fechaNegocio)
      const jornadasMap = new Map<
        string,
        {
          totalCents: number;
          efectivoCents: number;
          digitalCents: number;
          orderIds: Set<string>;
        }
      >();

      for (const p of pagos) {
        const fn = p.cajaSesion?.fechaNegocio || fechaNegocio;
        if (!jornadasMap.has(fn)) {
          jornadasMap.set(fn, {
            totalCents: 0,
            efectivoCents: 0,
            digitalCents: 0,
            orderIds: new Set<string>(),
          });
        }
        const j = jornadasMap.get(fn)!;
        const montoCents = toCents(p.monto);
        j.totalCents += montoCents;
        if (p.metodoPago === PaymentMethod.EFECTIVO) j.efectivoCents += montoCents;
        else j.digitalCents += montoCents;
        if (p.orderId) j.orderIds.add(p.orderId);
      }

      // Ordenar fechas cronológicamente
      const fechasOrdenadas = Array.from(jornadasMap.keys()).sort();
      let maxVentaFechaCents = 0;
      let fechaPico: string | null = null;

      for (const fn of fechasOrdenadas) {
        const j = jornadasMap.get(fn)!;
        if (j.totalCents > maxVentaFechaCents) {
          maxVentaFechaCents = j.totalCents;
          fechaPico = fn;
        }
      }

      barras = fechasOrdenadas.map((fn) => {
        const j = jornadasMap.get(fn)!;
        const diaNum = getDayOfWeekFromFechaNegocio(fn);
        const abrev = DIAS_SEMANA_ABREV[diaNum] || '';
        const diaMes = fn.slice(8); // '11'
        return {
          clave: fn,
          label: `${abrev} ${diaMes}`,
          total: fromCents(j.totalCents),
          comandas: j.orderIds.size,
          efectivo: fromCents(j.efectivoCents),
          digital: fromCents(j.digitalCents),
          esPico: fechaPico === fn && j.totalCents > 0,
        };
      });
    }

    // 5. Ranking de Productos Más Vendidos
    const productSales = new Map<string, { cantidad: number; totalCents: number }>();
    for (const p of pagos) {
      if (p.order?.items) {
        for (const it of p.order.items) {
          const key = it.nombre;
          if (!productSales.has(key)) {
            productSales.set(key, { cantidad: 0, totalCents: 0 });
          }
          const itemStat = productSales.get(key)!;
          itemStat.cantidad += it.cantidad;
          itemStat.totalCents += toCents(it.precio * it.cantidad);
        }
      }
    }

    const topProductos: TopProductoDto[] = Array.from(productSales.entries())
      .map(([nombre, stat]) => ({
        nombre,
        cantidad: stat.cantidad,
        total: fromCents(stat.totalCents),
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    // 6. Comparación con semana anterior (mismo día de la semana anterior)
    let comparacionSemanaAnterior: ResumenDashboardResponseDto['comparacionSemanaAnterior'] = null;
    if (rango === RangoDashboard.JORNADA) {
      const [y, m, d] = fechaNegocio.split('-').map(Number);
      const fechaPrevDate = new Date(Date.UTC(y, m - 1, d - 7));
      const py = fechaPrevDate.getUTCFullYear();
      const pm = String(fechaPrevDate.getUTCMonth() + 1).padStart(2, '0');
      const pd = String(fechaPrevDate.getUTCDate()).padStart(2, '0');
      const fechaNegocioAnterior = `${py}-${pm}-${pd}`;

      const pagosSemanaAnterior = await this.prisma.pago.findMany({
        where: {
          cajaSesion: { fechaNegocio: fechaNegocioAnterior },
          order: { status: { not: OrderStatus.CANCELADO } },
        },
        select: { monto: true },
      });

      if (pagosSemanaAnterior.length > 0) {
        const totalVentasAnterior = fromCents(
          pagosSemanaAnterior.reduce((acc, p) => acc + toCents(p.monto), 0),
        );
        const diferenciaMonto = Number((totalVentas - totalVentasAnterior).toFixed(2));
        const diferenciaPorcentaje =
          totalVentasAnterior > 0
            ? Math.round(((totalVentas - totalVentasAnterior) / totalVentasAnterior) * 100)
            : 0;

        comparacionSemanaAnterior = {
          fechaNegocioAnterior,
          totalVentasAnterior,
          diferenciaMonto,
          diferenciaPorcentaje,
        };
      }
    }

    return {
      fechaNegocio,
      rango,
      fechaInicio,
      fechaFin: esFiltroMes ? fechaFin : fechaFin,
      horarioConfig: {
        diaSemana: horarioConfig.diaSemana,
        apertura: horarioConfig.apertura,
        cierre: horarioConfig.cierre,
      },
      kpis: {
        totalVentas,
        totalComandas,
        ticketPromedio,
        efectivoTotal,
        digitalTotal,
        horaPico,
        conteosPorEstado,
      },
      grafico: {
        tipo: rango === RangoDashboard.JORNADA ? 'horas' : 'jornadas',
        barras,
      },
      franjas,
      topProductos,
      comparacionSemanaAnterior,
    };
  }

  /**
   * Endpoint de comandas paginadas de la jornada o periodo para el feed del Dashboard
   */
  async getComandas(query: ComandasQueryDto) {
    const rango = query.rango || RangoDashboard.JORNADA;
    const fechaNegocio = await this.getJornadaActual(query.fechaNegocio);
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    let fechaInicio: string;
    let fechaFin: string;
    let esFiltroMes = false;

    if (rango === RangoDashboard.JORNADA) {
      fechaInicio = fechaNegocio;
      fechaFin = fechaNegocio;
    } else if (rango === RangoDashboard.SEMANA) {
      const semana = getRangoSemanaNegocio(fechaNegocio);
      fechaInicio = semana.inicio;
      fechaFin = semana.fin;
    } else {
      esFiltroMes = true;
      const mes = getRangoMesNegocio(fechaNegocio);
      fechaInicio = mes.inicio;
      fechaFin = mes.siguienteMes;
    }

    const where: any = {
      fechaNegocio: esFiltroMes
        ? { gte: fechaInicio, lt: fechaFin }
        : { gte: fechaInicio, lte: fechaFin },
      status: { not: OrderStatus.CANCELADO },
    };

    if (query.status && query.status !== 'all') {
      const statusUpper = query.status.toUpperCase();
      if (Object.values(OrderStatus).includes(statusUpper as OrderStatus)) {
        where.status = statusUpper as OrderStatus;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { customer: { contains: term, mode: 'insensitive' } },
        { items: { some: { nombre: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            select: {
              id: true,
              nombre: true,
              cantidad: true,
              precio: true,
              notas: true,
            },
          },
          pagos: {
            select: {
              id: true,
              monto: true,
              metodoPago: true,
              fecha: true,
            },
          },
          table: { select: { number: true } },
          user: { select: { name: true } },
        },
      }),
    ]);

    return {
      items: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
