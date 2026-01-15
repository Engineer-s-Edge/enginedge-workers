import { IdentityService } from '../../application/services/identity.service';
import { JwtIssuerService } from '../../infrastructure/adapters/security/jwt-issuer.service';

describe('Refresh/Revoke', () => {
  const mockUsers: any = { findById: jest.fn(), findByEmail: jest.fn() };
  const mockRoles: any = {
    listRolesForUser: jest.fn().mockResolvedValue(['user']),
  };
  const mockTenants: any = {
    findById: jest.fn().mockResolvedValue({ slug: 'tenant-a' }),
  };
  const mockRefresh: any = {
    isRevoked: jest.fn().mockResolvedValue(false),
    revoke: jest.fn(),
    record: jest.fn(),
  };
  const mockKeys: any = {
    getActiveKey: jest.fn().mockResolvedValue(null),
    saveKey: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = new JwtIssuerService(mockKeys);
  let service: IdentityService;

  beforeAll(async () => {
    await jwt.onModuleInit();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    service = new IdentityService(
      mockUsers,
      jwt,
      mockRoles,
      mockTenants,
      mockRefresh,
    );
  });

  it('rotates refresh tokens and issues new access', async () => {
    mockUsers.findById = jest
      .fn()
      .mockResolvedValue({ _id: 'u1', tenantId: 't1' });
    const refresh = await jwt.issueRefresh('u1', '1h');
    const res = await service.refresh(refresh);
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(mockRefresh.revoke).toHaveBeenCalled();
  });
});
