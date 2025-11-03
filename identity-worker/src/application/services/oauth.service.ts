import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { MongoService } from '../../infrastructure/adapters/database/mongo.service';
import { OauthAccount } from '../../domain/entities/oauth-account.entity';
import * as crypto from 'crypto';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private encryptionKey: string;

  constructor(
    private readonly mongo: MongoService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = process.env.OAUTH_ENCRYPTION_KEY || 'dev-key-change-in-prod';
  }

  /**
   * Generate OAuth authorization URL for a provider
   */
  async generateAuthUrl(provider: string, userId?: string): Promise<{ url: string; state?: string }> {
    if (provider === 'google') {
      return this.generateGoogleAuthUrl(userId);
    }
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(
    provider: string,
    code: string,
    state?: string,
    userId?: string,
  ): Promise<{ url?: string; tokens?: any; userId?: string }> {
    if (provider === 'google') {
      return this.handleGoogleCallback(code, state, userId);
    }
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  /**
   * Unlink OAuth account
   */
  async unlinkAccount(provider: string, userId: string): Promise<void> {
    await this.mongo
      .collection<OauthAccount>('oauth_accounts')
      .deleteOne({ provider, userId });
    this.logger.log(`Unlinked ${provider} account for user ${userId}`);
  }

  /**
   * Get OAuth account for user
   */
  async getAccount(provider: string, userId: string): Promise<OauthAccount | null> {
    const account = await this.mongo
      .collection<OauthAccount>('oauth_accounts')
      .findOne({ provider, userId });
    if (!account) return null;

    // Decrypt tokens
    if (account.accessTokenEnc) {
      (account as any).accessToken = this.decrypt(account.accessTokenEnc);
    }
    if (account.refreshTokenEnc) {
      (account as any).refreshToken = this.decrypt(account.refreshTokenEnc);
    }

    return account;
  }

  private async generateGoogleAuthUrl(userId?: string): Promise<{ url: string; state?: string }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      this.config.get<string>('GOOGLE_REDIRECT_URI') ||
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3000/api/oauth/google/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const state = userId ? Buffer.from(JSON.stringify({ userId })).toString('base64') : undefined;

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    });

    return { url, state };
  }

  private async handleGoogleCallback(
    code: string,
    state?: string,
    userId?: string,
  ): Promise<{ url?: string; tokens?: any; userId?: string }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      this.config.get<string>('GOOGLE_REDIRECT_URI') ||
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3000/api/oauth/google/callback';
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Parse state if provided
    let parsedUserId = userId;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        parsedUserId = decoded.userId || parsedUserId;
      } catch {
        // Ignore state parsing errors
      }
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    // Get user info from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const providerUserId = userInfo.data.id || '';

    // Store tokens encrypted
    const account: OauthAccount = {
      userId: parsedUserId || providerUserId, // Use provider userId as fallback
      provider: 'google',
      providerUserId,
      accessTokenEnc: tokens.access_token ? this.encrypt(tokens.access_token) : undefined,
      refreshTokenEnc: tokens.refresh_token ? this.encrypt(tokens.refresh_token) : undefined,
      scope: tokens.scope || '',
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    };

    await this.mongo.collection<OauthAccount>('oauth_accounts').updateOne(
      { provider: 'google', providerUserId },
      { $set: account },
      { upsert: true },
    );

    this.logger.log(`Linked Google account for user ${account.userId}`);

    // Return redirect URL with tokens in query params (for frontend compatibility)
    const params = new URLSearchParams();
    if (tokens.access_token) params.append('access_token', tokens.access_token);
    if (tokens.refresh_token) params.append('refresh_token', tokens.refresh_token);
    if (tokens.expiry_date) params.append('expiry_date', String(tokens.expiry_date));

    return {
      url: `${frontendUrl}/calendar?${params.toString()}`,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      },
      userId: account.userId,
    };
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
}
