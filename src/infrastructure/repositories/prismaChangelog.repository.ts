import { PrismaClient } from '@prisma/client';
import { IChangelogRepository } from '../../interfaces/repositories/iChangelogRepository.interface';
import { ChangelogEntity } from '../../core/entities/changelog.entity';

export class PrismaChangelogRepository implements IChangelogRepository {
  private prisma = new PrismaClient();

  async create(changelog: ChangelogEntity): Promise<ChangelogEntity> {
    const created = await this.prisma.changelog.create({
      data: {
        descripcion: changelog.descripcion,
        tipo: changelog.tipo,
        old: changelog.old ? JSON.parse(JSON.stringify(changelog.old)) : null,
        new: changelog.new ? JSON.parse(JSON.stringify(changelog.new)) : null,
        id_usuario: changelog.id_usuario,
      },
    });
    return new ChangelogEntity(created as any);
  }

  async findAll(): Promise<ChangelogEntity[]> {
    const logs = await this.prisma.changelog.findMany({
      orderBy: { fecha: 'desc' },
    });
    return logs.map((log) => new ChangelogEntity(log as any));
  }
}
