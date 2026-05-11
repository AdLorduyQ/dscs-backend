import { UserEntity } from '../entities/user.entity';
import { IUserRepository } from '../../interfaces/repositories/iUserRepository.interface';
import { CryptoUtil } from '../../utils/crypto.util';

export class UserService {
  constructor(private readonly userRepository: IUserRepository) {}

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
