/**
 * MongoDB Project Repository Implementation
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProjectRepository } from '../../../domain/ports';
import { LaTeXProject, ProjectFile as DomainProjectFile, ProjectDependency as DomainProjectDependency } from '../../../domain/entities';
import {
  LaTeXProjectSchema,
  LaTeXProjectDocument,
  ProjectFile,
  ProjectDependency,
} from '../schemas/latex-project.schema';

@Injectable()
export class MongoDBProjectRepository implements IProjectRepository {
  constructor(
    @InjectModel(LaTeXProjectSchema.name)
    private readonly projectModel: Model<LaTeXProjectDocument>,
  ) {}

  // Map schema file type to domain file type
  private mapFileToDomain(file: ProjectFile): DomainProjectFile {
    let type: DomainProjectFile['type'] = 'other';
    if (file.type === 'tex') type = 'tex';
    else if (file.type === 'bib') type = 'bib';
    else if (file.type === 'image') type = 'image';
    else if (file.type === 'cls' || file.type === 'sty' || file.type === 'bst') type = 'style';
    
    return {
      path: file.path,
      content: file.content,
      type,
    };
  }

  // Map domain file type to schema file type
  private mapFileToSchema(file: DomainProjectFile): ProjectFile {
    let type: ProjectFile['type'] = 'other';
    if (file.type === 'tex') type = 'tex';
    else if (file.type === 'bib') type = 'bib';
    else if (file.type === 'image') type = 'image';
    else if (file.type === 'style') type = 'sty';
    
    return {
      path: file.path,
      content: file.content,
      type,
    };
  }

  // Map schema dependency to domain dependency
  private mapDependencyToDomain(dep: ProjectDependency): DomainProjectDependency {
    let type: DomainProjectDependency['type'] = 'package';
    if (dep.type === 'package') type = 'package';
    else if (dep.type === 'font') type = 'font';
    else if (dep.type === 'binary') type = 'style'; // Map binary to style
    
    return {
      type,
      name: dep.name,
      version: dep.version,
    };
  }

  // Map domain dependency to schema dependency
  private mapDependencyToSchema(dep: DomainProjectDependency): ProjectDependency {
    let type: ProjectDependency['type'] = 'package';
    if (dep.type === 'package') type = 'package';
    else if (dep.type === 'font') type = 'font';
    else if (dep.type === 'style') type = 'package'; // Map style to package
    
    return {
      type,
      name: dep.name,
      version: dep.version,
    };
  }

  async save(project: LaTeXProject): Promise<void> {
    const proj = {
      projectId: project.id,
      userId: project.userId || 'system',
      name: project.name,
      mainFile: project.mainFile,
      files: project.files.map(f => this.mapFileToSchema(f)),
      dependencies: project.dependencies.map(d => this.mapDependencyToSchema(d)),
    };

    await this.projectModel.updateOne(
      { projectId: project.id },
      { $set: proj },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<LaTeXProject | null> {
    const proj = await this.projectModel.findOne({ projectId: id }).exec();
    
    if (!proj) {
      return null;
    }

    let project = LaTeXProject.create(
      proj.projectId,
      proj.name,
      proj.mainFile,
      proj.files[0]?.content || '',
      proj.userId,
    );

    // Add additional files
    proj.files.slice(1).forEach(file => {
      project = project.addFile(this.mapFileToDomain(file));
    });

    // Add dependencies
    proj.dependencies.forEach(dep => {
      project = project.addDependency(this.mapDependencyToDomain(dep));
    });

    return project;
  }

  async findByUser(userId: string): Promise<LaTeXProject[]> {
    const projects = await this.projectModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .exec();

    return projects.map(proj => {
      let project = LaTeXProject.create(
        proj.projectId,
        proj.name,
        proj.mainFile,
        proj.files[0]?.content || '',
        proj.userId,
      );

      proj.files.slice(1).forEach(file => {
        project = project.addFile(this.mapFileToDomain(file));
      });

      proj.dependencies.forEach(dep => {
        project = project.addDependency(this.mapDependencyToDomain(dep));
      });

      return project;
    });
  }

  async delete(id: string): Promise<void> {
    await this.projectModel.deleteOne({ projectId: id }).exec();
  }

  async list(skip: number, limit: number): Promise<LaTeXProject[]> {
    const projects = await this.projectModel
      .find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return projects.map(proj => {
      let project = LaTeXProject.create(
        proj.projectId,
        proj.name,
        proj.mainFile,
        proj.files[0]?.content || '',
        proj.userId,
      );

      proj.files.slice(1).forEach(file => {
        project = project.addFile(this.mapFileToDomain(file));
      });

      proj.dependencies.forEach(dep => {
        project = project.addDependency(this.mapDependencyToDomain(dep));
      });

      return project;
    });
  }
}
