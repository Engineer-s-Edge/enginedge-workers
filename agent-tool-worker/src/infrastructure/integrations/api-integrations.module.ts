/**
 * API Integrations Module
 *
 * Provides comprehensive infrastructure for managing API integrations including:
 * - OAuth 2.0 token management and refresh
 * - API key and Bearer token authentication
 * - Rate limiting and quota management
 * - Request/response transformation
 * - Error handling and retries
 *
 * Supports integrations with:
 * - Google APIs (Calendar, Drive, Sheets, etc.)
 * - Notion API
 * - Todoist API
 * - Custom REST APIs
 */

import { Module, Injectable, Global } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshTokenUri: string;
  accessTokenUri: string;
}

export interface ApiCredentials {
  type: 'oauth' | 'api_key' | 'bearer_token' | 'basic';
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  expiresAt?: number;
}

export interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  burstLimit?: number;
}

export interface ApiIntegrationConfig {
  name: string;
  baseUrl: string;
  credentials: ApiCredentials;
  rateLimit?: RateLimitConfig;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
}

/**
 * OAuth Token Manager
 * Handles OAuth 2.0 token lifecycle including refresh and expiration
 */
@Injectable()
export class OAuthManager {
  private tokenCache: Map<string, { token: string; expiresAt: number }> =
    new Map();

  /**
   * Refresh OAuth token
   */
  async refreshAccessToken(
    refreshToken: string,
    config: OAuthConfig,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const response = await axios.post(config.refreshTokenUri, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in || 3600,
      };
    } catch (error) {
      throw new Error('Failed to refresh OAuth token');
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(
    currentToken: string,
    expiresAt: number,
    refreshToken: string,
    config: OAuthConfig,
  ): Promise<string> {
    // Check if token is still valid (with 5-minute buffer)
    const now = Date.now() / 1000;
    if (expiresAt - now > 300) {
      return currentToken;
    }

    // Token expired or expiring soon, refresh it
    const refreshed = await this.refreshAccessToken(refreshToken, config);
    return refreshed.accessToken;
  }

  /**
   * Cache token for given API
   */
  cacheToken(apiName: string, token: string, expiresAt: number): void {
    this.tokenCache.set(apiName, { token, expiresAt });
  }

  /**
   * Get cached token if still valid
   */
  getCachedToken(apiName: string): string | null {
    const cached = this.tokenCache.get(apiName);
    if (!cached) return null;

    const now = Date.now() / 1000;
    if (cached.expiresAt - now > 300) {
      return cached.token;
    }

    this.tokenCache.delete(apiName);
    return null;
  }
}

/**
 * Rate Limiter Service
 * Implements sliding window rate limiting and quota management
 */
@Injectable()
export class RateLimitService {
  private requestTimestamps: Map<string, number[]> = new Map();
  private quotaResets: Map<string, number> = new Map();

  /**
   * Check if request can be made within rate limits
   */
  canMakeRequest(apiName: string, config: RateLimitConfig): boolean {
    if (!config) return true;

    const now = Date.now() / 1000;
    const timestamps = this.requestTimestamps.get(apiName) || [];

    // Check requests per second
    if (config.requestsPerSecond) {
      const recentRequests = timestamps.filter((t) => now - t < 1);
      if (recentRequests.length >= config.requestsPerSecond) {
        return false;
      }
    }

    // Check requests per minute
    if (config.requestsPerMinute) {
      const recentRequests = timestamps.filter((t) => now - t < 60);
      if (recentRequests.length >= config.requestsPerMinute) {
        return false;
      }
    }

    // Check requests per hour
    if (config.requestsPerHour) {
      const recentRequests = timestamps.filter((t) => now - t < 3600);
      if (recentRequests.length >= config.requestsPerHour) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record request timestamp for tracking
   */
  recordRequest(apiName: string): void {
    const now = Date.now() / 1000;
    const timestamps = this.requestTimestamps.get(apiName) || [];
    timestamps.push(now);

    // Clean up old timestamps (older than 1 hour)
    const recentTimestamps = timestamps.filter((t) => now - t < 3600);
    this.requestTimestamps.set(apiName, recentTimestamps);
  }

  /**
   * Get current rate limit status
   */
  getStatus(
    apiName: string,
    config: RateLimitConfig,
  ): {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  } {
    const now = Date.now() / 1000;
    const timestamps = this.requestTimestamps.get(apiName) || [];

    return {
      requestsPerSecond: config.requestsPerSecond
        ? timestamps.filter((t) => now - t < 1).length
        : 0,
      requestsPerMinute: config.requestsPerMinute
        ? timestamps.filter((t) => now - t < 60).length
        : 0,
      requestsPerHour: config.requestsPerHour
        ? timestamps.filter((t) => now - t < 3600).length
        : 0,
    };
  }

  /**
   * Get time to next available request
   */
  getWaitTime(apiName: string, config: RateLimitConfig): number {
    if (!config) return 0;

    const now = Date.now() / 1000;
    const timestamps = this.requestTimestamps.get(apiName) || [];

    // Check each limit and return the longest wait time
    let maxWait = 0;

    if (config.requestsPerSecond) {
      const recentRequests = timestamps.filter((t) => now - t < 1);
      if (recentRequests.length >= config.requestsPerSecond) {
        const oldestRequest = Math.min(...recentRequests);
        const wait = oldestRequest + 1 - now;
        maxWait = Math.max(maxWait, wait);
      }
    }

    if (config.requestsPerMinute) {
      const recentRequests = timestamps.filter((t) => now - t < 60);
      if (recentRequests.length >= config.requestsPerMinute) {
        const oldestRequest = Math.min(...recentRequests);
        const wait = oldestRequest + 60 - now;
        maxWait = Math.max(maxWait, wait);
      }
    }

    return Math.max(0, maxWait);
  }
}

/**
 * API Client Factory
 * Creates configured axios instances for different APIs
 */
@Injectable()
export class ApiClientFactory {
  constructor(
    private oauthManager: OAuthManager,
    private rateLimitService: RateLimitService,
  ) {}

  /**
   * Create axios instance with configured authentication and rate limiting
   */
  createClient(config: ApiIntegrationConfig): AxiosInstance {
    const client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
    });

    // Apply authentication
    this.applyAuthentication(client, config.credentials);

    // Apply rate limiting interceptor
    client.interceptors.request.use((requestConfig) => {
      // Check rate limits
      if (
        config.rateLimit &&
        !this.rateLimitService.canMakeRequest(config.name, config.rateLimit)
      ) {
        const wait = this.rateLimitService.getWaitTime(
          config.name,
          config.rateLimit,
        );
        throw new Error(
          `Rate limit exceeded for ${config.name}. Wait ${wait.toFixed(2)}s before retrying.`,
        );
      }

      this.rateLimitService.recordRequest(config.name);
      return requestConfig;
    });

    // Apply retry logic
    if (config.retryPolicy) {
      this.applyRetryLogic(client, config.retryPolicy);
    }

    return client;
  }

  /**
   * Apply authentication headers based on credentials type
   */
  private applyAuthentication(
    client: AxiosInstance,
    credentials: ApiCredentials,
  ): void {
    switch (credentials.type) {
      case 'oauth':
        if (credentials.accessToken) {
          client.defaults.headers.common['Authorization'] =
            `Bearer ${credentials.accessToken}`;
        }
        break;

      case 'api_key':
        if (credentials.apiKey) {
          client.defaults.headers.common['X-API-Key'] = credentials.apiKey;
        }
        break;

      case 'bearer_token':
        if (credentials.accessToken) {
          client.defaults.headers.common['Authorization'] =
            `Bearer ${credentials.accessToken}`;
        }
        break;

      case 'basic':
        if (credentials.username && credentials.password) {
          const encoded = Buffer.from(
            `${credentials.username}:${credentials.password}`,
          ).toString('base64');
          client.defaults.headers.common['Authorization'] = `Basic ${encoded}`;
        }
        break;
    }
  }

  /**
   * Apply retry logic with exponential backoff
   */
  private applyRetryLogic(
    client: AxiosInstance,
    retryPolicy: {
      maxRetries: number;
      retryDelay: number;
      backoffMultiplier: number;
    },
  ): void {
    client.interceptors.response.use(undefined, async (error: AxiosError) => {
      const config = error.config;
      if (!config) throw error;

      const retryCount = (config as any).retryCount || 0;

      // Don't retry if max retries exceeded or not a retriable error
      if (
        retryCount >= retryPolicy.maxRetries ||
        !this.isRetriableError(error)
      ) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay =
        retryPolicy.retryDelay *
        Math.pow(retryPolicy.backoffMultiplier, retryCount);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Update retry count and retry
      (config as any).retryCount = retryCount + 1;
      return client(config);
    });
  }

  /**
   * Determine if error is retriable
   */
  private isRetriableError(error: AxiosError): boolean {
    if (!error.response) return true; // Network error, retriable

    const status = error.response.status;
    // Retry on 429 (rate limit), 503 (service unavailable), 504 (gateway timeout)
    return status === 429 || status === 503 || status === 504;
  }
}

/**
 * API Integrations Module
 */
@Module({
  providers: [OAuthManager, RateLimitService, ApiClientFactory],
  exports: [OAuthManager, RateLimitService, ApiClientFactory],
})
@Global()
export class ApiIntegrationsModule {}
