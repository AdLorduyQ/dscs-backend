import * as k8s from '@kubernetes/client-node';
import { IServerRepository } from '../../interfaces/repositories/iServerRepository.interface';
import { IConfigRepository } from '../../interfaces/repositories/iConfigRepository.interface';
import { AlertService } from './alert.service';
import { IWebSocketService } from '../../interfaces/services/iWebSocketService.interface';
import { AlertEntity } from '../entities/alert.entity';
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

  private async getDiskAndNetworkMetrics(nodeName: string): Promise<{ discoPercent: number; redPercent: number }> {
  try {
    const promUrl = 'http://localhost:9090/api/v1/query';
    const diskQuery = `max(100 - (node_filesystem_avail_bytes / node_filesystem_size_bytes * 100))`;
    const netQuery = `rate(node_network_receive_bytes_total[1m])`;

    const [diskRes, netRes] = await Promise.all([
      axios.get(promUrl, { params: { query: diskQuery } }),
      axios.get(promUrl, { params: { query: netQuery } })
    ]);

    const diskResultArray = diskRes.data?.data?.result;
    const netResultArray = netRes.data?.data?.result;

    let discoPercent = 0;
    if (diskResultArray && diskResultArray.length > 0) {
      discoPercent = parseFloat(diskResultArray[0].value[1]);
    }

    let redBytesPorSegundo = 0;
    if (netResultArray && netResultArray.length > 0) {
      redBytesPorSegundo = parseFloat(netResultArray[0].value[1]);
    }

    const maxNetworkBytes = 125000000; 
    const redPercent = (redBytesPorSegundo / maxNetworkBytes) * 100;
    console.log(`[Debug] Tráfico real network: ${redBytesPorSegundo} bytes/segundo`);
    return { 
      discoPercent: Math.min(Math.round(discoPercent), 100), 
      redPercent: Math.min(Math.round(redPercent), 100) 
    };

  } catch (error: any) {
    console.error(`[K8s Monitor] Error leyendo Prometheus para Disco/Red:`, error.message || error);
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
  }
}
// TODO ?? SLACK & Telegram notf
// Métricas de disco y red usan valores estimados en Docker Desktop
// usar Prometheus para obtener métricas reales de disco y red
