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
import { UserController } from './infrastructure/controllers/user.controller';

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
const userController = new UserController(userService);


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
app.get('/api/auth/me', authController.me);
app.get('/api/users', userController.getAll);
app.get('/api/users/:id', userController.getById);


app.post('/api/test/trigger-alert', async (req, res) => {
  try {
    await monitoringService.sendSlackNotification('CPU', 'test-node', 85, 80);
    res.json({ success: true, message: 'Slack notification sent' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Backend de Observabilidad K8s corriendo en http://localhost:${PORT}`);
  console.log(`WebSockets habilitados y escuchando`);
});
