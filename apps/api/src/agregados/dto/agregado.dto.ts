import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAgregadoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  nombre = '';

  @IsNumber()
  @Min(0)
  precio = 0;

  @IsString()
  @IsNotEmpty()
  insumoId = '';

  // Cuánto insumo gasta 1 agregado, en la unidad del insumo (ej. 50 g, 2 tajadas)
  @IsNumber()
  @IsPositive()
  consumo = 1;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsInt()
  @IsOptional()
  orden?: number;
}

export class UpdateAgregadoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @IsOptional()
  nombre?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  precio?: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  insumoId?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  consumo?: number;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsInt()
  @IsOptional()
  orden?: number;
}
