export interface SigningKey {
  _id?: string;
  kid: string;
  publicJwk: any;
  privateJwkEnc: string;
  createdAt: Date;
  rotatedAt?: Date;
}


