import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { UserEntity } from '../entities/user.entity';
import { UserRole } from '../../enums/userRole.enum';
import { JwtUtil } from '../../utils/jwt.util';

jest.mock('../../utils/jwt.util');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserService: jest.Mocked<Partial<UserService>>;

  beforeEach(() => {
    mockUserService = {
      validateCredentials: jest.fn(),
    };

    authService = new AuthService(mockUserService as UserService);
  });

  describe('login', () => {
    it('debería arrojar un error si las credenciales son inválidas', async () => {
      // Arrange
      (mockUserService.validateCredentials as jest.Mock).mockRejectedValue(new Error('Credenciales inválidas'));

      // Act & Assert
      await expect(authService.login('falso@test.com', '123'))
        .rejects.toThrow('Credenciales inválidas');
    });

    it('debería devolver el token y el usuario (sin contraseña) si es exitoso', async () => {
      // Arrange
      const validUser = new UserEntity({
        idUsuario: 1,
        nombre: 'Admin',
        correo: 'admin@test.com',
        contrasena: 'hashed_password',
        rol: UserRole.Admin,
      });

      (mockUserService.validateCredentials as jest.Mock).mockResolvedValue(validUser);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('fake_jwt_token');

      // Act
      const result = await authService.login('admin@test.com', 'password_correcta');

      // Assert
      expect(mockUserService.validateCredentials).toHaveBeenCalledWith('admin@test.com', 'password_correcta');
      expect(JwtUtil.generateToken).toHaveBeenCalledWith({ idUsuario: 1, rol: 1, correo: 'admin@test.com' });
      
      expect(result.token).toBe('fake_jwt_token');
      expect(result.user.correo).toBe('admin@test.com');
      expect(result.user).not.toHaveProperty('contrasena'); 
    });
  });
});
