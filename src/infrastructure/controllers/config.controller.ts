import { Request, Response } from 'express';
import { ConfigService } from '../../core/services/config.service';

export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = await this.configService.getConfig();
      res.status(200).json(config);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
    //TODO: Extraer id_usuario del token JWT
      const userId = 1; 
      
      const updated = await this.configService.updateConfig(req.body, userId);
      res.status(200).json(updated);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  getChangelogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const logs = await this.configService.getChangelogs();
      res.status(200).json(logs);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}
