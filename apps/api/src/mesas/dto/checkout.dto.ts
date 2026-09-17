import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PaymentMethodDto } from '../../pedidos/dto/create-pedido.dto';

export class CheckoutDto {
  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto = PaymentMethodDto.EFECTIVO;

  // Solo se usan cuando paymentMethod = MIXTO
  @IsNumber()
  @IsOptional()
  montoEfectivo?: number;

  @IsNumber()
  @IsOptional()
  montoDigital?: number;
}
