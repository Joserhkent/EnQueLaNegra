import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum OrderTypeDto {
  MESA = 'MESA',
  LLEVAR = 'LLEVAR',
  DELIVERY = 'DELIVERY',
}

export enum PaymentMethodDto {
  EFECTIVO = 'EFECTIVO',
  YAPE_PLIN = 'YAPE_PLIN',
  TARJETA = 'TARJETA',
  MIXTO = 'MIXTO',
}

export class PedidoItemExtraDto {
  @IsString()
  @IsNotEmpty()
  insumoId = '';

  @IsNumber()
  @IsOptional()
  cantidad?: number = 1;

  @IsNumber()
  @IsOptional()
  precioExtra?: number = 0;
}

export class PedidoItemDto {
  @IsString()
  @IsNotEmpty()
  productoId = '';

  @IsString()
  @IsNotEmpty()
  sku = '';

  @IsString()
  @IsNotEmpty()
  nombre = '';

  @IsNumber()
  @IsNotEmpty()
  precio = 0;

  @IsNumber()
  @IsNotEmpty()
  cantidad = 0;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PedidoItemExtraDto)
  extras?: PedidoItemExtraDto[];
}

export class CreatePedidoDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  customer?: string;

  @IsEnum(OrderTypeDto)
  @IsOptional()
  type?: OrderTypeDto;

  @IsEnum(PaymentMethodDto)
  @IsOptional()
  paymentMethod?: PaymentMethodDto;

  // Solo se usan cuando paymentMethod = MIXTO
  @IsNumber()
  @IsOptional()
  montoEfectivo?: number;

  @IsNumber()
  @IsOptional()
  montoDigital?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PedidoItemDto)
  items: PedidoItemDto[] = [];
}