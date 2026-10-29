import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// Ítem de receta BOM con su cantidad requerida (ej. 0.5 porciones de pollo).
export class RecetaItemDto {
  @IsString()
  @IsNotEmpty()
  insumoId: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cantidad: number;
}

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  // Nombre de la categoría (ej. "Hamburguesas de Carne"), no su UUID:
  // el frontend solo conoce nombres fijos, el service resuelve el id real.
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsNumber()
  @Min(0)
  precio: number;

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
