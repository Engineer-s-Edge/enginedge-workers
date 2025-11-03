/**
 * Token Storage Port
 *
 * Abstract interface for storing and retrieving OAuth tokens
 * Allows for different storage implementations (MongoDB, Redis, etc.)
 */

import { GoogleOAuthTokens } from './google-calendar.port';

export interface ITokenStorage {
  /**
   * Store tokens for a user
   */
  storeTokens(userId: string, tokens: GoogleOAuthTokens): Promise<void>;

  /**
   * Retrieve tokens for a user
   */
  getTokens(userId: string): Promise<GoogleOAuthTokens | null>;

  /**
   * Delete tokens for a user
   */
  deleteTokens(userId: string): Promise<void>;

  /**
   * Check if tokens exist for a user
   */
  hasTokens(userId: string): Promise<boolean>;

  /**
   * Store tokens for a specific calendar account (for multiple account support)
   */
  storeAccountTokens(
    userId: string,
    accountId: string,
    tokens: GoogleOAuthTokens,
  ): Promise<void>;

  /**
   * Retrieve tokens for a specific calendar account
   */
  getAccountTokens(
    userId: string,
    accountId: string,
  ): Promise<GoogleOAuthTokens | null>;

  /**
   * List all calendar accounts for a user
   */
  listAccounts(userId: string): Promise<string[]>;

  /**
   * Delete a specific calendar account
   */
  deleteAccount(userId: string, accountId: string): Promise<void>;
}
