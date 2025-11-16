import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IFoldersRepository,
  CreateFolderInput,
  FolderRecord,
} from '@application/ports/folders.repository';
import { Folder, FolderDocument } from './conversations/folder.schema';

@Injectable()
export class MongoDBFoldersRepository implements IFoldersRepository {
  constructor(
    @InjectModel(Folder.name)
    private readonly folderModel: Model<FolderDocument>,
  ) {}

  private toRecord(doc: FolderDocument): FolderRecord {
    return {
      id: doc._id?.toString() || (doc as any).id,
      userId: doc.userId,
      name: doc.name,
      description: doc.description,
      conversationCount: doc.conversationCount || 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(input: CreateFolderInput): Promise<FolderRecord> {
    const created = await this.folderModel.create({
      userId: input.userId,
      name: input.name,
      description: input.description,
      conversationCount: 0,
    } as any);
    return this.toRecord(created);
  }

  async findById(id: string): Promise<FolderRecord | null> {
    const doc = await this.folderModel.findById(id).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async findByUser(userId: string): Promise<FolderRecord[]> {
    const docs = await this.folderModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => this.toRecord(d));
  }

  async update(
    id: string,
    updates: { name?: string; description?: string },
  ): Promise<void> {
    await this.folderModel.updateOne({ _id: id }, { $set: updates }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.folderModel.deleteOne({ _id: id }).exec();
  }

  async incrementConversationCount(id: string): Promise<void> {
    await this.folderModel
      .updateOne({ _id: id }, { $inc: { conversationCount: 1 } })
      .exec();
  }

  async decrementConversationCount(id: string): Promise<void> {
    await this.folderModel
      .updateOne({ _id: id }, { $inc: { conversationCount: -1 } })
      .exec();
  }
}
