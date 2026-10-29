import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InsumosService } from './insumos.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JefeGuard } from '../auth/jefe.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('insumos')
export class InsumosController {
  constructor(private readonly insumosService: InsumosService) {}

  @Get()
  findAll() {
    return this.insumosService.findAll();
  }

  @Get('movimientos')
  getMovimientos() {
    return this.insumosService.getMovimientos();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.insumosService.findOne(id);
  }

  @UseGuards(JefeGuard)
  @Post()
  create(@Body() createInsumoDto: CreateInsumoDto) {
    return this.insumosService.create(createInsumoDto);
  }

  @Post(':id/movimiento')
  updateStock(
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
    @GetUser('id') userId?: string,
  ) {
    return this.insumosService.updateStock(id, dto, userId);
  }

  @UseGuards(JefeGuard)
  @Patch(':id/minimo')
  updateMinimo(
    @Param('id') id: string,
    @Body('stockMinimo') stockMinimo: number,
  ) {
    return this.insumosService.updateMinimo(id, stockMinimo);
  }

  @UseGuards(JefeGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.insumosService.remove(id);
  }
}
