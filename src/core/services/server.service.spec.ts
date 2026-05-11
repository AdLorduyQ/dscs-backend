import { ServerService } from './server.service';
import { IServerRepository } from '../../interfaces/repositories/iServerRepository.interface';
import { ServerEntity } from '../entities/server.entity';

describe('ServerService', () => {
  let serverService: ServerService;
  let mockServerRepo: jest.Mocked<IServerRepository>;

  beforeEach(() => {
    mockServerRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    serverService = new ServerService(mockServerRepo);
  });

  describe('getAllServers', () => {
    it('debería devolver una lista de servidores', async () => {
      // Arrange
      const mockServers = [
        new ServerEntity({ id: 1, nombre: 'Nodo-1', ip: '10.0.0.1', estado: 'ONLINE', cpu: 10, ram: 20, disco: 30, red: 5 }),
      ];
      mockServerRepo.findAll.mockResolvedValue(mockServers);

      // Act
      const result = await serverService.getAllServers();

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].nombre).toBe('Nodo-1');
      expect(mockServerRepo.findAll).toHaveBeenCalled();
    });
  });

  describe('getServerById', () => {
    it('debería arrojar un error si el servidor no existe', async () => {
      // Arrange
      mockServerRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(serverService.getServerById(99)).rejects.toThrow('Servidor no encontrado');
    });
  });

  describe('createServer', () => {
    it('debería guardar y devolver el servidor creado', async () => {
      // Arrange
      const newServer = new ServerEntity({ 
        nombre: 'K8s-Worker-1', ip: '192.168.1.10', estado: 'ONLINE', cpu: 0, ram: 0, disco: 0, red: 0 
      });

      mockServerRepo.create.mockImplementation(async (server) => {
        return new ServerEntity({ ...server, id: 1 });
      });

      // Act
      const result = await serverService.createServer(newServer);
      
      // Assert
      expect(result.id).toBe(1);
      expect(mockServerRepo.create).toHaveBeenCalledWith(newServer);
    });
  });
});
