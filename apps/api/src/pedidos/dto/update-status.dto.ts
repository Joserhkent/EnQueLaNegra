import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;
}
