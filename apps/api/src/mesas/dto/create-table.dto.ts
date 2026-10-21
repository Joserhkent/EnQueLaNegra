import { IsInt, Min } from 'class-validator';

export class CreateTableDto {
  @IsInt()
  @Min(1)
  capacity: number;
}
