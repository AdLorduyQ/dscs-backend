export class ConfigEntity {
  id?: number;
  cpuThreshold!: number;
  ramThreshold!: number;
  monitoringInterval!: number;

  constructor(partial: Partial<ConfigEntity>) {
    Object.assign(this, partial);
  }
}
