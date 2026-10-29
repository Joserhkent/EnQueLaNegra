import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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
  @Min(0)
  @IsOptional()
  stockActual = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stockMinimo = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costoUnitario = 0;
}
