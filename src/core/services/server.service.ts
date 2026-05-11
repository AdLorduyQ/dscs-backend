import { ServerEntity } from '../entities/server.entity';
import { IServerRepository } from '../../interfaces/repositories/iServerRepository.interface';

export class ServerService {
  constructor(private readonly serverRepository: IServerRepository) {}

  async getAllServers(): Promise<ServerEntity[]> {
    return await this.serverRepository.findAll();
  }

  async getServerById(id: number): Promise<ServerEntity> {
    const server = await this.serverRepository.findById(id);
    if (!server) {
      throw new Error('Servidor no encontrado');
    }
    return server;
  }

  async createServer(server: ServerEntity): Promise<ServerEntity> {
    return await this.serverRepository.create(server);
  }

  async updateServer(id: number, data: Partial<ServerEntity>): Promise<ServerEntity> {
    await this.getServerById(id);
    return await this.serverRepository.update(id, data);
  }

  async deleteServer(id: number): Promise<void> {
    await this.getServerById(id);
    await this.serverRepository.delete(id);
  }
}
