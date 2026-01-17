import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';
import {
  IGoogleAuthService,
  GoogleOAuthTokens,
} from '../../../application/ports/google-calendar.port';

/**
 * Google Auth Service - OAuth 2.0 Implementation
 *
 * Handles OAuth flow for Google Calendar API
 *
 * Infrastructure Adapter - Depends on googleapis library
 */
@Injectable()
export class GoogleAuthService implements IGoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauth2Client: Auth.OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.warn(
        'Google OAuth credentials not configured. Calendar sync will not work.',
      );
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    this.logger.log('GoogleAuthService initialized');
  }

  /**
   * Generate the OAuth authorization URL
   */
  generateAuthUrl(): string {
    this.logger.log('Generating Google Calendar auth URL');

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
    });

    this.logger.log('Google Calendar auth URL generated successfully');
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokenFromCode(code: string): Promise<GoogleOAuthTokens> {
    this.logger.log('Exchanging authorization code for tokens');

    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      this.logger.log('Successfully exchanged code for tokens');

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        scope: tokens.scope || '',
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to exchange code for tokens: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Set credentials for API calls
   */
  setCredentials(tokens: GoogleOAuthTokens): void {
    this.logger.log('Setting Google Calendar credentials');

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
    });

    this.logger.log('Google Calendar credentials set successfully');
  }

  /**
   * Get current credentials
   */
  getCredentials(): GoogleOAuthTokens | null {
    const credentials = this.oauth2Client.credentials;

    if (!credentials.access_token) {
      return null;
    }

    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || undefined,
      scope: credentials.scope || '',
      token_type: credentials.token_type || 'Bearer',
      expiry_date: credentials.expiry_date || undefined,
    };
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<GoogleOAuthTokens> {
    this.logger.log('Refreshing Google Calendar access token');

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('No access token received after refresh');
      }

      this.logger.log('Successfully refreshed access token');

      return {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || undefined,
        scope: credentials.scope || '',
        token_type: credentials.token_type || 'Bearer',
        expiry_date: credentials.expiry_date || undefined,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to refresh access token: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Revoke tokens
   */
  async revokeToken(token: string): Promise<void> {
    this.logger.log('Revoking Google Calendar token');

    try {
      await this.oauth2Client.revokeToken(token);
      this.logger.log('Successfully revoked token');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to revoke token: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get the OAuth2 client (for internal use by other services)
   */
  getOAuth2Client(): Auth.OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * Check if tokens are expired
   */
  areTokensExpired(): boolean {
    const credentials = this.oauth2Client.credentials;

    if (!credentials.expiry_date) {
      return false;
    }

    // Add 5-minute buffer
    const buffer = 5 * 60 * 1000;
    return Date.now() + buffer >= credentials.expiry_date;
  }

  /**
   * Auto-refresh tokens if needed
   */
  async ensureValidTokens(): Promise<void> {
    if (this.areTokensExpired()) {
      this.logger.log('Tokens expired, refreshing automatically');
      await this.refreshAccessToken();
    }
  }
}
