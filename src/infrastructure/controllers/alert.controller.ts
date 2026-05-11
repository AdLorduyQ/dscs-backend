import { Request, Response } from 'express';
import { AlertService } from '../../core/services/alert.service';

export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  getAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const serverId = parseInt(req.params.serverId as string);
      const filters = req.query;
      
      const alerts = await this.alertService.getAlerts(serverId, filters);
      res.status(200).json(alerts);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  getActiveAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const serverId = parseInt(req.params.id as string);
      const alerts = await this.alertService.getActiveAlerts(serverId);
      res.status(200).json(alerts);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  resolveAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string; // UUID
      const resolved = await this.alertService.resolveAlert(id);
      res.status(200).json(resolved);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };
}
