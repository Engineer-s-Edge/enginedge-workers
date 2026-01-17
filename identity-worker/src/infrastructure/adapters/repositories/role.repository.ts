import { Injectable } from '@nestjs/common';
import { MongoService } from '../database/mongo.service';
import { Role, UserRole } from '../../../domain/entities/role.entity';

@Injectable()
export class RoleRepository {
  constructor(private readonly mongo: MongoService) {}

  async listRolesForUser(userId: string): Promise<string[]> {
    const userRoles = await this.mongo
      .collection<UserRole>('user_roles')
      .find({ userId })
      .toArray();
    const roleIds = userRoles.map((ur) => ur.roleId);
    if (roleIds.length === 0) return [];
    const roles = await this.mongo
      .collection<Role>('roles')
      .find({ _id: { $in: roleIds } } as any)
      .toArray();
    return roles.map((r) => r.name);
  }
}
