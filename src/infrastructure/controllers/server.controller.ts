import { Request, Response } from 'express';
import { ServerService } from '../../core/services/server.service';

export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const servers = await this.serverService.getAllServers();
      res.status(200).json(servers);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const newServer = await this.serverService.createServer(req.body);
      res.status(201).json(newServer);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  getUsage = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string);
      const server = await this.serverService.getServerById(id);
      
      res.status(200).json({
        cpu: server.cpu,
        ram: server.ram,
        disco: server.disco,
        red: server.red
      });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  };
}
