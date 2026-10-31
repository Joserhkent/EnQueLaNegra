import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Ajustes del insumo que la jefa puede cambiar desde Inventario. El stock no se
// edita aquí: se mueve con recepciones, conteos y ventas para que quede registro.
export class UpdateInsumoDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nombre?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stockMinimo?: number;

  // En la unidad del insumo (S/ por g, por ml, por unidad…)
  @IsNumber()
  @Min(0)
  @IsOptional()
  costoUnitario?: number;

  // null quita la presentación
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  presentacionNombre?: string | null;

  // Cuánto trae 1 presentación, en la unidad del insumo (ej. 130 g por lata)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @IsPositive()
  presentacionCantidad?: number | null;
}
