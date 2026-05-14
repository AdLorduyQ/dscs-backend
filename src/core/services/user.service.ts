import { UserEntity } from '../entities/user.entity';
import { IUserRepository } from '../../interfaces/repositories/iUserRepository.interface';
import { CryptoUtil } from '../../utils/crypto.util';
import { JwtUtil } from '../../utils/jwt.util';
import { UserRole } from '../../enums/userRole.enum';
import { UserPublicEntity } from '../entities/userPublic.entity';

export type UpdateUserForApiInput = {
  nombre?: string;
  correo?: string;
  rol?: UserRole;
  plainPassword?: string;
};

export class UserService {
  constructor(private readonly userRepository: IUserRepository) {}

  toPublicEntity(user: UserEntity): UserPublicEntity {
    if (user.idUsuario === undefined) {
      throw new Error('Usuario sin identificador');
    }
    return new UserPublicEntity({
      id_usuario: user.idUsuario,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
    });
  }

  async getByIdOrThrow(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  }

  async getAll(): Promise<UserEntity[]> {
    return this.userRepository.findAll();
  }

  async listUsersForApi(authorization: string | undefined): Promise<UserPublicEntity[]> {
    JwtUtil.verifyBearerAuthorization(authorization);
    const users = await this.userRepository.findAll();
    return users.map((u) => this.toPublicEntity(u));
  }

  async getUserForApiById(authorization: string | undefined, id: number): Promise<UserPublicEntity> {
    const claims = JwtUtil.verifyBearerAuthorization(authorization);
    const isOwner = claims.idUsuario === id;
    const isAdmin = claims.rol === UserRole.Admin;
    if (!isOwner && !isAdmin) {
      throw new Error('No autorizado');
    }
    const user = await this.getByIdOrThrow(id);
    return this.toPublicEntity(user);
  }

  async createUser(user: UserEntity): Promise<UserEntity> {
    const existingUser = await this.userRepository.findByEmail(user.correo);
    if (existingUser) {
      throw new Error('El correo ya está registrado');
    }

    const hashedPassword = await CryptoUtil.hashPassword(user.contrasena);

    const userToSave = new UserEntity({
      ...user,
      contrasena: hashedPassword,
    });

    return await this.userRepository.create(userToSave);
  }

  async validateCredentials(correo: string, contrasenaPlana: string): Promise<UserEntity> {
    const user = await this.userRepository.findByEmail(correo);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    const isPasswordValid = await CryptoUtil.comparePassword(contrasenaPlana, user.contrasena);
    
    if (!isPasswordValid) {
      throw new Error('Credenciales inválidas');
    }

    return user;
  }

  async updateUserForApi(
    authorization: string | undefined,
    id: number,
    input: UpdateUserForApiInput
  ): Promise<UserPublicEntity> {
    const claims = JwtUtil.verifyBearerAuthorization(authorization);
    const existing = await this.getByIdOrThrow(id);
    const isAdmin = claims.rol === UserRole.Admin;
    const isOwner = claims.idUsuario === id;

    if (!isAdmin && !isOwner) {
      throw new Error('No autorizado');
    }

    if (!isAdmin && input.rol !== undefined && input.rol !== existing.rol) {
      throw new Error('No autorizado');
    }

    if (input.correo !== undefined && input.correo !== existing.correo) {
      const withEmail = await this.userRepository.findByEmail(input.correo);
      if (withEmail !== null && withEmail.idUsuario !== id) {
        throw new Error('El correo ya está registrado');
      }
    }

    const partial: Partial<UserEntity> = {};
    if (input.nombre !== undefined) {
      partial.nombre = input.nombre;
    }
    if (input.correo !== undefined) {
      partial.correo = input.correo;
    }
    if (isAdmin && input.rol !== undefined) {
      partial.rol = input.rol;
    }

    if (input.plainPassword !== undefined) {
      const trimmed = input.plainPassword.trim();
      if (trimmed.length > 0) {
        partial.contrasena = await CryptoUtil.hashPassword(trimmed);
      }
    }

    if (Object.keys(partial).length === 0) {
      return this.toPublicEntity(existing);
    }

    const updated = await this.userRepository.update(id, partial);
    return this.toPublicEntity(updated);
  }

  async deleteUserForApi(authorization: string | undefined, id: number): Promise<void> {
    const claims = JwtUtil.verifyBearerAuthorization(authorization);
    if (claims.rol !== UserRole.Admin) {
      throw new Error('No autorizado');
    }
    if (claims.idUsuario === id) {
      throw new Error('No se puede eliminar el propio usuario');
    }
    await this.getByIdOrThrow(id);
    try {
      await this.userRepository.delete(id);
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
      if (code === 'P2003') {
        throw new Error('No se puede eliminar el usuario: existen registros asociados');
      }
      throw error;
    }
  }
}
