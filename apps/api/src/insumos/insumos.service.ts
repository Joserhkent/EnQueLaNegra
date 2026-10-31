import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovimientoTipo } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { MovimientoLoteDto } from './dto/movimiento-lote.dto';

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

  // Varios insumos en una sola transacción: o se guarda todo, o nada.
  // "entrada" suma lo recibido (y actualiza el costo si viene); "ajuste" fija lo
  // contado como stock y registra la diferencia. Los conteos sin cambio no se registran.
  async movimientoLote(
    tipo: 'entrada' | 'ajuste',
    dto: MovimientoLoteDto,
    userId?: string,
  ) {
    const ids = [...new Set(dto.items.map((i) => i.insumoId))];
    if (ids.length !== dto.items.length) {
      throw new BadRequestException('Hay un insumo repetido en la lista.');
    }
    const motivo =
      dto.motivo?.trim() ||
      (tipo === 'entrada' ? 'Recepción de mercadería' : 'Conteo de inventario');

    return this.prisma.$transaction(async (tx) => {
      const insumos = await tx.insumo.findMany({ where: { id: { in: ids } } });
      const porId = new Map(insumos.map((i) => [i.id, i]));
      const faltan = ids.filter((id) => !porId.has(id));
      if (faltan.length) {
        throw new NotFoundException(
          `Insumos no encontrados: ${faltan.join(', ')}`,
        );
      }

      let registrados = 0;
      for (const item of dto.items) {
        const insumo = porId.get(item.insumoId)!;
        const delta =
          tipo === 'ajuste'
            ? item.cantidad - insumo.stockActual
            : item.cantidad;
        if (Math.abs(delta) < 1e-9 && item.costoUnitario === undefined)
          continue;

        await tx.insumo.update({
          where: { id: insumo.id },
          data: {
            stockActual: insumo.stockActual + delta,
            ...(tipo === 'entrada' && item.costoUnitario !== undefined
              ? { costoUnitario: item.costoUnitario }
              : {}),
          },
        });
        if (Math.abs(delta) >= 1e-9) {
          await tx.movimientoStock.create({
            data: {
              insumoId: insumo.id,
              tipo: tipo === 'entrada' ? 'ENTRADA' : 'AJUSTE',
              cantidad: Math.abs(delta),
              motivo:
                tipo === 'ajuste'
                  ? `${motivo}: ${insumo.stockActual} → ${item.cantidad} ${insumo.unidadMedida}`
                  : motivo,
              usuarioId: userId,
              usuario: 'Sistema POS',
            },
          });
        }
        registrados++;
      }
      return { registrados };
    });
  }

  async updateMinimo(id: string, stockMinimo: number) {
    await this.findOne(id);
    return this.prisma.insumo.update({
      where: { id },
      data: { stockMinimo },
    });
  }

  async remove(id: string) {
    const insumo = await this.findOne(id);

    const recetaCount = await this.prisma.recetaItem.count({
      where: { insumoId: id },
    });
    if (recetaCount > 0) {
      // El insumo forma parte de recetas de productos: no se puede borrar
      // sin romper el cálculo de descuento de stock.
      throw new BadRequestException(
        `No se puede eliminar "${insumo.nombre}" porque está siendo usado en ${recetaCount} receta(s) de productos.`,
      );
    }

    // Los extras de pedidos ya vendidos referencian el insumo (sin cascada).
    const extrasCount = await this.prisma.orderItemExtra.count({
      where: { insumoId: id },
    });
    if (extrasCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${insumo.nombre}" porque aparece como extra en ${extrasCount} ítem(s) de pedidos ya registrados.`,
      );
    }

    const movimientosCount = await this.prisma.movimientoStock.count({
      where: { insumoId: id },
    });

    if (movimientosCount > 0) {
      await this.prisma.movimientoStock.deleteMany({ where: { insumoId: id } });
    }

    return this.prisma.insumo.delete({ where: { id } });
  }
}
