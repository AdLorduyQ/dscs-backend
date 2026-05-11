export class AlertEntity {
  id?: string; // UUID
  serverId!: number;
  tipo!: 'CRITICAL' | 'WARNING' | 'INFO';
  recurso!: 'CPU' | 'RAM' | 'DISCO' | 'RED' | 'CONECTIVIDAD' | 'GENERAL';
  mensaje!: string;
  valor?: number;
  umbral?: number;
  timestamp?: Date;
  resuelto!: boolean;
  resueltoEn?: Date;

  constructor(partial: Partial<AlertEntity>) {
    Object.assign(this, partial);
  }
}
