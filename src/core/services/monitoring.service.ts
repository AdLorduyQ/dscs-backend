import * as k8s from '@kubernetes/client-node';
import { IServerRepository } from '../../interfaces/repositories/iServerRepository.interface';
import { IConfigRepository } from '../../interfaces/repositories/iConfigRepository.interface';
import { AlertService } from './alert.service';
import { IWebSocketService } from '../../interfaces/services/iWebSocketService.interface';
import { AlertEntity } from '../entities/alert.entity';

export class MonitoringService {
  private k8sApi: k8s.CoreV1Api;
  private metricsClient: k8s.CustomObjectsApi;

  constructor(
    private readonly serverRepo: IServerRepository,
    private readonly configRepo: IConfigRepository,
    private readonly alertService: AlertService,
    private readonly webSocketService: IWebSocketService
  ) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.metricsClient = kc.makeApiClient(k8s.CustomObjectsApi);
  }

  async startMonitoring() {
    const config = await this.configRepo.getConfig();
    const intervalMs = config.monitoringInterval * 1000;

    console.log(`[K8s Monitor] Iniciado. Leyendo métricas cada ${config.monitoringInterval}s...`);

    setInterval(async () => {
      await this.evaluateRealMetrics();
    }, intervalMs);
  }

  private async evaluateRealMetrics() {
    try {
      const config = await this.configRepo.getConfig();

      const metricsRes: any = await (this.metricsClient as any).listClusterCustomObject({
        group: 'metrics.k8s.io',
        version: 'v1beta1',
        plural: 'nodes'
      });

      const items = metricsRes.body ? metricsRes.body.items : metricsRes.items;

      if (!items || !Array.isArray(items)) {
        console.log('[K8s Monitor] K8s respondió, pero aún no hay métricas disponibles (items vacío).');
        return;
      }

      for (const node of items) {
        const nodeName = node.metadata.name;
        
        const cpuRaw = parseInt(node.usage.cpu.replace(/[^\d]/g, ''));
        const ramRaw = parseInt(node.usage.memory.replace(/[^\d]/g, ''));

        const cpuPercent = Math.min(Math.round((cpuRaw / 1000000000) * 100), 100); 
        const ramPercent = Math.min(Math.round((ramRaw / 8000000) * 100), 100);

        (this.webSocketService as any).io?.emit('metrics_update', {
          nodo: nodeName,
          cpu: cpuPercent,
          ram: ramPercent,
          timestamp: new Date()
        });
        
        console.log(`[K8s] Nodo: ${nodeName} | CPU: ${cpuPercent}% | RAM: ${ramPercent}%`);

        if (cpuPercent >= config.cpuThreshold) {
          await this.triggerAlert(1, nodeName, 'CPU', cpuPercent, config.cpuThreshold);
        }
        if (ramPercent >= config.ramThreshold) {
          await this.triggerAlert(1, nodeName, 'RAM', ramPercent, config.ramThreshold);
        }
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.log('[K8s Monitor] Esperando a que el Metrics Server termine de encender...');
      } else {
        console.error('[K8s Monitor] Error inesperado:', error.message || error);
      }
    }
  }

  private async triggerAlert(serverId: number, serverName: string, recurso: 'CPU' | 'RAM', valor: number, umbral: number) {
    const alert = new AlertEntity({
      serverId,
      tipo: 'CRITICAL',
      recurso,
      mensaje: `[K8S] El recurso ${recurso} de ${serverName} está en ${valor}% (Límite: ${umbral}%)`,
      valor,
      umbral,
      resuelto: false,
    });

    const savedAlert = await this.alertService.createAlert(alert);
    this.webSocketService.emitAlert(savedAlert);
  }
}
// TODO ?? SLACK & Telegram notf
// TODO disk y red se pueden sacar por prometheus, investigando... , por K8S solo se expone cpu y ram. 
// TODO definir si el resto de metricas se van a hacer para no romper el front
