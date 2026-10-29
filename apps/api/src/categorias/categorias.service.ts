import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriaTipo } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';

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
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
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

    // Las categorías nuevas se ordenan al final de su tipo
    const count = await this.prisma.categoria.count({
      where: { tipo: dto.tipo },
    });

    return this.prisma.categoria.create({
      data: {
        nombre,
        tipo: dto.tipo,
        orden: count,
      },
    });
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
