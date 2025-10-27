/**
 * MongoDB Template Repository Implementation
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITemplateRepository } from '../../../domain/ports';
import { LaTeXTemplate, TemplateCategory } from '../../../domain/entities';
import {
  LaTeXTemplateSchema,
  LaTeXTemplateDocument,
} from '../schemas/latex-template.schema';

@Injectable()
export class MongoDBTemplateRepository implements ITemplateRepository {
  constructor(
    @InjectModel(LaTeXTemplateSchema.name)
    private readonly templateModel: Model<LaTeXTemplateDocument>,
  ) {}

  async save(template: LaTeXTemplate): Promise<void> {
    const tmpl = {
      templateId: template.id,
      name: template.name,
      description: template.metadata.description || '',
      category: template.category,
      content: template.content,
      variables: template.variables,
      requiredPackages: [],
      isPublic: template.isPublic,
    };

    await this.templateModel.updateOne(
      { templateId: template.id },
      { $set: tmpl },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<LaTeXTemplate | null> {
    const tmpl = await this.templateModel.findOne({ templateId: id }).exec();
    
    if (!tmpl) {
      return null;
    }

    return LaTeXTemplate.create(
      tmpl.templateId,
      tmpl.name,
      tmpl.category as TemplateCategory,
      tmpl.content,
      tmpl.variables as any, // Schema and domain types differ slightly
      tmpl.isPublic,
    );
  }

  async findByCategory(category: TemplateCategory): Promise<LaTeXTemplate[]> {
    const templates = await this.templateModel
      .find({ category: category.toString(), isPublic: true })
      .sort({ usageCount: -1 })
      .exec();

    return templates.map(tmpl =>
      LaTeXTemplate.create(
        tmpl.templateId,
        tmpl.name,
        tmpl.category as TemplateCategory,
        tmpl.content,
        tmpl.variables as any,
        tmpl.isPublic,
      ),
    );
  }

  async findByUser(userId: string): Promise<LaTeXTemplate[]> {
    const templates = await this.templateModel
      .find({ authorId: userId })
      .sort({ updatedAt: -1 })
      .exec();

    return templates.map(tmpl =>
      LaTeXTemplate.create(
        tmpl.templateId,
        tmpl.name,
        tmpl.category as TemplateCategory,
        tmpl.content,
        tmpl.variables as any,
        tmpl.isPublic,
      ),
    );
  }

  async findPublic(): Promise<LaTeXTemplate[]> {
    const templates = await this.templateModel
      .find({ isPublic: true })
      .sort({ usageCount: -1 })
      .exec();

    return templates.map(tmpl =>
      LaTeXTemplate.create(
        tmpl.templateId,
        tmpl.name,
        tmpl.category as TemplateCategory,
        tmpl.content,
        tmpl.variables as any,
        tmpl.isPublic,
      ),
    );
  }

  async delete(id: string): Promise<void> {
    await this.templateModel.deleteOne({ templateId: id }).exec();
  }

  async search(query: string): Promise<LaTeXTemplate[]> {
    const templates = await this.templateModel
      .find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } },
        ],
        isPublic: true,
      })
      .sort({ usageCount: -1 })
      .exec();

    return templates.map(tmpl =>
      LaTeXTemplate.create(
        tmpl.templateId,
        tmpl.name,
        tmpl.category as TemplateCategory,
        tmpl.content,
        tmpl.variables as any,
        tmpl.isPublic,
      ),
    );
  }
}
