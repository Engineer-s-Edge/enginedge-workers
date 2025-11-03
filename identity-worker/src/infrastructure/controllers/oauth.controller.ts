import { Controller, Delete, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';

@Controller('internal/oauth')
export class OauthController {
  @Get(':provider/auth')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  auth(@Param('provider') _provider: string) {
    return { message: 'Not implemented' };
  }

  @Get(':provider/callback')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  callback(@Param('provider') _provider: string) {
    return { message: 'Not implemented' };
  }

  @Delete(':provider/unlink')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  unlink(@Param('provider') _provider: string) {
    return { message: 'Not implemented' };
  }
}


