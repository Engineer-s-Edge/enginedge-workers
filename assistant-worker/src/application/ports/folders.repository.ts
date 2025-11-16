export interface FolderRecord {
  id: string;
  userId: string;
  name: string;
  description?: string;
  conversationCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateFolderInput {
  userId: string;
  name: string;
  description?: string;
}

export interface IFoldersRepository {
  create(input: CreateFolderInput): Promise<FolderRecord>;
  findById(id: string): Promise<FolderRecord | null>;
  findByUser(userId: string): Promise<FolderRecord[]>;
  update(id: string, updates: { name?: string; description?: string }): Promise<void>;
  delete(id: string): Promise<void>;
  incrementConversationCount(id: string): Promise<void>;
  decrementConversationCount(id: string): Promise<void>;
}
