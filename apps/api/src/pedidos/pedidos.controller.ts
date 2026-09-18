import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  findAll() {
    return this.pedidosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pedidosService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createPedidoDto: CreatePedidoDto,
    @GetUser('id') userId?: string,
  ) {
    return this.pedidosService.create(createPedidoDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    if (!updateStatusDto.status) {
      throw new BadRequestException('El status del pedido es obligatorio');
    }

    return this.pedidosService.updateStatus(id, updateStatusDto.status);
  }
}
