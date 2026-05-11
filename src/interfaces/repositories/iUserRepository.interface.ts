import { UserEntity } from '../../core/entities/user.entity';

export interface IUserRepository {
  findById(id: number): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  create(user: UserEntity): Promise<UserEntity>;
  update(id: number, user: Partial<UserEntity>): Promise<UserEntity>;
  delete(id: number): Promise<void>;
  findAll(): Promise<UserEntity[]>;
}
