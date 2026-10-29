import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(['PRODUCTO', 'INSUMO'])
  tipo: 'PRODUCTO' | 'INSUMO';
}
