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
import { MovimientoLoteDto } from './dto/movimiento-lote.dto';
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

  // Varios insumos a la vez. Recibir mercadería lo puede hacer cualquier usuario
  // (a veces recibe un empleado); el conteo fija el stock y puede tapar faltantes,
  // así que es solo del jefe. Van antes de las rutas con :id.
  @Post('lote/entrada')
  recibirMercaderia(
    @Body() dto: MovimientoLoteDto,
    @GetUser('id') userId?: string,
  ) {
    return this.insumosService.movimientoLote('entrada', dto, userId);
  }

  @UseGuards(JefeGuard)
  @Post('lote/conteo')
  conteoInventario(
    @Body() dto: MovimientoLoteDto,
    @GetUser('id') userId?: string,
  ) {
    return this.insumosService.movimientoLote('ajuste', dto, userId);
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
