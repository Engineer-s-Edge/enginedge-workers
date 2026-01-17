import { Injectable, Inject } from '@nestjs/common';
import { IFoldersRepository } from '@application/ports/folders.repository';
import { IConversationsRepository } from '@application/ports/conversations.repository';

@Injectable()
export class FoldersService {
  constructor(
    @Inject('IFoldersRepository')
    private readonly foldersRepo: IFoldersRepository,
    @Inject('IConversationsRepository')
    private readonly conversationsRepo: IConversationsRepository,
  ) {}

  async createFolder(userId: string, name: string, description?: string) {
    return this.foldersRepo.create({ userId, name, description });
  }

  async listFolders(userId: string) {
    return this.foldersRepo.findByUser(userId);
  }

  async getFolder(folderId: string) {
    return this.foldersRepo.findById(folderId);
  }

  async updateFolder(
    folderId: string,
    updates: { name?: string; description?: string },
  ) {
    await this.foldersRepo.update(folderId, updates);
  }

  async deleteFolder(
    folderId: string,
    userId: string,
    options: {
      moveConversationsToFolderId?: string;
      deleteConversations?: boolean;
    } = {},
  ) {
    const folder = await this.foldersRepo.findById(folderId);
    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    if (folder.userId !== userId) {
      throw new Error('Unauthorized: folder belongs to different user');
    }

    // Get all conversations for user (we'll filter by folderId)
    // Note: This is a simplified approach - in production you'd want a direct query by folderId
    const allConversations = await this.conversationsRepo.listByUser(
      userId,
      10000,
    );
    const conversationsInFolder = allConversations.filter(
      (c) => c.folderId === folderId,
    );

    // Handle conversations based on options
    if (options.deleteConversations) {
      // Delete all conversations in folder
      for (const conv of conversationsInFolder) {
        await this.conversationsRepo.delete(conv.id);
      }
    } else if (options.moveConversationsToFolderId) {
      // Move conversations to another folder
      await this.bulkMoveToFolder(
        conversationsInFolder.map((c) => c.id),
        options.moveConversationsToFolderId,
      );
    } else {
      // Default: remove folderId from conversations (move to root)
      for (const conv of conversationsInFolder) {
        await this.conversationsRepo.updateFolder(conv.id, null);
      }
    }

    await this.foldersRepo.delete(folderId);
  }

  async moveConversationToFolder(
    conversationId: string,
    folderId: string | null,
  ) {
    const oldFolderId = (await this.conversationsRepo.findById(conversationId))
      ?.folderId;

    await this.conversationsRepo.updateFolder(conversationId, folderId);

    // Update folder conversation counts
    if (oldFolderId) {
      await this.foldersRepo.decrementConversationCount(oldFolderId);
    }
    if (folderId) {
      await this.foldersRepo.incrementConversationCount(folderId);
    }
  }

  async bulkMoveToFolder(conversationIds: string[], folderId: string | null) {
    for (const conversationId of conversationIds) {
      await this.moveConversationToFolder(conversationId, folderId);
    }
  }
}
