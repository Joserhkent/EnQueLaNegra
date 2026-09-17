import { IsOptional, IsString } from 'class-validator';

export class OpenTableDto {
  @IsString()
  @IsOptional()
  customer?: string;
}
