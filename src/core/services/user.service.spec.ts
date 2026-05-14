import { UserService } from './user.service';
import { IUserRepository } from '../../interfaces/repositories/iUserRepository.interface';
import { UserEntity } from '../entities/user.entity';
import { UserRole } from '../../enums/userRole.enum';
import { CryptoUtil } from '../../utils/crypto.util';
import { JwtUtil } from '../../utils/jwt.util';

jest.mock('../../utils/crypto.util');
jest.mock('../../utils/jwt.util');

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
    jest.mocked(CryptoUtil.hashPassword).mockClear();
    jest.mocked(CryptoUtil.comparePassword).mockClear();
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

  describe('validateCredentials', () => {
    it('debería arrojar un error si el correo no existe', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.validateCredentials('falso@test.com', '123'))
        .rejects.toThrow('Credenciales inválidas');
    });

    it('debería arrojar un error si la contraseña es incorrecta', async () => {
      // Arrange
      const existingUser = new UserEntity({
        idUsuario: 1,
        nombre: 'Admin',
        correo: 'admin@test.com',
        contrasena: 'hashed_password',
        rol: UserRole.Admin,
      });

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      (CryptoUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(userService.validateCredentials('admin@test.com', 'wrong_pass'))
        .rejects.toThrow('Credenciales inválidas');
    });

    it('debería devolver el usuario si las credenciales son correctas', async () => {
      // Arrange
      const existingUser = new UserEntity({
        idUsuario: 1,
        nombre: 'Admin',
        correo: 'admin@test.com',
        contrasena: 'hashed_password',
        rol: UserRole.Admin,
      });

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      (CryptoUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await userService.validateCredentials('admin@test.com', 'correct_pass');

      // Assert
      expect(result).toBeDefined();
      expect(result.idUsuario).toBe(1);
      expect(result.correo).toBe('admin@test.com');
    });
  });

  describe('updateUserForApi', () => {
    const adminClaims = { idUsuario: 1, correo: 'admin@test.com', rol: UserRole.Admin };
    const operatorClaims = { idUsuario: 2, correo: 'op@test.com', rol: UserRole.Operator };

    const existingUser = new UserEntity({
      idUsuario: 3,
      nombre: 'Target',
      correo: 'target@test.com',
      contrasena: 'hash',
      rol: UserRole.Operator,
    });

    beforeEach(() => {
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue(adminClaims);
    });

    it('debería rechazar si el correo ya pertenece a otro usuario', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.findByEmail.mockResolvedValue(
        new UserEntity({ idUsuario: 99, correo: 'otro@test.com', contrasena: 'x', nombre: 'X', rol: UserRole.Operator })
      );

      // Act & Assert
      await expect(
        userService.updateUserForApi('Bearer t', 3, { correo: 'otro@test.com' })
      ).rejects.toThrow('El correo ya está registrado');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('debería permitir al admin actualizar contraseña cuando se envía texto', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (CryptoUtil.hashPassword as jest.Mock).mockResolvedValue('new_hash');
      mockUserRepository.update.mockResolvedValue(
        new UserEntity({ ...existingUser, contrasena: 'new_hash', nombre: 'Target2' })
      );

      // Act
      const result = await userService.updateUserForApi('Bearer t', 3, {
        nombre: 'Target2',
        plainPassword: 'secret',
      });

      // Assert
      expect(CryptoUtil.hashPassword).toHaveBeenCalledWith('secret');
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ nombre: 'Target2', contrasena: 'new_hash' })
      );
      expect(result.correo).toBe('target@test.com');
    });

    it('no debería hashear ni enviar contraseña si el texto plano está vacío', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(existingUser);

      // Act
      await userService.updateUserForApi('Bearer t', 3, { nombre: 'SoloNombre', plainPassword: '   ' });

      // Assert
      expect(CryptoUtil.hashPassword).not.toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalledWith(3, { nombre: 'SoloNombre' });
    });

    it('debería rechazar a un operador que intente editar a otro usuario', async () => {
      // Arrange
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue(operatorClaims);
      mockUserRepository.findById.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(
        userService.updateUserForApi('Bearer t', 3, { nombre: 'Hack' })
      ).rejects.toThrow('No autorizado');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('debería permitir al operador editar su propio perfil sin cambiar el rol', async () => {
      // Arrange
      const self = new UserEntity({
        idUsuario: 2,
        nombre: 'Yo',
        correo: 'op@test.com',
        contrasena: 'hash',
        rol: UserRole.Operator,
      });
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue(operatorClaims);
      mockUserRepository.findById.mockResolvedValue(self);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(new UserEntity({ ...self, nombre: 'Yo2' }));

      // Act
      const result = await userService.updateUserForApi('Bearer t', 2, { nombre: 'Yo2' });

      // Assert
      expect(result.nombre).toBe('Yo2');
      expect(mockUserRepository.update).toHaveBeenCalledWith(2, { nombre: 'Yo2' });
    });

    it('debería rechazar al operador que intente cambiar su rol', async () => {
      // Arrange
      const self = new UserEntity({
        idUsuario: 2,
        nombre: 'Yo',
        correo: 'op@test.com',
        contrasena: 'hash',
        rol: UserRole.Operator,
      });
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue(operatorClaims);
      mockUserRepository.findById.mockResolvedValue(self);

      // Act & Assert
      await expect(
        userService.updateUserForApi('Bearer t', 2, { rol: UserRole.Admin })
      ).rejects.toThrow('No autorizado');
    });
  });

  describe('deleteUserForApi', () => {
    it('debería rechazar si no es administrador', async () => {
      // Arrange
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue({
        idUsuario: 2,
        correo: 'op@test.com',
        rol: UserRole.Operator,
      });
      mockUserRepository.findById.mockResolvedValue(
        new UserEntity({ idUsuario: 3, nombre: 'X', correo: 'x@test.com', contrasena: 'h', rol: UserRole.Operator })
      );

      // Act & Assert
      await expect(userService.deleteUserForApi('Bearer t', 3)).rejects.toThrow('No autorizado');
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it('debería rechazar que un administrador se elimine a sí mismo', async () => {
      // Arrange
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue({
        idUsuario: 1,
        correo: 'admin@test.com',
        rol: UserRole.Admin,
      });
      mockUserRepository.findById.mockResolvedValue(
        new UserEntity({ idUsuario: 1, nombre: 'Admin', correo: 'admin@test.com', contrasena: 'h', rol: UserRole.Admin })
      );

      // Act & Assert
      await expect(userService.deleteUserForApi('Bearer t', 1)).rejects.toThrow('No se puede eliminar el propio usuario');
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it('debería eliminar cuando es admin y el objetivo existe', async () => {
      // Arrange
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue({
        idUsuario: 1,
        correo: 'admin@test.com',
        rol: UserRole.Admin,
      });
      mockUserRepository.findById.mockResolvedValue(
        new UserEntity({ idUsuario: 5, nombre: 'B', correo: 'b@test.com', contrasena: 'h', rol: UserRole.Operator })
      );
      mockUserRepository.delete.mockResolvedValue(undefined);

      // Act
      await userService.deleteUserForApi('Bearer t', 5);

      // Assert
      expect(mockUserRepository.delete).toHaveBeenCalledWith(5);
    });

    it('debería envolver error de integridad referencial de Prisma', async () => {
      // Arrange
      (JwtUtil.verifyBearerAuthorization as jest.Mock).mockReturnValue({
        idUsuario: 1,
        correo: 'admin@test.com',
        rol: UserRole.Admin,
      });
      mockUserRepository.findById.mockResolvedValue(
        new UserEntity({ idUsuario: 5, nombre: 'B', correo: 'b@test.com', contrasena: 'h', rol: UserRole.Operator })
      );
      const fkError = new Error('FK');
      (fkError as any).code = 'P2003';
      mockUserRepository.delete.mockRejectedValue(fkError);

      // Act & Assert
      await expect(userService.deleteUserForApi('Bearer t', 5)).rejects.toThrow(
        'No se puede eliminar el usuario: existen registros asociados'
      );
    });
  });
});
