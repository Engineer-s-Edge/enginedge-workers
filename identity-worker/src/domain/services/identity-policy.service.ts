import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityPolicyService {
  canAssignRole(actorRoles: string[], targetRole: string): boolean {
    if (actorRoles.includes('admin')) return true;
    if (targetRole === 'admin') return false;
    return actorRoles.includes('manager');
  }
}
