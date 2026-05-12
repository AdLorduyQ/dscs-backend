import { Request, Response } from 'express';
import { UserService } from '../../core/services/user.service';

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

  private isUnauthorizedError(message: string): boolean {
    return (
      message === 'Token requerido' ||
      message === 'Token inválido' ||
      message === 'Token inválido o expirado'
    );
  }
}
