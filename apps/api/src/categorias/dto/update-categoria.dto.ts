import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @IsOptional()
  nombre?: string;

  // Solo tiene efecto en categorías de la carta
  @IsBoolean()
  @IsOptional()
  aceptaAgregados?: boolean;
}

// Nuevo orden de las categorías de un tipo: la lista completa de ids, de arriba abajo
export class OrdenCategoriasDto {
  @IsEnum(['PRODUCTO', 'INSUMO'])
  tipo: 'PRODUCTO' | 'INSUMO';

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];
}
