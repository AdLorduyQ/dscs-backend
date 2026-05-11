import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaUserRepository } from './infrastructure/repositories/prismaUser.repository';
import { UserService } from './core/services/user.service';
import { AuthService } from './core/services/auth.service';
import { AuthController } from './infrastructure/controllers/auth.controller';

const app = express();
const PORT = 3000;

app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());

const userRepository = new PrismaUserRepository();
const userService = new UserService(userRepository);
const authService = new AuthService(userService);
const authController = new AuthController(authService);

app.post('/api/auth/login', authController.login);


app.listen(PORT, () => {
  console.log(`Backend de Observabilidad K8s corriendo en http://localhost:${PORT}`);
});
