import { AlertEntity } from '../../core/entities/alert.entity';

export interface IWebSocketService {
  emitAlert(alert: AlertEntity): void;
}
