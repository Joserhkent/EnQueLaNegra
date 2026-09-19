import { IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';

export class UpdateItemDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  cantidad?: number;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsOptional()
  @IsIn(['PENDING', 'IN_KITCHEN', 'DELIVERED'])
  kitchenStatus?: string;
}
