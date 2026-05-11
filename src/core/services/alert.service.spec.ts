import { AlertService } from './alert.service';
import { IAlertRepository } from '../../interfaces/repositories/iAlertRepository.interface';
import { AlertEntity } from '../entities/alert.entity';

describe('AlertService', () => {
  let alertService: AlertService;
  let mockAlertRepo: jest.Mocked<IAlertRepository>;

  beforeEach(() => {
    mockAlertRepo = {
      findByServer: jest.fn(),
      findActiveByServer: jest.fn(),
      resolve: jest.fn(),
      create: jest.fn(),
    };

    alertService = new AlertService(mockAlertRepo);
  });

  describe('resolveAlert', () => {
    it('should call repository resolve method and return the resolved alert', async () => {
      // Arrange
      const resolvedAlert = new AlertEntity({
        id: 'uuid-123',
        serverId: 1,
        tipo: 'CRITICAL',
        recurso: 'CPU',
        mensaje: 'CPU Alta',
        resuelto: true,
        resueltoEn: new Date(),
      });

      mockAlertRepo.resolve.mockResolvedValue(resolvedAlert);

      // Act
      const result = await alertService.resolveAlert('uuid-123');

      // Assert
      expect(mockAlertRepo.resolve).toHaveBeenCalledWith('uuid-123');
      expect(result.resuelto).toBe(true);
      expect(result.resueltoEn).toBeDefined();
    });
  });

  describe('getAlerts', () => {
    it('should return alerts based on filters', async () => {
      // Arrange
      mockAlertRepo.findByServer.mockResolvedValue([]);

      // Act
      const filters = { limit: 10, tipo: 'WARNING' };
      const result = await alertService.getAlerts(1, filters);

      // Assert
      expect(mockAlertRepo.findByServer).toHaveBeenCalledWith(1, filters);
      expect(result).toEqual([]);
    });
  });
});
