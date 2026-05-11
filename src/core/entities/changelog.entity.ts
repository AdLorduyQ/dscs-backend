import { ChangelogType } from '../../enums/changelogType.enum';

export class ChangelogEntity {
  id?: number;
  descripcion!: string;
  tipo!: ChangelogType;
  old?: any;
  new?: any;
  fecha?: Date;
  id_usuario!: number;

  constructor(partial: Partial<ChangelogEntity>) {
    Object.assign(this, partial);
  }
}
