import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract userId from JWT token (via AuthGuard) or request
 *
 * The AuthGuard should be used to validate JWT tokens and attach userId to request.
 * This decorator extracts it from request.userId (set by guard) or falls back to query/body.
 *
 * Usage:
 * @UseGuards(AuthGuard) // Optional - validates JWT
 * @Get()
 * async getData(@UserId() userId: string) {
 *   // userId is automatically extracted from JWT (via guard) or query params
 * }
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();

    // First, try to get from request.userId (set by AuthGuard)
    if (request.userId) {
      return request.userId;
    }

    // Fallback: try query parameter (for backward compatibility)
    if (request.query?.userId) {
      return request.query.userId;
    }

    // Fallback: try body parameter
    if (request.body?.userId) {
      return request.body.userId;
    }

    // Return null if not found
    return null;
  },
);
