import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriaTipo } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import {
  OrdenCategoriasDto,
  UpdateCategoriaDto,
} from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  findAll(tipo?: string) {
    return this.prisma.categoria.findMany({
      where: tipo ? { tipo: tipo.toUpperCase() as CategoriaTipo } : undefined,
      include: {
        _count: {
          select: { productos: true, insumos: true },
        },
      },
      orderBy: [{ tipo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async create(dto: CreateCategoriaDto) {
    const nombre = dto.nombre.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre de la categoría es obligatorio');
    }

    const existente = await this.prisma.categoria.findFirst({
      where: { nombre, tipo: dto.tipo },
    });
    if (existente) {
      throw new BadRequestException(
        `La categoría "${nombre}" ya existe para este tipo`,
      );
    }

    // Las categorías nuevas van al final de su tipo (tras la última, aunque se hayan
    // borrado otras: contar las existentes podía repetir un número)
    const ultima = await this.prisma.categoria.aggregate({
      where: { tipo: dto.tipo },
      _max: { orden: true },
    });

    return this.prisma.categoria.create({
      data: {
        nombre,
        tipo: dto.tipo,
        orden: (ultima._max.orden ?? -1) + 1,
      },
    });
  }

  // Renombrar o cambiar si acepta agregados. Productos e insumos apuntan a la
  // categoría por id, así que renombrar no los toca.
  async update(id: string, dto: UpdateCategoriaDto) {
    const categoria = await this.prisma.categoria.findUnique({ where: { id } });
    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }
    const nombre = dto.nombre?.trim();
    if (nombre !== undefined && nombre !== categoria.nombre) {
      if (!nombre) {
        throw new BadRequestException(
          'El nombre de la categoría es obligatorio',
        );
      }
      const repetida = await this.prisma.categoria.findFirst({
        where: { nombre, tipo: categoria.tipo, id: { not: id } },
      });
      if (repetida) {
        throw new BadRequestException(`Ya existe una categoría "${nombre}"`);
      }
    }
    return this.prisma.categoria.update({
      where: { id },
      data: { nombre, aceptaAgregados: dto.aceptaAgregados },
    });
  }

  // Guarda el orden en que se muestran (al pedir y en las listas)
  async ordenar(dto: OrdenCategoriasDto) {
    const actuales = await this.prisma.categoria.findMany({
      where: { tipo: dto.tipo },
      select: { id: true },
    });
    const enviados = new Set(dto.ids);
    if (
      enviados.size !== dto.ids.length ||
      actuales.length !== dto.ids.length ||
      actuales.some((c) => !enviados.has(c.id))
    ) {
      throw new BadRequestException(
        'La lista de categorías cambió. Actualiza la pantalla e inténtalo de nuevo.',
      );
    }
    await this.prisma.$transaction(
      dto.ids.map((id, orden) =>
        this.prisma.categoria.update({ where: { id }, data: { orden } }),
      ),
    );
    return this.findAll(dto.tipo);
  }

  async remove(id: string) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id },
      include: {
        _count: { select: { productos: true, insumos: true } },
      },
    });

    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    // No se puede eliminar una categoría con productos o insumos asignados:
    // se evita dejar registros huérfanos en la BD.
    if (categoria._count.productos > 0 || categoria._count.insumos > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${categoria.nombre}" porque tiene ${categoria._count.productos} producto(s) y ${categoria._count.insumos} insumo(s) asociados. Mueve o elimina esos registros primero.`,
      );
    }

    return this.prisma.categoria.delete({ where: { id } });
  }
}
