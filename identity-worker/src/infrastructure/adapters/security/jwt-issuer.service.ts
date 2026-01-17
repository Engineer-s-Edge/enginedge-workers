import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  jwtVerify,
  importJWK,
  KeyLike,
} from 'jose';
import { KeyRepository } from '../repositories/key.repository';

@Injectable()
export class JwtIssuerService implements OnModuleInit {
  private privateKey!: KeyLike;
  private publicJwk!: any;
  private kid!: string;
  private readonly logger = new Logger(JwtIssuerService.name);

  constructor(private readonly keys: KeyRepository) {}

  async onModuleInit() {
    try {
      // Retry mechanism to wait for MongoDB to be ready
      let retries = 10;
      let existing = null;
      while (retries > 0) {
        try {
          existing = await this.keys.getActiveKey();
          break;
        } catch (error: any) {
          if (error?.message?.includes('not initialized')) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          }
          throw error;
        }
      }

      if (existing) {
        this.kid = existing.kid;
        this.publicJwk = existing.publicJwk;
        // For demo, privateJwkEnc is stored as plain JSON of the JWK
        const privateJwk = JSON.parse(existing.privateJwkEnc);
        const importedKey = await importJWK(privateJwk, 'RS256');
        this.privateKey = importedKey as KeyLike;
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
    } catch (error) {
      // If MongoDB is not available, generate a new key pair anyway
      // This allows the service to start even without MongoDB
      // Silently handle MongoDB unavailability (no logging to prevent spam)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isMongoNotInitialized =
        errorMessage.includes('not initialized') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('MongoService');

      if (!isMongoNotInitialized) {
        // Only log non-connection errors
        this.logger.warn(
          'Failed to load existing key from MongoDB, generating new key pair',
          { error: errorMessage },
        );
      }

      const { privateKey, publicKey } = await generateKeyPair('RS256');
      this.privateKey = privateKey;
      this.publicJwk = await exportJWK(publicKey);
      this.kid = Math.random().toString(36).slice(2);
      this.publicJwk.kid = this.kid;
      this.publicJwk.alg = 'RS256';
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
