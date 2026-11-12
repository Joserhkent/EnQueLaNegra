import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CerrarCajaDto {
  @IsNumber({}, { message: 'El efectivo contado en gaveta debe ser un número válido' })
  @Min(0, { message: 'El efectivo contado no puede ser negativo' })
  @IsNotEmpty({ message: 'El efectivo contado en gaveta (efectivoReal) es obligatorio' })
  efectivoReal: number;

  @IsNumber({}, { message: 'El fondo que queda debe ser un número válido' })
  @Min(0, { message: 'El fondo que queda no puede ser negativo' })
  @IsNotEmpty({ message: 'El fondo que queda en gaveta (fondoQueQueda) es obligatorio' })
  fondoQueQueda: number;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsBoolean()
  @IsOptional()
  forzarCierreConPendientes?: boolean;
}
