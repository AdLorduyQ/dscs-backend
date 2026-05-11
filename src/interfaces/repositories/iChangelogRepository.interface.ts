import { ChangelogEntity } from '../../core/entities/changelog.entity';

export interface IChangelogRepository {
  create(changelog: ChangelogEntity): Promise<ChangelogEntity>;
  findAll(): Promise<ChangelogEntity[]>;
}
