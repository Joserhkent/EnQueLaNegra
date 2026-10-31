import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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
  @Min(0)
  @IsOptional()
  cantidad?: number = 1;

  @IsNumber()
  @Min(0)
  @IsOptional()
  precioExtra?: number = 0;

  // Si viene, el servidor toma de ese agregado el insumo, el precio y el consumo
  @IsString()
  @IsOptional()
  agregadoId?: string;

  // Sin decorador: el cliente no lo puede mandar (whitelist); lo pone resolverAgregados
  consumo?: number;
}

export class PedidoItemDto {
  @IsString()
  @IsOptional()
  productoId?: string;

  @IsString()
  @IsNotEmpty()
  sku = '';

  @IsString()
  @IsNotEmpty()
  nombre = '';

  @IsNumber()
  @Min(0)
  precio = 0;

  @IsInt()
  @Min(1)
  cantidad = 1;

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
  @Min(0)
  @IsOptional()
  montoEfectivo?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoDigital?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PedidoItemDto)
  items: PedidoItemDto[] = [];
}
