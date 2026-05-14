import * as k8s from '@kubernetes/client-node';
import { IServerRepository } from '../../interfaces/repositories/iServerRepository.interface';
import { IConfigRepository } from '../../interfaces/repositories/iConfigRepository.interface';
import { AlertService } from './alert.service';
import { IWebSocketService } from '../../interfaces/services/iWebSocketService.interface';
import { AlertEntity } from '../entities/alert.entity';
import { SlackUtil } from '../../utils/slack.util';
import axios from 'axios';

interface NodeMetrics {
  cpu: number;
  ram: number;
  disco: number;
  red: number;
}

export class MonitoringService {
  private k8sApi: k8s.CoreV1Api;
  private metricsClient: k8s.CustomObjectsApi;
  private activeAlerts = new Set<string>();
  private metricsCache: Map<string, NodeMetrics> = new Map();

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

        const { discoPercent, redPercent } = await this.getDiskAndNetworkMetrics(nodeName);

        this.metricsCache.set(nodeName, {
          cpu: cpuPercent,
          ram: ramPercent,
          disco: discoPercent,
          red: redPercent
        });

        (this.webSocketService as any).io?.emit('metrics_update', {
          nodo: nodeName,
          cpu: cpuPercent,
          ram: ramPercent,
          disco: discoPercent,
          red: redPercent,
          timestamp: new Date()
        });
        
        console.log(`[K8s] Nodo: ${nodeName} | CPU: ${cpuPercent}% | RAM: ${ramPercent}% | Disco: ${discoPercent}% | Red: ${redPercent}%`);

        await this.updateServerMetricsInDatabase(nodeName, cpuPercent, ramPercent, discoPercent, redPercent);

        if (cpuPercent >= config.cpuThreshold) {
          const key = `${nodeName}-CPU`;
          if (!this.activeAlerts.has(key)) {
            this.activeAlerts.add(key);
            await this.triggerAlert(1, nodeName, 'CPU', cpuPercent, config.cpuThreshold);
          }
        } else {
          this.activeAlerts.delete(`${nodeName}-CPU`);
        }

        if (ramPercent >= config.ramThreshold) {
          const key = `${nodeName}-RAM`;
          if (!this.activeAlerts.has(key)) {
            this.activeAlerts.add(key);
            await this.triggerAlert(1, nodeName, 'RAM', ramPercent, config.ramThreshold);
          }
        } else {
          this.activeAlerts.delete(`${nodeName}-RAM`);
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

  private async getDiskAndNetworkMetrics(nodeName: string): Promise<{ discoPercent: number; redPercent: number }> {
    try {
      const nodeList = await this.k8sApi.listNode();
      const node = nodeList.items.find((n: any) => n.metadata.name === nodeName);
      
      if (!node || !node.status?.addresses) {
        console.warn(`[K8s Monitor] No se encontró información de dirección para el nodo ${nodeName}`);
        return { discoPercent: 0, redPercent: 0 };
      }

      const nodeIP = node.status.addresses.find((addr: any) => addr.type === 'InternalIP')?.address;
      
      if (!nodeIP) {
        console.warn(`[K8s Monitor] No se encontró IP interna para el nodo ${nodeName}`);
        return { discoPercent: 0, redPercent: 0 };
      }

      const kubeletPort = 10255;
      const metricsUrl = `http://${nodeIP}:${kubeletPort}/metrics`;
      
      try {
        const response = await axios.get(metricsUrl, { timeout: 5000 });
        const metricsText = response.data;
        
        const discoPercent = this.parseDiskMetrics(metricsText);
        const redPercent = this.parseNetworkMetrics(metricsText);
        
        return { discoPercent, redPercent };
      } catch (kubeletError) {
        console.warn(`[K8s Monitor] No se pudo acceder a kubelet en ${nodeIP}:${kubeletPort}. Usando valores estimados (desarrollo).`);
        return { discoPercent: 50, redPercent: 30 };
      }
    } catch (error) {
      console.error(`[K8s Monitor] Error obteniendo métricas de disco/red para ${nodeName}:`, error);
      return { discoPercent: 0, redPercent: 0 };
    }
  }

  private parseDiskMetrics(metricsText: string): number {
    const availMatch = metricsText.match(/node_filesystem_avail_bytes\{[^}]*mountpoint="\/"[^}]*\}\s+(\d+)/);
    const sizeMatch = metricsText.match(/node_filesystem_size_bytes\{[^}]*mountpoint="\/"[^}]*\}\s+(\d+)/);
    
    if (availMatch && sizeMatch) {
      const avail = parseFloat(availMatch[1]);
      const size = parseFloat(sizeMatch[1]);
      const usedPercent = ((size - avail) / size) * 100;
      return Math.min(Math.round(usedPercent), 100);
    }
    
    const lines = metricsText.split('\n');
    let totalAvail = 0;
    let totalSize = 0;
    
    for (const line of lines) {
      if (line.startsWith('node_filesystem_avail_bytes')) {
        const match = line.match(/node_filesystem_avail_bytes\{[^}]*\}\s+(\d+)/);
        if (match) totalAvail += parseFloat(match[1]);
      }
      if (line.startsWith('node_filesystem_size_bytes')) {
        const match = line.match(/node_filesystem_size_bytes\{[^}]*\}\s+(\d+)/);
        if (match) totalSize += parseFloat(match[1]);
      }
    }
    
    if (totalSize > 0) {
      const usedPercent = ((totalSize - totalAvail) / totalSize) * 100;
      return Math.min(Math.round(usedPercent), 100);
    }
    
    return 0;
  }

  private parseNetworkMetrics(metricsText: string): number {
    const lines = metricsText.split('\n');
    let totalBytes = 0;
    
    for (const line of lines) {
      if (line.startsWith('node_network_receive_bytes_total') || line.startsWith('node_network_transmit_bytes_total')) {
        const match = line.match(/\s+(\d+)$/);
        if (match) totalBytes += parseFloat(match[1]);
      }
    }
    
    const estimatedPercent = Math.min(Math.round((totalBytes / 10000000000) * 100), 100);
    
    return estimatedPercent;
  }

  private async updateServerMetricsInDatabase(nodeName: string, cpu: number, ram: number, disco: number, red: number) {
    try {
      const servers = await this.serverRepo.findAll();
      let server = servers.find(s => s.nombre === nodeName || s.nombre.includes(nodeName));
      
      if (server) {
        await this.serverRepo.update(server.id!, {
          cpu,
          ram,
          disco,
          red
        });
        console.log(`[K8s Monitor] Métricas actualizadas en DB para servidor ${server.id} (${nodeName})`);
      } else {
        const { ServerEntity } = await import('../entities/server.entity');
        const newServer = new ServerEntity({
          nombre: nodeName,
          ip: 'auto-discovered',
          estado: 'ONLINE',
          cpu,
          ram,
          disco,
          red
        });
        
        server = await this.serverRepo.create(newServer);
        console.log(`[K8s Monitor] Servidor creado en DB para nodo ${nodeName} (ID: ${server.id})`);
      }
    } catch (error) {
      console.error(`[K8s Monitor] Error actualizando métricas en DB para ${nodeName}:`, error);
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

    await this.sendSlackNotification(recurso, serverName, valor, umbral);
  }

  async sendSlackNotification(recurso: 'CPU' | 'RAM', serverName: string, valor: number, umbral: number) {
    console.log(`[Slack] Notificación enviada: ${recurso} en ${serverName}`);
    await SlackUtil.send(`⚠️ ALERTA CRÍTICA: ${recurso} en ${valor}% (Límite: ${umbral}%) - Nodo: ${serverName}`);
  }

}
// TODO ?? SLACK & Telegram notf
// Métricas de disco y red usan valores estimados en Docker Desktop
// usar Prometheus para obtener métricas reales de disco y red
