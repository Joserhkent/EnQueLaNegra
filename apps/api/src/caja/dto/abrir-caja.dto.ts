import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AbrirCajaDto {
  @IsNumber()
  @Min(0, { message: 'El monto inicial no puede ser negativo' })
  montoInicial: number;

  @IsString()
  @IsOptional()
  notas?: string;
}
