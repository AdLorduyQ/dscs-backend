import { PrismaClient, Prisma } from '@prisma/client';
import { IAlertRepository, AlertFilters } from '../../interfaces/repositories/iAlertRepository.interface';
import { AlertEntity } from '../../core/entities/alert.entity';

export class PrismaAlertRepository implements IAlertRepository {
  private prisma = new PrismaClient();

  private mapToEntity(prismaAlert: any): AlertEntity {
    return new AlertEntity(prismaAlert);
  }

  async findByServer(serverId: number, filters?: AlertFilters): Promise<AlertEntity[]> {
    const where: any = { serverId };

    if (filters) {
      if (filters.tipo) where.tipo = filters.tipo;
      if (filters.recurso) where.recurso = filters.recurso;
      if (filters.resueltas !== undefined) {
        where.resuelto = filters.resueltas.toString() === 'true';
      }
      if (filters.desde || filters.hasta) {
        where.timestamp = {};
        if (filters.desde) where.timestamp.gte = new Date(filters.desde);
        if (filters.hasta) where.timestamp.lte = new Date(filters.hasta);
      }
    }

    const alerts = await this.prisma.alert.findMany({
      where,
      take: filters?.limit ? Number(filters.limit) : 50,
      orderBy: { timestamp: 'desc' },
    });

    return alerts.map((a: any) => this.mapToEntity(a));
  }

  async findActiveByServer(serverId: number): Promise<AlertEntity[]> {
    const alerts = await this.prisma.alert.findMany({
      where: { serverId, resuelto: false },
      orderBy: { timestamp: 'desc' },
    });
    return alerts.map((a: any) => this.mapToEntity(a));
  }

  async resolve(id: string): Promise<AlertEntity> {
    const resolved = await this.prisma.alert.update({
      where: { id },
      data: {
        resuelto: true,
        resueltoEn: new Date(),
      },
    });
    return this.mapToEntity(resolved);
  }

  async create(alert: AlertEntity): Promise<AlertEntity> {
    const created = await this.prisma.alert.create({
      data: {
        serverId: alert.serverId,
        tipo: alert.tipo,
        recurso: alert.recurso,
        mensaje: alert.mensaje,
        valor: alert.valor,
        umbral: alert.umbral,
        resuelto: alert.resuelto || false,
      },
    });
    return this.mapToEntity(created);
  }
}
