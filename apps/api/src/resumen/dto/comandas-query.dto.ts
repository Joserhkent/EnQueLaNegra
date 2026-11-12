import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { RangoDashboard } from './resumen-dashboard.dto';

export class ComandasQueryDto {
  @IsOptional()
  @IsEnum(RangoDashboard)
  rango?: RangoDashboard = RangoDashboard.JORNADA;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaNegocio debe tener formato YYYY-MM-DD' })
  fechaNegocio?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
