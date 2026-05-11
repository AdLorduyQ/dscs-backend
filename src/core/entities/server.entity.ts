export class ServerEntity {
  id?: number; 
  nombre!: string;
  ip!: string;
  estado!: string; // 'ONLINE''OFFLINE''WARNING'
  cpu!: number;
  ram!: number;
  disco!: number;
  red!: number;

  constructor(partial: Partial<ServerEntity>) {
    Object.assign(this, partial);
  }

}
