import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '../../interfaces/repositories/iUserRepository.interface';
import { UserEntity } from '../../core/entities/user.entity';

export class PrismaUserRepository implements IUserRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient()
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

  async findById(id: number): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id_usuario: id },
    });
    return user ? this.mapToEntity(user) : null;
  }
  async update(id: number, user: Partial<UserEntity>): Promise<UserEntity> {
    const updated = await this.prisma.user.update({
      where: { id_usuario: id },
      data: {
        ...(user.nombre !== undefined && { nombre: user.nombre }),
        ...(user.correo !== undefined && { correo: user.correo }),
        ...(user.contrasena !== undefined && { contrasena: user.contrasena }),
        ...(user.rol !== undefined && { rol: user.rol }),
      },
    });
    return this.mapToEntity(updated);
  }
  async delete(id: number): Promise<void> {
    await this.prisma.user.delete({ where: { id_usuario: id } });
  }
  async findAll(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { id_usuario: 'asc' },
    });
    return users.map((u) => this.mapToEntity(u));
  }
}
