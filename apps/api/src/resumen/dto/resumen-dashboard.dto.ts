import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export enum RangoDashboard {
  JORNADA = 'jornada',
  SEMANA = 'semana',
  MES = 'mes',
}

export class ResumenQueryDto {
  @IsOptional()
  @IsEnum(RangoDashboard)
  rango?: RangoDashboard = RangoDashboard.JORNADA;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaNegocio debe tener formato YYYY-MM-DD' })
  fechaNegocio?: string;
}

export interface HoraPicoDto {
  hora: number;
  label: string;
  total: number;
  comandas: number;
}

export interface BarraGraficoDto {
  clave: string;     // Hora (ej: "15") o Fecha (ej: "2026-11-11")
  label: string;     // "3:00 pm" o "Mié 11"
  total: number;
  comandas: number;
  efectivo: number;
  digital: number;
  esPico?: boolean;
}

export interface FranjaDto {
  total: number;
  porcentaje: number;
  comandas: number;
}

export interface TopProductoDto {
  nombre: string;
  cantidad: number;
  total: number;
}

export interface ResumenDashboardResponseDto {
  fechaNegocio: string;
  rango: RangoDashboard;
  fechaInicio: string;
  fechaFin: string;
  horarioConfig: {
    diaSemana: string;
    apertura: number;
    cierre: number;
  };
  kpis: {
    totalVentas: number;
    totalComandas: number;
    ticketPromedio: number;
    efectivoTotal: number;
    digitalTotal: number;
    horaPico: HoraPicoDto | null;
    conteosPorEstado: {
      enCocina: number;
      listos: number;
      entregados: number;
      abiertas: number;
    };
  };
  grafico: {
    tipo: 'horas' | 'jornadas';
    barras: BarraGraficoDto[];
  };
  franjas?: {
    tarde: FranjaDto;     // 12:00 a 18:59
    noche: FranjaDto;     // 19:00 a 23:59
    madrugada: FranjaDto; // 00:00 a 05:59
  };
  topProductos: TopProductoDto[];
  comparacionSemanaAnterior?: {
    fechaNegocioAnterior: string;
    totalVentasAnterior: number;
    diferenciaMonto: number;
    diferenciaPorcentaje: number;
  } | null;
}
