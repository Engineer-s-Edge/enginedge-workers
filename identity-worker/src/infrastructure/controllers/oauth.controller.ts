import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { OAuthService } from '../../application/services/oauth.service';

@Controller('internal/oauth')
export class OauthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get(':provider/auth')
  @HttpCode(HttpStatus.OK)
  async auth(
    @Param('provider') provider: string,
    @Query('userId') userId?: string,
  ) {
    return this.oauthService.generateAuthUrl(provider, userId);
  }

  @Get(':provider/callback')
  @HttpCode(HttpStatus.OK)
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state?: string,
    @Query('userId') userId?: string,
  ) {
    return this.oauthService.handleCallback(provider, code, state, userId);
  }

  @Delete(':provider/unlink')
  @HttpCode(HttpStatus.OK)
  async unlink(
    @Param('provider') provider: string,
    @Query('userId') userId: string,
  ) {
    await this.oauthService.unlinkAccount(provider, userId);
    return { success: true };
  }
}
