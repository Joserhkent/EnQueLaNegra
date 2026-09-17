import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';

export class UpdateProductoDto {
  @IsString()
  @IsOptional()
  sku?: string;

  // Nombre de la categoría (ej. "Hamburguesas de Carne"), no su UUID:
  // el frontend solo conoce nombres fijos, el service resuelve el id real.
  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsNumber()
  @IsOptional()
  precio?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  iconoEmoji?: string;

  @IsArray()
  @IsOptional()
  receta?: string[];
}
