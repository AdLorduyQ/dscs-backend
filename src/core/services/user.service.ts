import { UserEntity } from '../entities/user.entity';
import { IUserRepository } from '../../interfaces/repositories/iUserRepository.interface';
import { CryptoUtil } from '../../utils/crypto.util';
import { JwtUtil } from '../../utils/jwt.util';
import { UserRole } from '../../enums/userRole.enum';
import { UserPublicEntity } from '../entities/userPublic.entity';

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
}
