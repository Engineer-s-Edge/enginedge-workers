export interface User {
  _id?: string;
  email: string;
  hashedPassword?: string;
  name?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}
