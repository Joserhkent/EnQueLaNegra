import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateStockDto {
  @IsNumber()
  @IsOptional()
  cantidad?: number;

  // "entrada"/"salida": `cantidad` es la magnitud a sumar/restar.
  // "ajuste": `cantidad` es el nuevo valor ABSOLUTO de stock (conteo físico).
  @IsIn(['entrada', 'salida', 'ajuste'])
  @IsOptional()
  tipo?: 'entrada' | 'salida' | 'ajuste';

  @IsString()
  @IsOptional()
  motivo?: string;
}
