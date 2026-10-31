import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import {
  OrdenCategoriasDto,
  UpdateCategoriaDto,
} from './dto/update-categoria.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JefeGuard } from '../auth/jefe.guard';

@UseGuards(JwtAuthGuard)
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  findAll(@Query('tipo') tipo?: string) {
    return this.categoriasService.findAll(tipo);
  }

  @UseGuards(JefeGuard)
  @Post()
  create(@Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(dto);
  }

  // Antes de ':id' para que «orden» no se tome como un id
  @UseGuards(JefeGuard)
  @Patch('orden')
  ordenar(@Body() dto: OrdenCategoriasDto) {
    return this.categoriasService.ordenar(dto);
  }

  @UseGuards(JefeGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    return this.categoriasService.update(id, dto);
  }

  @UseGuards(JefeGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriasService.remove(id);
  }
}
