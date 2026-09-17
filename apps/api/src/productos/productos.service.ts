import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriaTipo } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

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
                create: receta.map((insumoId) => ({
                  insumoId,
                  cantidadRequerida: 1.0,
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
      if (receta.length > 0) {
        await this.prisma.recetaItem.createMany({
          data: receta.map((insumoId) => ({
            productoId: id,
            insumoId,
            cantidadRequerida: 1.0,
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
    return this.prisma.producto.delete({ where: { id } });
  }
}
