/**
 * MongoDB Token Storage Adapter
 * 
 * Stores OAuth tokens in MongoDB for persistence
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITokenStorage } from '../../../application/ports/token-storage.port';
import { GoogleOAuthTokens } from '../../../application/ports/google-calendar.port';

export interface GoogleTokenDocument {
  userId: string;
  accountId?: string;
  accessToken: string;
  refreshToken?: string;
  scope: string;
  tokenType: string;
  expiryDate?: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MongoTokenStorageAdapter implements ITokenStorage {
  private readonly logger = new Logger(MongoTokenStorageAdapter.name);

  constructor(
    @InjectModel('GoogleToken')
    private readonly tokenModel: Model<GoogleTokenDocument>,
  ) {}

  /**
   * Store tokens for a user (default account)
   */
  async storeTokens(userId: string, tokens: GoogleOAuthTokens): Promise<void> {
    this.logger.log(`Storing tokens for user: ${userId}`);

    await this.tokenModel.findOneAndUpdate(
      { userId, accountId: { $exists: false } },
      {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date,
        updatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    this.logger.log(`Tokens stored successfully for user: ${userId}`);
  }

  /**
   * Retrieve tokens for a user (default account)
   */
  async getTokens(userId: string): Promise<GoogleOAuthTokens | null> {
    this.logger.log(`Retrieving tokens for user: ${userId}`);

    const doc = await this.tokenModel.findOne({
      userId,
      accountId: { $exists: false },
    });

    if (!doc) {
      this.logger.debug(`No tokens found for user: ${userId}`);
      return null;
    }

    return {
      access_token: doc.accessToken,
      refresh_token: doc.refreshToken,
      scope: doc.scope,
      token_type: doc.tokenType,
      expiry_date: doc.expiryDate,
    };
  }

  /**
   * Delete tokens for a user (default account)
   */
  async deleteTokens(userId: string): Promise<void> {
    this.logger.log(`Deleting tokens for user: ${userId}`);

    await this.tokenModel.deleteOne({
      userId,
      accountId: { $exists: false },
    });

    this.logger.log(`Tokens deleted for user: ${userId}`);
  }

  /**
   * Check if tokens exist for a user (default account)
   */
  async hasTokens(userId: string): Promise<boolean> {
    const count = await this.tokenModel.countDocuments({
      userId,
      accountId: { $exists: false },
    });

    return count > 0;
  }

  /**
   * Store tokens for a specific calendar account
   */
  async storeAccountTokens(
    userId: string,
    accountId: string,
    tokens: GoogleOAuthTokens,
  ): Promise<void> {
    this.logger.log(`Storing tokens for user: ${userId}, account: ${accountId}`);

    await this.tokenModel.findOneAndUpdate(
      { userId, accountId },
      {
        userId,
        accountId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date,
        updatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    this.logger.log(`Tokens stored for user: ${userId}, account: ${accountId}`);
  }

  /**
   * Retrieve tokens for a specific calendar account
   */
  async getAccountTokens(
    userId: string,
    accountId: string,
  ): Promise<GoogleOAuthTokens | null> {
    this.logger.log(`Retrieving tokens for user: ${userId}, account: ${accountId}`);

    const doc = await this.tokenModel.findOne({ userId, accountId });

    if (!doc) {
      this.logger.debug(
        `No tokens found for user: ${userId}, account: ${accountId}`,
      );
      return null;
    }

    return {
      access_token: doc.accessToken,
      refresh_token: doc.refreshToken,
      scope: doc.scope,
      token_type: doc.tokenType,
      expiry_date: doc.expiryDate,
    };
  }

  /**
   * List all calendar accounts for a user
   */
  async listAccounts(userId: string): Promise<string[]> {
    this.logger.log(`Listing calendar accounts for user: ${userId}`);

    const docs = await this.tokenModel
      .find({ userId, accountId: { $exists: true } })
      .select('accountId')
      .exec();

    return docs.map((doc) => doc.accountId as string).filter(Boolean);
  }

  /**
   * Delete a specific calendar account
   */
  async deleteAccount(userId: string, accountId: string): Promise<void> {
    this.logger.log(`Deleting account: ${accountId} for user: ${userId}`);

    await this.tokenModel.deleteOne({ userId, accountId });

    this.logger.log(`Account deleted: ${accountId} for user: ${userId}`);
  }
}
