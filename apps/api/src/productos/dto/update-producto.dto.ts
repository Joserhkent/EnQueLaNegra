import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecetaItemDto } from './create-producto.dto';

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

  // Acepta {insumoId, cantidad}[] (cantidades específicas) y string[] heredado.
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RecetaItemDto)
  receta?: (string | RecetaItemDto)[];
}
