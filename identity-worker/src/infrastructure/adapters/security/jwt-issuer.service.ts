import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  jwtVerify,
  importJWK,
} from 'jose';
import { KeyRepository } from '../repositories/key.repository';

@Injectable()
export class JwtIssuerService implements OnModuleInit {
  private privateKey!: CryptoKey;
  private publicJwk!: any;
  private kid!: string;
  private readonly logger = new Logger(JwtIssuerService.name);

  constructor(private readonly keys: KeyRepository) {}

  async onModuleInit() {
    const existing = await this.keys.getActiveKey();
    if (existing) {
      this.kid = existing.kid;
      this.publicJwk = existing.publicJwk;
      // For demo, privateJwkEnc is stored as plain JSON of the JWK
      const privateJwk = JSON.parse(existing.privateJwkEnc);
      this.privateKey = await importJWK(privateJwk, 'RS256');
    } else {
      const { privateKey, publicKey } = await generateKeyPair('RS256');
      this.privateKey = privateKey;
      this.publicJwk = await exportJWK(publicKey);
      this.kid = Math.random().toString(36).slice(2);
      this.publicJwk.kid = this.kid;
      this.publicJwk.alg = 'RS256';
      const privJwk = await exportJWK(privateKey);
      await this.keys.saveKey({
        kid: this.kid,
        publicJwk: this.publicJwk,
        privateJwkEnc: JSON.stringify(privJwk),
        createdAt: new Date(),
      } as any);
    }
  }

  async issueJwt(
    subject: string,
    tenantId?: string,
    tenantSlug?: string,
    roles: string[] = [],
    expiresIn = '15m',
  ) {
    const now = Math.floor(Date.now() / 1000);
    const payload: any = {
      sub: subject,
      iat: now,
      tenantId,
      tenantSlug,
      roles,
    };
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.privateKey);
    return token;
  }

  getJwks() {
    return { keys: [this.publicJwk] };
  }

  async issueRefresh(subject: string, expiresIn = '30d') {
    const jti = Math.random().toString(36).slice(2);
    const token = await new SignJWT({ sub: subject, type: 'refresh', jti })
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.privateKey);
    return token;
  }
}
