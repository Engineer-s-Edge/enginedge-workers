export interface Role {
  _id?: string;
  name: string;
}

export interface UserRole {
  _id?: string;
  userId: string;
  roleId: string;
}


