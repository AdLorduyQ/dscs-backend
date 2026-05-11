import { UserRole } from '../../enums/userRole.enum';

export class UserEntity {
  idUsuario?: number;
  nombre!: string;
  correo!: string;
  contrasena!: string;
  rol!: UserRole;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
