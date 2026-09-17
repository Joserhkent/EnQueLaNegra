import { IsOptional, IsString } from 'class-validator';

export class CreateCierreDto {
  @IsString()
  @IsOptional()
  notas?: string;
}
