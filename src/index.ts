import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaUserRepository } from './infrastructure/repositories/prismaUser.repository';
import { UserService } from './core/services/user.service';
import { AuthService } from './core/services/auth.service';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { PrismaServerRepository } from './infrastructure/repositories/prismaServer.repository';
import { ServerService } from './core/services/server.service';
import { ServerController } from './infrastructure/controllers/server.controller';
import { PrismaConfigRepository } from './infrastructure/repositories/prismaConfig.repository';
import { PrismaChangelogRepository } from './infrastructure/repositories/prismaChangelog.repository';
import { ConfigService } from './core/services/config.service';
import { ConfigController } from './infrastructure/controllers/config.controller';
import { PrismaAlertRepository } from './infrastructure/repositories/prismaAlert.repository';
import { AlertService } from './core/services/alert.service';
import { AlertController } from './infrastructure/controllers/alert.controller';
import { createServer } from 'http';
import { SocketIoService } from './infrastructure/websockets/socket.io.service';
import { MonitoringService } from './core/services/monitoring.service';

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());

const userRepository = new PrismaUserRepository();
const userService = new UserService(userRepository);
const authService = new AuthService(userService);
const authController = new AuthController(authService);
const serverRepository = new PrismaServerRepository();
const serverService = new ServerService(serverRepository);
const serverController = new ServerController(serverService);
const configRepo = new PrismaConfigRepository();
const changelogRepo = new PrismaChangelogRepository();
const configService = new ConfigService(configRepo, changelogRepo);
const configController = new ConfigController(configService);
const alertRepo = new PrismaAlertRepository();
const alertService = new AlertService(alertRepo);
const alertController = new AlertController(alertService);
const webSocketService = new SocketIoService(httpServer);
const monitoringService = new MonitoringService(
  serverRepository,
  configRepo,
  alertService,
  webSocketService
);

monitoringService.startMonitoring();


app.post('/api/auth/login', authController.login);
app.get('/api/servers', serverController.getAll);
app.post('/api/servers', serverController.create);
app.get('/api/servers/:id/usage', serverController.getUsage);
app.get('/api/config', configController.getConfig);
app.put('/api/config', configController.updateConfig);
app.get('/api/changelog', configController.getChangelogs);
app.get('/api/servers/:serverId/alerts', alertController.getAlerts);
app.get('/api/servers/:id/alerts/active', alertController.getActiveAlerts);
app.patch('/api/alerts/:id/resolve', alertController.resolveAlert);

httpServer.listen(PORT, () => {
  console.log(`Backend de Observabilidad K8s corriendo en http://localhost:${PORT}`);
  console.log(`WebSockets habilitados y escuchando`);
});
