import * as jwt from 'jsonwebtoken';

export type JwtAccessClaims = {
  idUsuario: number;
  correo: string;
  rol: number;
};

export class JwtUtil {
    //TODO archivo .env
  private static readonly SECRET = 'k8s_observability_secret_key_123';

  static generateToken(payload: object, expiresIn: string = '24h'): string {
    const options: jwt.SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign(payload, this.SECRET, options);
  }

  static verifyToken(token: string): any {
    return jwt.verify(token, this.SECRET);
  }

  static verifyBearerAuthorization(authorization: string | undefined): JwtAccessClaims {
    if (!authorization?.startsWith('Bearer ')) {
      throw new Error('Token requerido');
    }
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new Error('Token requerido');
    }
    try {
      const payload = jwt.verify(token, this.SECRET) as Record<string, unknown>;
      const idUsuario = payload.idUsuario;
      if (typeof idUsuario !== 'number') {
        throw new Error('Token inválido');
      }
      return {
        idUsuario,
        correo: typeof payload.correo === 'string' ? payload.correo : '',
        rol: typeof payload.rol === 'number' ? payload.rol : 0,
      };
    } catch (err: unknown) {
      if (err instanceof Error && (err.message === 'Token requerido' || err.message === 'Token inválido')) {
        throw err;
      }
      throw new Error('Token inválido o expirado');
    }
  }
}
