import { ConfigService } from './config.service';
import { IConfigRepository } from '../../interfaces/repositories/iConfigRepository.interface';
import { IChangelogRepository } from '../../interfaces/repositories/iChangelogRepository.interface';
import { ConfigEntity } from '../entities/config.entity';
import { ChangelogType } from '../../enums/changelogType.enum';

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockConfigRepo: jest.Mocked<IConfigRepository>;
  let mockChangelogRepo: jest.Mocked<IChangelogRepository>;

  beforeEach(() => {
    mockConfigRepo = {
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
    };

    mockChangelogRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
    };

    configService = new ConfigService(mockConfigRepo, mockChangelogRepo);
  });

  describe('updateConfig', () => {
    it('should update config and create a changelog entry', async () => {
      // Arrange
      const oldConfig = new ConfigEntity({ cpuThreshold: 70, ramThreshold: 80, monitoringInterval: 5 });
      const newConfigData = { cpuThreshold: 85 };
      const updatedConfig = new ConfigEntity({ cpuThreshold: 85, ramThreshold: 80, monitoringInterval: 5 });

      mockConfigRepo.getConfig.mockResolvedValue(oldConfig);
      mockConfigRepo.updateConfig.mockResolvedValue(updatedConfig);

      // Act
      const result = await configService.updateConfig(newConfigData, 1);

      // Assert
      expect(mockConfigRepo.updateConfig).toHaveBeenCalledWith(newConfigData);
      expect(mockChangelogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: ChangelogType.CPU,
          id_usuario: 1,
          old: { cpuThreshold: 70 },
          new: { cpuThreshold: 85 }
        })
      );
      expect(result.cpuThreshold).toBe(85);
    });
  });
});
