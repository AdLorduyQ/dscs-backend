import { ServerEntity } from '../../core/entities/server.entity';

export interface IServerRepository {
  findAll(): Promise<ServerEntity[]>;
  findById(id: number): Promise<ServerEntity | null>;
  create(server: ServerEntity): Promise<ServerEntity>;
  update(id: number, server: Partial<ServerEntity>): Promise<ServerEntity>;
  delete(id: number): Promise<void>;
}
