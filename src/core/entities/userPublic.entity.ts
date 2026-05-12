import { UserRole } from '../../enums/userRole.enum';

export class UserPublicEntity {
  id_usuario!: number;
  nombre!: string;
  correo!: string;
  rol!: UserRole;

  constructor(partial: Partial<UserPublicEntity>) {
    Object.assign(this, partial);
  }
}
