import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { IdentityService } from '../../application/services/identity.service';

@Controller('internal/auth')
export class AuthController {
  constructor(private readonly identity: IdentityService) {}
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    const { email, password } = body;
    return this.identity.login(email, password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: any) {
    const { email, password, name, tenantId } = body;
    return this.identity.register(email, password, name, tenantId);
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async profile(@Query('userId') userId?: string, @Headers('x-user-id') headerUserId?: string) {
    const id = userId || headerUserId;
    if (!id) {
      throw new UnauthorizedException('User ID required');
    }
    return this.identity.profile(id);
  }

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: any) {
    return this.identity.refresh(body.refreshToken);
  }

  @Post('token/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(@Body() body: any) {
    return this.identity.revoke(body.refreshToken);
  }
}
