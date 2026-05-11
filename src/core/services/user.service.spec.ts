import { UserService } from './user.service';
import { IUserRepository } from '../../interfaces/repositories/iUserRepository.interface';
import { UserEntity } from '../entities/user.entity';
import { UserRole } from '../../enums/userRole.enum';
import { CryptoUtil } from '../../utils/crypto.util';

jest.mock('../../utils/crypto.util');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    userService = new UserService(mockUserRepository);
  });

  describe('createUser', () => {
    it('debería arrojar un error si el correo ya está registrado', async () => {
      // Arrange
      const newUser = new UserEntity({
        nombre: 'Andres',
        correo: 'admin@test.com',
        contrasena: '123',
        rol: UserRole.Admin,
      });

      mockUserRepository.findByEmail.mockResolvedValue(newUser);

      // Act & Assert
      await expect(userService.createUser(newUser)).rejects.toThrow('El correo ya está registrado');
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('debería crear el usuario con la contraseña encriptada', async () => {
      // Arrange
      const newUser = new UserEntity({
        nombre: 'Nuevo Operador',
        correo: 'operador@k8s.com',
        contrasena: 'plainText',
        rol: UserRole.Operator,
      });

      mockUserRepository.findByEmail.mockResolvedValue(null);
      (CryptoUtil.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      
      mockUserRepository.create.mockImplementation(async (user: UserEntity) => {
        return new UserEntity({ ...user, idUsuario: 1 });
      });

      // Act
      const result = await userService.createUser(newUser);

      // Assert
      expect(CryptoUtil.hashPassword).toHaveBeenCalledWith('plainText');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contrasena: 'hashed_password' })
      );
      expect(result.idUsuario).toBe(1);
    });
  });
});