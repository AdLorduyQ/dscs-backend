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
}