import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AgregadosService } from './agregados.service';
import { CreateAgregadoDto, UpdateAgregadoDto } from './dto/agregado.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JefeGuard } from '../auth/jefe.guard';

@UseGuards(JwtAuthGuard)
@Controller('agregados')
export class AgregadosController {
  constructor(private readonly agregadosService: AgregadosService) {}

  @Get()
  findAll() {
    return this.agregadosService.findAll();
  }

  @UseGuards(JefeGuard)
  @Post()
  create(@Body() dto: CreateAgregadoDto) {
    return this.agregadosService.create(dto);
  }

  @UseGuards(JefeGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgregadoDto) {
    return this.agregadosService.update(id, dto);
  }

  @UseGuards(JefeGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agregadosService.remove(id);
  }
}
