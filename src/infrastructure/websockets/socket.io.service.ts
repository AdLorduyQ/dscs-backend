import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { IWebSocketService } from '../../interfaces/services/iWebSocketService.interface';
import { AlertEntity } from '../../core/entities/alert.entity';

export class SocketIoService implements IWebSocketService {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: 'http://localhost:4200',
        credentials: true,
      },
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Frontend Angular conectado. ID: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`WebSocket] Cliente desconectado. ID: ${socket.id}`);
      });
    });
  }

  emitAlert(alert: AlertEntity): void {
    this.io.emit('alert', alert);
    console.log(`[WebSocket] Alerta emitida al Front: [${alert.tipo}] ${alert.mensaje}`);
  }
}
