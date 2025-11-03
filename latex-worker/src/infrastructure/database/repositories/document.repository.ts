/**
 * MongoDB Document Repository Implementation
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IDocumentRepository } from '../../../domain/ports';
import { LaTeXDocument } from '../../../domain/entities';
import {
  LaTeXDocumentSchema,
  LaTeXDocumentDocument,
} from '../schemas/latex-document.schema';

@Injectable()
export class MongoDBDocumentRepository implements IDocumentRepository {
  constructor(
    @InjectModel(LaTeXDocumentSchema.name)
    private readonly documentModel: Model<LaTeXDocumentDocument>,
  ) {}

  async save(document: LaTeXDocument): Promise<void> {
    const doc = {
      documentId: document.id,
      userId: 'system', // Will be added later when user auth is implemented
      content: document.content,
      metadata: {
        title: document.metadata.title,
        author: document.metadata.author,
        date: document.metadata.date,
        documentClass: document.metadata.documentClass,
      },
      packages: document.metadata.packages || [],
      requiresBibliography: false,
    };

    await this.documentModel.updateOne(
      { documentId: document.id },
      { $set: doc },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<LaTeXDocument | null> {
    const doc = await this.documentModel.findOne({ documentId: id }).exec();

    if (!doc) {
      return null;
    }

    return LaTeXDocument.create(doc.documentId, doc.content, {
      title: doc.metadata?.title,
      author: doc.metadata?.author,
      date: doc.metadata?.date,
      documentClass: doc.metadata?.documentClass,
      packages: doc.packages,
    });
  }

  async findByUser(userId: string): Promise<LaTeXDocument[]> {
    const docs = await this.documentModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .exec();

    return docs.map((doc) =>
      LaTeXDocument.create(doc.documentId, doc.content, {
        title: doc.metadata?.title,
        author: doc.metadata?.author,
        date: doc.metadata?.date,
        documentClass: doc.metadata?.documentClass,
        packages: doc.packages,
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.documentModel.deleteOne({ documentId: id }).exec();
  }
}
