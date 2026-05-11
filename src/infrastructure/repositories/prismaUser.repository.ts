import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '../../interfaces/repositories/iUserRepository.interface';
import { UserEntity } from '../../core/entities/user.entity';

export class PrismaUserRepository implements IUserRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      url: process.env.DATABASE_URL
    });
  }

  private mapToEntity(prismaUser: any): UserEntity {
    return new UserEntity({
      idUsuario: prismaUser.id_usuario,
      nombre: prismaUser.nombre,
      correo: prismaUser.correo,
      contrasena: prismaUser.contrasena,
      rol: prismaUser.rol,
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { correo: email },
    });
    return user ? this.mapToEntity(user) : null;
  }

  async create(user: UserEntity): Promise<UserEntity> {
    const newUser = await this.prisma.user.create({
      data: {
        nombre: user.nombre,
        correo: user.correo,
        contrasena: user.contrasena,
        rol: user.rol,
      },
    });
    return this.mapToEntity(newUser);
  }

  // TODO Implementar el resto para el CRUD de usuarios (findById, update, delete, findAll)
  async findById(id: number): Promise<UserEntity | null> { return null; }
  async update(id: number, user: Partial<UserEntity>): Promise<UserEntity> { return new UserEntity({}); }
  async delete(id: number): Promise<void> {}
  async findAll(): Promise<UserEntity[]> { return []; }
}
