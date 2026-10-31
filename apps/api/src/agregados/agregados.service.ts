import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAgregadoDto, UpdateAgregadoDto } from './dto/agregado.dto';

@Injectable()
export class AgregadosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.agregado.findMany({
      include: {
        insumo: {
          select: { nombre: true, unidadMedida: true, stockActual: true },
        },
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  private async assertInsumo(insumoId: string) {
    const existe = await this.prisma.insumo.findUnique({
      where: { id: insumoId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('El insumo ya no existe');
  }

  async create(dto: CreateAgregadoDto) {
    await this.assertInsumo(dto.insumoId);
    return this.prisma.agregado.create({
      data: { ...dto, nombre: dto.nombre.trim() },
    });
  }

  async update(id: string, dto: UpdateAgregadoDto) {
    await this.findOne(id);
    if (dto.insumoId) await this.assertInsumo(dto.insumoId);
    return this.prisma.agregado.update({
      where: { id },
      data: { ...dto, ...(dto.nombre ? { nombre: dto.nombre.trim() } : {}) },
    });
  }

  // Los pedidos ya vendidos guardan su propio precio e insumo, así que borrar no los afecta
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.agregado.delete({ where: { id } });
  }

  private async findOne(id: string) {
    const agregado = await this.prisma.agregado.findUnique({ where: { id } });
    if (!agregado) throw new NotFoundException('Agregado no encontrado');
    return agregado;
  }
}
