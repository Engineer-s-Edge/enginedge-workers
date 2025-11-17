import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { importJWK, jwtVerify, JWTPayload } from 'jose';

interface AuthValidationOptions {
  allowQueryUser?: boolean;
}

interface AuthResult {
  userId: string;
  tenantId?: string;
  roles: string[];
}

@Injectable()
export class AuthValidationService {
  private readonly logger = new Logger(AuthValidationService.name);
  private cachedKey: CryptoKey | null = null;
  private cachedKeyExpiry = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000;

  async authenticateRequest(
    request: Request,
    options: AuthValidationOptions = { allowQueryUser: true },
  ): Promise<AuthResult> {
    if (options.allowQueryUser !== false) {
      const userIdFromQuery = this.extractFirst(
        (request.query?.userId as string | string[] | undefined) ??
          (request.body?.userId as string | undefined),
      );
      if (userIdFromQuery) {
        this.attachUser(request, userIdFromQuery);
        return { userId: userIdFromQuery, roles: [] };
      }
    }

    const authHeader = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const publicKey = await this.getPublicKey();

    try {
      const { payload } = await jwtVerify(token, publicKey);
      const userId = this.getUserIdFromPayload(payload);
      if (!userId) {
        throw new UnauthorizedException('Token missing subject claim');
      }

      this.attachUser(request, userId, payload);

      return {
        userId,
        tenantId: payload.tenantId as string | undefined,
        roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`JWT verification failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractFirst(value?: string | string[]): string | undefined {
    if (!value) {
      return undefined;
    }
    return Array.isArray(value) ? value[0] : value;
  }

  private getUserIdFromPayload(payload: JWTPayload): string | undefined {
    return (
      (payload.sub as string | undefined) ??
      (payload['user_id'] as string | undefined)
    );
  }

  private attachUser(
    request: Request,
    userId: string,
    payload?: JWTPayload,
  ): void {
    (request as Request & { userId?: string }).userId = userId;
    (request as Request & { user?: Record<string, unknown> }).user = {
      userId,
      tenantId: payload?.tenantId,
      roles: payload?.roles,
    };
  }

  private async getPublicKey(): Promise<CryptoKey> {
    if (this.cachedKey && Date.now() < this.cachedKeyExpiry) {
      return this.cachedKey;
    }

    const identityWorkerUrl =
      process.env.IDENTITY_WORKER_URL || 'http://localhost:3000';
    const jwksResponse = await fetch(`${identityWorkerUrl}/.well-known/jwks.json`, {
      cache: 'no-store',
    });

    if (!jwksResponse.ok) {
      throw new Error('Failed to fetch JWKS');
    }

    const jwks = await jwksResponse.json();
    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      throw new Error('No keys found in JWKS response');
    }

    const publicKey = await importJWK(jwks.keys[0], 'RS256');
    this.cachedKey = publicKey;
    this.cachedKeyExpiry = Date.now() + this.cacheTtlMs;
    return publicKey;
  }
}
