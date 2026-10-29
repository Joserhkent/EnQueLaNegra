import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriaTipo } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

  // Normaliza la receta entrante: acepta string[] (compatibilidad) o
  // {insumoId, cantidad}[] con la cantidad real que descontará del inventario.
  private normalizarReceta(
    receta?: (string | { insumoId: string; cantidad: number })[],
  ): { insumoId: string; cantidad: number }[] {
    if (!Array.isArray(receta)) return [];
    return receta
      .map((item) =>
        typeof item === 'string'
          ? { insumoId: item, cantidad: 1.0 }
          : { insumoId: item.insumoId, cantidad: Number(item.cantidad) || 1.0 },
      )
      .filter((i) => i.insumoId && i.cantidad > 0);
  }

  // El frontend solo conoce nombres de categoría fijos (los del <select>), no UUIDs.
  // Resuelve el nombre a la Categoria real (tipo PRODUCTO) para obtener su id.
  private async resolveCategoriaId(nombre: string): Promise<string> {
    const categoria = await this.prisma.categoria.findFirst({
      where: { nombre, tipo: CategoriaTipo.PRODUCTO },
    });
    if (!categoria) {
      throw new NotFoundException(
        `Categoría de producto "${nombre}" no existe`,
      );
    }
    return categoria.id;
  }

  async findAll() {
    return this.prisma.producto.findMany({
      include: {
        categoria: true,
        recetaItems: {
          include: { insumo: true },
        },
      },
      orderBy: { sku: 'asc' },
    });
  }

  async findOne(id: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
        recetaItems: {
          include: { insumo: true },
        },
      },
    });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    return producto;
  }

  async create(dto: CreateProductoDto) {
    const { receta, categoria, ...data } = dto;
    const categoriaId = await this.resolveCategoriaId(categoria);

    return this.prisma.producto.create({
      data: {
        ...data,
        categoriaId,
        recetaItems:
          receta && receta.length > 0
            ? {
                create: this.normalizarReceta(receta).map((r) => ({
                  insumoId: r.insumoId,
                  cantidadRequerida: r.cantidad,
                })),
              }
            : undefined,
      },
      include: {
        categoria: true,
        recetaItems: { include: { insumo: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProductoDto) {
    await this.findOne(id);
    const { receta, categoria, ...data } = dto;

    const categoriaId =
      categoria !== undefined
        ? await this.resolveCategoriaId(categoria)
        : undefined;

    if (receta !== undefined) {
      await this.prisma.recetaItem.deleteMany({ where: { productoId: id } });
      const recetaNormalizada = this.normalizarReceta(receta);
      if (recetaNormalizada.length > 0) {
        await this.prisma.recetaItem.createMany({
          data: recetaNormalizada.map((r) => ({
            productoId: id,
            insumoId: r.insumoId,
            cantidadRequerida: r.cantidad,
          })),
        });
      }
    }

    return this.prisma.producto.update({
      where: { id },
      data: { ...data, ...(categoriaId ? { categoriaId } : {}) },
      include: {
        categoria: true,
        recetaItems: { include: { insumo: true } },
      },
    });
  }

  async toggleAvailability(id: string) {
    const prod = await this.findOne(id);
    return this.prisma.producto.update({
      where: { id },
      data: { isAvailable: !prod.isAvailable },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
<<<<<<< Updated upstream
=======
    const orderItemsCount = await this.prisma.orderItem.count({
      where: { productoId: id },
    });

    if (orderItemsCount > 0) {
      // Si el producto ya se ha vendido en comandas históricas, no podemos borrarlo de la BD
      // porque rompería la integridad de los reportes y comandas previas.
      // En su lugar, lo marcamos como no disponible (isAvailable: false).
      return this.prisma.producto.update({
        where: { id },
        data: { isAvailable: false },
      });
    }

>>>>>>> Stashed changes
    return this.prisma.producto.delete({ where: { id } });
  }
}
