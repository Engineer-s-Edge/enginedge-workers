import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthValidationService } from '../services/auth-validation.service';

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

  constructor(private readonly authValidation: AuthValidationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      await this.authValidation.authenticateRequest(request, {
        allowQueryUser: true,
      });
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Auth validation failed: ${message}`);
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
