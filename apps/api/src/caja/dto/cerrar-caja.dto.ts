import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CerrarCajaDto {
  @IsNumber()
  @Min(0, { message: 'El efectivo contado no puede ser negativo' })
  @IsOptional()
  efectivoReal?: number;

  @IsString()
  @IsOptional()
  notas?: string;
}
