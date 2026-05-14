import { ConfigEntity } from '../entities/config.entity';
import { ChangelogEntity } from '../entities/changelog.entity';
import { IConfigRepository } from '../../interfaces/repositories/iConfigRepository.interface';
import { IChangelogRepository } from '../../interfaces/repositories/iChangelogRepository.interface';
import { ChangelogType } from '../../enums/changelogType.enum';
import { SlackUtil } from '../../utils/slack.util';

export class ConfigService {
  constructor(
    private readonly configRepo: IConfigRepository,
    private readonly changelogRepo: IChangelogRepository
  ) {}

  async getConfig(): Promise<ConfigEntity> {
    return await this.configRepo.getConfig();
  }

  async getChangelogs(): Promise<ChangelogEntity[]> {
    return await this.changelogRepo.findAll();
  }

  async updateConfig(newData: Partial<ConfigEntity>, userId: number): Promise<ConfigEntity> {
    const oldConfig = await this.configRepo.getConfig();

    const updatedConfig = await this.configRepo.updateConfig(newData);

    if (newData.cpuThreshold && newData.cpuThreshold !== oldConfig.cpuThreshold) {
      await this.changelogRepo.create(new ChangelogEntity({
        descripcion: 'Se actualizó el umbral de CPU',
        tipo: ChangelogType.CPU,
        old: { cpuThreshold: oldConfig.cpuThreshold },
        new: { cpuThreshold: newData.cpuThreshold },
        id_usuario: userId
      }));
      await SlackUtil.send(`⚙️ CONFIGURACIÓN ACTUALIZADA: Umbral de CPU cambió de ${oldConfig.cpuThreshold}% a ${newData.cpuThreshold}%`);
    }

    if (newData.ramThreshold && newData.ramThreshold !== oldConfig.ramThreshold) {
      await this.changelogRepo.create(new ChangelogEntity({
        descripcion: 'Se actualizó el umbral de RAM',
        tipo: ChangelogType.RAM,
        old: { ramThreshold: oldConfig.ramThreshold },
        new: { ramThreshold: newData.ramThreshold },
        id_usuario: userId
      }));
      await SlackUtil.send(`⚙️ CONFIGURACIÓN ACTUALIZADA: Umbral de RAM cambió de ${oldConfig.ramThreshold}% a ${newData.ramThreshold}%`);
    }

    return updatedConfig;
  }
}
