import { UserService } from './user.service';
import { JwtUtil } from '../../utils/jwt.util';
import { UserPublicEntity } from '../entities/userPublic.entity';

export interface AuthResponse {
  success: boolean;
  token: string;
  user: UserPublicEntity;
}

export type AuthMeResponse = AuthResponse;

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
      user: this.userService.toPublicEntity(user),
    };
  }

  async me(authorization: string | undefined): Promise<AuthMeResponse> {
    const claims = JwtUtil.verifyBearerAuthorization(authorization);
    const user = await this.userService.getByIdOrThrow(claims.idUsuario);

    const token = JwtUtil.generateToken({
      idUsuario: user.idUsuario,
      correo: user.correo,
      rol: user.rol,
    });

    return {
      success: true,
      token,
      user: this.userService.toPublicEntity(user),
    };
  }
}
