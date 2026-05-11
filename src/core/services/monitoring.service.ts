import { IServerRepository } from '../../interfaces/repositories/iServerRepository.interface';
import { IConfigRepository } from '../../interfaces/repositories/iConfigRepository.interface';
import { AlertService } from './alert.service';
import { IWebSocketService } from '../../interfaces/services/iWebSocketService.interface';
import { AlertEntity } from '../entities/alert.entity';

export class MonitoringService {
  constructor(
    private readonly serverRepo: IServerRepository,
    private readonly configRepo: IConfigRepository,
    private readonly alertService: AlertService,
    private readonly webSocketService: IWebSocketService
  ) {}

  async startMonitoring() {
    const config = await this.configRepo.getConfig();
    const intervalMs = config.monitoringInterval * 1000;

    console.log(`[Motor] Monitoreo iniciado. Evaluando nodos cada ${config.monitoringInterval} segundos...`);

    setInterval(async () => {
      await this.evaluateMetrics();
    }, intervalMs);
  }

  private async evaluateMetrics() {
    const config = await this.configRepo.getConfig();
    const servers = await this.serverRepo.findAll();

    for (const server of servers) {
      if (!server.id) continue;

      // Ejemplo de como quedaria graficado para ver si funciona integracion backend - frontend
      // CAPU y RAM random entre 40 y 100%
      const newCpu = Math.floor(Math.random() * 60) + 40;
      const newRam = Math.floor(Math.random() * 60) + 40;
      
      await this.serverRepo.update(server.id, { cpu: newCpu, ram: newRam });

      if (newCpu >= config.cpuThreshold) {
        await this.triggerAlert(server.id, server.nombre, 'CPU', newCpu, config.cpuThreshold);
      }

      if (newRam >= config.ramThreshold) {
        await this.triggerAlert(server.id, server.nombre, 'RAM', newRam, config.ramThreshold);
      }
    }
  }

  private async triggerAlert(serverId: number, serverName: string, recurso: 'CPU' | 'RAM', valor: number, umbral: number) {
    const alert = new AlertEntity({
      serverId,
      tipo: 'CRITICAL',
      recurso,
      mensaje: `El recurso ${recurso} del nodo ${serverName} superó el umbral (${valor}% >= ${umbral}%)`,
      valor,
      umbral,
      resuelto: false,
    });

    const savedAlert = await this.alertService.createAlert(alert);

    this.webSocketService.emitAlert(savedAlert);

    // TODO Placeholder para Slack / Telegram
    this.sendExternalNotification(savedAlert);
  }

  private sendExternalNotification(alert: AlertEntity) {
    // TODO Implementar Webhooks para Slack y Telegram de Infraestructura
    // console.log(`[Slack/Telegram Notifier] Enviando mensaje al equipo); o algo del estilo
  }
}
