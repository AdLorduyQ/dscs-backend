import { AlertEntity } from '../entities/alert.entity';
import { IAlertRepository, AlertFilters } from '../../interfaces/repositories/iAlertRepository.interface';

export class AlertService {
  constructor(private readonly alertRepo: IAlertRepository) {}

  async getAlerts(serverId: number, filters?: AlertFilters): Promise<AlertEntity[]> {
    return await this.alertRepo.findByServer(serverId, filters);
  }

  async getActiveAlerts(serverId: number): Promise<AlertEntity[]> {
    return await this.alertRepo.findActiveByServer(serverId);
  }

  async resolveAlert(id: string): Promise<AlertEntity> {
    return await this.alertRepo.resolve(id);
  }

  async createAlert(alert: AlertEntity): Promise<AlertEntity> {
    return await this.alertRepo.create(alert);
  }
}
