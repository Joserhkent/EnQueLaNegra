import { IsEnum, IsNumber, IsPositive } from 'class-validator';
import { PaymentMethodDto } from '../../pedidos/dto/create-pedido.dto';

export class PartialPaymentDto {
  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto = PaymentMethodDto.EFECTIVO;

  @IsNumber()
  @IsPositive()
  monto = 0;
}
