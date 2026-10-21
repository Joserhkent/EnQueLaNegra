import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { MesasService } from './mesas.service';
import { OpenTableDto } from './dto/open-table.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PartialPaymentDto } from './dto/partial-payment.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { JoinTablesDto } from './dto/join-tables.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { UpdateTableDto } from './dto/update-table.dto';

@Controller('tables')
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  @Get()
  findAll() {
    return this.mesasService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateTableDto, @GetUser() user: AuthenticatedUser) {
    this.assertManager(user);
    return this.mesasService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    this.assertManager(user);
    return this.mesasService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: AuthenticatedUser) {
    this.assertManager(user);
    return this.mesasService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  join(@Param('id') id: string, @Body() dto: JoinTablesDto) {
    return this.mesasService.join(id, dto);
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
  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
    @GetUser('id') userId?: string,
  ) {
    return this.mesasService.updateItem(id, itemId, dto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @GetUser('id') userId?: string,
  ) {
    return this.mesasService.removeItem(id, itemId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pre-bill')
  preBill(@Param('id') id: string) {
    return this.mesasService.preBill(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/partial-payment')
  partialPayment(
    @Param('id') id: string,
    @Body() dto: PartialPaymentDto,
    @GetUser('id') userId?: string,
  ) {
    return this.mesasService.partialPayment(id, dto, userId);
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

  private assertManager(user?: AuthenticatedUser) {
    const role = user?.rol?.nombre.toLowerCase();
    if (role !== 'jefe' && role !== 'admin' && role !== 'administrador') {
      throw new ForbiddenException(
        'Solo el administrador puede editar o eliminar mesas',
      );
    }
  }
}
