import { Request, Response } from 'express';
import { UserService } from '../../core/services/user.service';
import { UserRole } from '../../enums/userRole.enum';

export class UserController {
  constructor(private readonly userService: UserService) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userService.listUsersForApi(req.headers.authorization);
      res.status(200).json(users);
    } catch (error: any) {
      if (this.isUnauthorizedError(error.message)) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      const user = await this.userService.getUserForApiById(req.headers.authorization, id);
      res.status(200).json(user);
    } catch (error: any) {
      if (this.isUnauthorizedError(error.message)) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'No autorizado') {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'Usuario no encontrado') {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const user = await this.userService.updateUserForApi(req.headers.authorization, id, {
        nombre: typeof body?.nombre === 'string' ? body.nombre : undefined,
        correo: typeof body?.correo === 'string' ? body.correo : undefined,
        rol: this.parseRolFromBody(body),
        plainPassword: this.readPlainPasswordFromBody(body),
      });
      res.status(200).json(user);
    } catch (error: any) {
      if (this.isUnauthorizedError(error.message)) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'No autorizado') {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'Usuario no encontrado') {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'El correo ya está registrado') {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID inválido' });
        return;
      }

      await this.userService.deleteUserForApi(req.headers.authorization, id);
      res.status(204).send();
    } catch (error: any) {
      if (this.isUnauthorizedError(error.message)) {
        res.status(401).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'No autorizado') {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'Usuario no encontrado') {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'No se puede eliminar el propio usuario') {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error.message === 'No se puede eliminar el usuario: existen registros asociados') {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  };

  private readPlainPasswordFromBody(body: Record<string, unknown>): string | undefined {
    const ascii = body?.contrasena;
    const spanish = body?.['contraseña'];
    if (typeof ascii === 'string') {
      return ascii;
    }
    if (typeof spanish === 'string') {
      return spanish;
    }
    return undefined;
  }

  private parseRolFromBody(body: Record<string, unknown>): UserRole | undefined {
    const raw = body?.rol;
    if (raw === undefined || raw === null) {
      return undefined;
    }
    const n = Number(raw);
    if (n === UserRole.Admin || n === UserRole.Operator) {
      return n;
    }
    return undefined;
  }

  private isUnauthorizedError(message: string): boolean {
    return (
      message === 'Token requerido' ||
      message === 'Token inválido' ||
      message === 'Token inválido o expirado'
    );
  }
}
