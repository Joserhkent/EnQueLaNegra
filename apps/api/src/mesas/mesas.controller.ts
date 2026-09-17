import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MesasService } from './mesas.service';
import { OpenTableDto } from './dto/open-table.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@Controller('tables')
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  @Get()
  findAll() {
    return this.mesasService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/open')
  open(
    @Param('id') id: string,
    @Body() dto: OpenTableDto,
    @GetUser('id') userId?: string,
  ) {
    return this.mesasService.open(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/items')
  addItems(
    @Param('id') id: string,
    @Body() dto: AddItemsDto,
    @GetUser('id') userId?: string,
  ) {
    return this.mesasService.addItems(id, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pre-bill')
  preBill(@Param('id') id: string) {
    return this.mesasService.preBill(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/checkout')
  checkout(
    @Param('id') id: string,
    @Body() dto: CheckoutDto,
    @GetUser('id') userId?: string,
  ) {
    return this.mesasService.checkout(id, dto, userId);
  }
}
