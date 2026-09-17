import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';

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

  @IsArray()
  @IsOptional()
  receta?: string[];
}
