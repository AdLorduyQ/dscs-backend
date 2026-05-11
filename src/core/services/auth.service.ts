import { UserService } from './user.service';
import { JwtUtil } from '../../utils/jwt.util';

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id_usuario?: number;// front espera snake_case  
    nombre: string;
    correo: string;
    rol: number;
  };
}

export class AuthService {
  constructor(private readonly userService: UserService) {}

  async login(correo: string, contrasena: string): Promise<AuthResponse> {
    const user = await this.userService.validateCredentials(correo, contrasena);

    const jwtPayload = {
      idUsuario: user.idUsuario,
      correo: user.correo,
      rol: user.rol,
    };

    const token = JwtUtil.generateToken(jwtPayload);

    return {
      success: true,
      token,
      user: {
        id_usuario: user.idUsuario,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
      },
    };
  }
}
