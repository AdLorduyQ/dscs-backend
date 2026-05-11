import { PrismaClient } from '@prisma/client';
import { IConfigRepository } from '../../interfaces/repositories/iConfigRepository.interface';
import { ConfigEntity } from '../../core/entities/config.entity';

export class PrismaConfigRepository implements IConfigRepository {
  private prisma = new PrismaClient();

  async getConfig(): Promise<ConfigEntity> {
    const config = await this.prisma.config.upsert({
      where: { id: 1 },
      update: {},
      create: { cpuThreshold: 80, ramThreshold: 80, monitoringInterval: 5 },
    });
    return new ConfigEntity(config);
  }

  async updateConfig(config: Partial<ConfigEntity>): Promise<ConfigEntity> {
    const updated = await this.prisma.config.update({
      where: { id: 1 },
      data: config as any,
    });
    return new ConfigEntity(updated);
  }
}
