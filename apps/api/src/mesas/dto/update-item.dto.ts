import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateItemDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  cantidad?: number;

  @IsString()
  @IsOptional()
  notas?: string;
}
