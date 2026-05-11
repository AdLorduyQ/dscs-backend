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

const app = express();
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

app.post('/api/auth/login', authController.login);
app.get('/api/servers', serverController.getAll);
app.post('/api/servers', serverController.create);
app.get('/api/servers/:id/usage', serverController.getUsage);


app.listen(PORT, () => {
  console.log(`Backend de Observabilidad K8s corriendo en http://localhost:${PORT}`);
});
