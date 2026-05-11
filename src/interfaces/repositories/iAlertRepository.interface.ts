import { AlertEntity } from '../../core/entities/alert.entity';

export interface AlertFilters {
  limit?: number;
  tipo?: string;
  recurso?: string;
  desde?: string; // ISO
  hasta?: string; // ISO
  resueltas?: boolean;
}

export interface IAlertRepository {
  findByServer(serverId: number, filters?: AlertFilters): Promise<AlertEntity[]>;
  findActiveByServer(serverId: number): Promise<AlertEntity[]>;
  resolve(id: string): Promise<AlertEntity>;
  create(alert: AlertEntity): Promise<AlertEntity>;
}
