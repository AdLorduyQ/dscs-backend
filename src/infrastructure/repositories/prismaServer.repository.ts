import { PrismaClient } from '@prisma/client';
import { IServerRepository } from '../../interfaces/repositories/iServerRepository.interface';
import { ServerEntity } from '../../core/entities/server.entity';

export class PrismaServerRepository implements IServerRepository {
  private prisma = new PrismaClient();

  private mapToEntity(prismaServer: any): ServerEntity {
    return new ServerEntity({
      id: prismaServer.id,
      nombre: prismaServer.nombre,
      ip: prismaServer.ip,
      estado: prismaServer.estado,
      cpu: prismaServer.cpu,
      ram: prismaServer.ram,
      disco: prismaServer.disco,
      red: prismaServer.red,
    });
  }

  async findAll(): Promise<ServerEntity[]> {
    const servers = await this.prisma.server.findMany();
    return servers.map((s) => this.mapToEntity(s));
  }

  async findById(id: number): Promise<ServerEntity | null> {
    const server = await this.prisma.server.findUnique({ where: { id } });
    return server ? this.mapToEntity(server) : null;
  }

  async create(server: ServerEntity): Promise<ServerEntity> {
    const newServer = await this.prisma.server.create({
      data: {
        nombre: server.nombre,
        ip: server.ip,
        estado: server.estado,
        cpu: server.cpu,
        ram: server.ram,
        disco: server.disco,
        red: server.red,
      },
    });
    return this.mapToEntity(newServer);
  }

  async update(id: number, server: Partial<ServerEntity>): Promise<ServerEntity> {
    const updated = await this.prisma.server.update({
      where: { id },
      data: server as any,
    });
    return this.mapToEntity(updated);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.server.delete({ where: { id } });
  }
}
