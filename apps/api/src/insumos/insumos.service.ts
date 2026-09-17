import { Injectable, NotFoundException } from '@nestjs/common';
import { MovimientoTipo } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Injectable()
export class InsumosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.insumo.findMany({
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    const insumo = await this.prisma.insumo.findUnique({
      where: { id },
      include: { categoria: true },
    });

    if (!insumo) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }

    return insumo;
  }

  async getMovimientos() {
    return this.prisma.movimientoStock.findMany({
      include: { insumo: true },
      orderBy: { fecha: 'desc' },
    });
  }

  async create(dto: CreateInsumoDto) {
    return this.prisma.insumo.create({
      data: {
        ...dto,
        stockActual: dto.stockActual ?? 0,
        stockMinimo: dto.stockMinimo ?? 0,
        costoUnitario: dto.costoUnitario ?? 0,
      },
      include: { categoria: true },
    });
  }

  async updateStock(insumoId: string, dto: UpdateStockDto, userId?: string) {
    const insumo = await this.findOne(insumoId);
    const monto = dto.cantidad ?? 0;
    const tipo = dto.tipo ?? 'entrada';
    const motivo = dto.motivo ?? 'Ajuste manual';

    // "entrada" suma, "salida" resta (ambas mandan una magnitud positiva desde la UI),
    // "ajuste" fija `monto` como el nuevo valor absoluto de stock (conteo físico).
    const delta =
      tipo === 'salida'
        ? -Math.abs(monto)
        : tipo === 'ajuste'
          ? monto - insumo.stockActual
          : Math.abs(monto);

    const nuevoStock = Math.max(0, insumo.stockActual + delta);

    const updated = await this.prisma.insumo.update({
      where: { id: insumoId },
      data: { stockActual: nuevoStock },
    });

    await this.prisma.movimientoStock.create({
      data: {
        insumoId,
        tipo: tipo.toUpperCase() as MovimientoTipo,
        cantidad: Math.abs(delta),
        motivo,
        usuarioId: userId,
        usuario: 'Sistema POS',
      },
    });

    return updated;
  }

  async updateMinimo(id: string, stockMinimo: number) {
    await this.findOne(id);
    return this.prisma.insumo.update({
      where: { id },
      data: { stockMinimo },
    });
  }
}
