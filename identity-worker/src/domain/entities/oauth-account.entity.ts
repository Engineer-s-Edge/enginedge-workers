export interface OauthAccount {
  _id?: string;
  userId: string;
  provider: string;
  providerUserId: string;
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
  scope?: string;
  expiresAt?: Date;
}


