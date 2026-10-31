import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class MovimientoLoteItemDto {
  @IsString()
  insumoId: string;

  // Recepción: cuánto ingresó. Conteo: lo que se contó (nuevo stock absoluto).
  @IsNumber()
  @Min(0)
  cantidad: number;

  // Solo en recepción: costo por unidad del insumo (S/ por g, por unidad…).
  // Si viene, actualiza el costo del insumo con el precio de esta compra.
  @IsNumber()
  @Min(0)
  @IsOptional()
  costoUnitario?: number;
}

export class MovimientoLoteDto {
  @IsString()
  @IsOptional()
  motivo?: string;

  @ValidateNested({ each: true })
  @Type(() => MovimientoLoteItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  items: MovimientoLoteItemDto[];
}
