import { ConfigEntity } from '../../core/entities/config.entity';

export interface IConfigRepository {
  getConfig(): Promise<ConfigEntity>;
  updateConfig(config: Partial<ConfigEntity>): Promise<ConfigEntity>;
}
