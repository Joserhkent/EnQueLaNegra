import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateItemKitchenStatusDto {
  @IsNotEmpty()
  @IsIn(['PENDING', 'IN_KITCHEN', 'DELIVERED'])
  kitchenStatus!: string;
}
