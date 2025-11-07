import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { jwtVerify, importJWK } from 'jose';

/**
 * Auth Guard to validate JWT tokens
 *
 * Usage:
 * @UseGuards(AuthGuard)
 * @Get()
 * async getData(@UserId() userId: string) {
 *   // userId is guaranteed to be present
 * }
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Allow if userId is provided in query (for backward compatibility)
    if (request.query?.userId || request.body?.userId) {
      return true;
    }

    // Check for JWT token
    const authHeader = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('No authorization header found');
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    try {
      const token = authHeader.substring(7);

      // Get public key from identity-worker JWKS endpoint
      const identityWorkerUrl = process.env.IDENTITY_WORKER_URL || 'http://localhost:3000';
      const jwksResponse = await fetch(`${identityWorkerUrl}/.well-known/jwks.json`, {
        cache: 'no-store', // Don't cache for now - could be optimized
      });

      if (!jwksResponse.ok) {
        throw new Error('Failed to fetch JWKS');
      }

      const jwks = await jwksResponse.json();
      const publicKey = await importJWK(jwks.keys[0], 'RS256');

      const { payload } = await jwtVerify(token, publicKey);

      // Attach userId to request for decorator access
      request.userId = payload.sub;
      request.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        roles: payload.roles || [],
      };

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`JWT verification failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
