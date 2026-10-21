import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateTableDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  number?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;
}
