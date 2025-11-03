import { Inject, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY } from '../ports/user-repository.port';
import { JwtIssuerService } from '../../infrastructure/adapters/security/jwt-issuer.service';
import { RoleRepository } from '../../infrastructure/adapters/repositories/role.repository';
import { TenantRepository } from '../../infrastructure/adapters/repositories/tenant.repository';
import { RefreshTokenRepository } from '../../infrastructure/adapters/repositories/refresh-token.repository';
import { jwtVerify } from 'jose';
import * as bcrypt from 'bcrypt';

@Injectable()
export class IdentityService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository, private readonly jwt: JwtIssuerService, private readonly roles: RoleRepository, private readonly tenants: TenantRepository, private readonly refreshRepo: RefreshTokenRepository) {}

  async register(email: string, password: string, name?: string, tenantId?: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.users.create({ email, hashedPassword, name, tenantId } as any);
    return { id: user._id, email: user.email };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !user.hashedPassword) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.hashedPassword);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const roles = await this.roles.listRolesForUser(user._id!);
    const tenant = user.tenantId ? await this.tenants.findById(user.tenantId) : null;
    const tenantSlug = tenant?.slug;
    const accessToken = await this.jwt.issueJwt(user._id!, user.tenantId, tenantSlug, roles, process.env.ACCESS_TOKEN_TTL || '15m');
    const refreshToken = await this.jwt.issueRefresh(user._id!, process.env.REFRESH_TOKEN_TTL || '30d');
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' };
  }

  async profile(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Not found');
    const roles = await this.roles.listRolesForUser(user._id!);
    const tenant = user.tenantId ? await this.tenants.findById(user.tenantId) : null;
    return { id: user._id, email: user.email, name: user.name, tenantId: user.tenantId, tenantSlug: tenant?.slug, roles };
  }

  async refresh(refreshToken: string) {
    const { payload } = await jwtVerify(refreshToken, (this.jwt as any)['privateKey']);
    if (payload.type !== 'refresh' || !payload.jti) throw new UnauthorizedException('Invalid refresh');
    if (await this.refreshRepo.isRevoked(String(payload.jti))) throw new UnauthorizedException('Revoked');
    const userId = String(payload.sub);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid user');
    const roles = await this.roles.listRolesForUser(userId);
    const tenant = user.tenantId ? await this.tenants.findById(user.tenantId) : null;
    const tenantSlug = tenant?.slug;
    const accessToken = await this.jwt.issueJwt(userId, user.tenantId, tenantSlug, roles, process.env.ACCESS_TOKEN_TTL || '15m');
    // rotate: revoke old and issue new refresh
    await this.refreshRepo.revoke(String(payload.jti));
    const newRefresh = await this.jwt.issueRefresh(userId, process.env.REFRESH_TOKEN_TTL || '30d');
    return { accessToken, refreshToken: newRefresh, tokenType: 'Bearer', expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' };
  }

  async revoke(refreshToken: string) {
    const { payload } = await jwtVerify(refreshToken, (this.jwt as any)['privateKey']);
    if (payload.type !== 'refresh' || !payload.jti) throw new UnauthorizedException('Invalid refresh');
    await this.refreshRepo.revoke(String(payload.jti));
    return { revoked: true };
  }
}


