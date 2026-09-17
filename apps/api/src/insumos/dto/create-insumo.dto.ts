import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInsumoDto {
  @IsString()
  @IsNotEmpty()
  id = '';

  @IsString()
  @IsNotEmpty()
  categoriaId = '';

  @IsString()
  @IsNotEmpty()
  nombre = '';

  @IsString()
  @IsNotEmpty()
  unidadMedida = '';

  @IsNumber()
  @IsOptional()
  stockActual = 0;

  @IsNumber()
  @IsOptional()
  stockMinimo = 0;

  @IsNumber()
  @IsOptional()
  costoUnitario = 0;
}
