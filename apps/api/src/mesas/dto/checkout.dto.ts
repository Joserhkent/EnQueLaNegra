import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentMethodDto } from '../../pedidos/dto/create-pedido.dto';

export class CheckoutDto {
  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto = PaymentMethodDto.EFECTIVO;

  // Solo se usan cuando paymentMethod = MIXTO
  @IsNumber()
  @Min(0)
  @IsOptional()
  montoEfectivo?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoDigital?: number;
}
