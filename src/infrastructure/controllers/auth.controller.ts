import { Request, Response } from 'express';
import { AuthService } from '../../core/services/auth.service';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { correo, contraseña } = req.body;

      if (!correo || !contraseña) {
        res.status(400).json({ success: false, message: 'Correo y contraseña son requeridos' });
        return;
      }

      const result = await this.authService.login(correo, contraseña);
      
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ success: false, message: error.message });
    }
  };
}
