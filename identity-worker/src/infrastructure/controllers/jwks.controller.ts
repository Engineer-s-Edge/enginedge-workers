import { Controller, Get } from '@nestjs/common';
import { JwtIssuerService } from '../adapters/security/jwt-issuer.service';

@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwt: JwtIssuerService) {}
  @Get('jwks.json')
  getJwks() {
    return this.jwt.getJwks();
  }
}


