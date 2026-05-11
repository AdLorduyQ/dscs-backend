import * as jwt from 'jsonwebtoken';

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
}
