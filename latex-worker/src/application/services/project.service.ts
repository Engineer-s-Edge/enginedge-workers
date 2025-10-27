/**
 * Project Management Service
 * 
 * Application layer service for managing LaTeX projects
 */

import { Injectable } from '@nestjs/common';
import { LaTeXProject, ProjectFile, ProjectDependency } from '../../domain/entities';
import { IProjectRepository } from '../../domain/ports';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
  ) {}

  /**
   * Create a new single-file project
   */
  async createProject(
    id: string,
    name: string,
    mainFile: string,
    content: string,
    userId?: string,
  ): Promise<LaTeXProject> {
    const project = LaTeXProject.create(id, name, mainFile, content, userId);
    await this.projectRepository.save(project);
    return project;
  }

  /**
   * Create a new multi-file project
   */
  async createMultiFileProject(
    id: string,
    name: string,
    mainFile: string,
    files: ProjectFile[],
    userId?: string,
  ): Promise<LaTeXProject> {
    // Find main file content
    const mainFileContent = files.find(f => f.path === mainFile)?.content || '';
    
    let project = LaTeXProject.create(id, name, mainFile, mainFileContent, userId);
    
    // Add all other files
    for (const file of files) {
      if (file.path !== mainFile) {
        project = project.addFile(file);
      }
    }
    
    await this.projectRepository.save(project);
    return project;
  }

  /**
   * Get a project by ID
   */
  async getProject(id: string): Promise<LaTeXProject | null> {
    return await this.projectRepository.findById(id);
  }

  /**
   * List projects for a user
   */
  async listUserProjects(userId: string): Promise<LaTeXProject[]> {
    return await this.projectRepository.findByUser(userId);
  }

  /**
   * List all projects with pagination
   */
  async listProjects(skip = 0, limit = 50): Promise<LaTeXProject[]> {
    return await this.projectRepository.list(skip, limit);
  }

  /**
   * Add a file to a project
   */
  async addFile(
    projectId: string,
    file: ProjectFile,
  ): Promise<LaTeXProject> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject = project.addFile(file);
    await this.projectRepository.save(updatedProject);
    return updatedProject;
  }

  /**
   * Update a file in a project
   */
  async updateFile(
    projectId: string,
    filePath: string,
    content: string,
  ): Promise<LaTeXProject> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const file = project.files.find(f => f.path === filePath);
    if (!file) {
      throw new Error(`File ${filePath} not found in project`);
    }

    const updatedProject = project.addFile({
      ...file,
      content,
    });

    await this.projectRepository.save(updatedProject);
    return updatedProject;
  }

  /**
   * Remove a file from a project
   */
  async removeFile(
    projectId: string,
    filePath: string,
  ): Promise<LaTeXProject> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject = project.removeFile(filePath);
    await this.projectRepository.save(updatedProject);
    return updatedProject;
  }

  /**
   * Add a dependency to a project
   */
  async addDependency(
    projectId: string,
    dependency: ProjectDependency,
  ): Promise<LaTeXProject> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject = project.addDependency(dependency);
    await this.projectRepository.save(updatedProject);
    return updatedProject;
  }

  /**
   * Update project main file
   */
  async updateMainFile(
    projectId: string,
    mainFile: string,
  ): Promise<LaTeXProject> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Verify the file exists in the project
    const fileExists = project.files.some(f => f.path === mainFile);
    if (!fileExists) {
      throw new Error(`File ${mainFile} not found in project`);
    }

    const updatedProject = new LaTeXProject(
      project.id,
      project.name,
      mainFile,
      project.files,
      project.dependencies,
      project.userId,
      project.createdAt,
      new Date(),
    );

    await this.projectRepository.save(updatedProject);
    return updatedProject;
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.projectRepository.delete(projectId);
  }

  /**
   * Get project file count
   */
  async getFileCount(projectId: string): Promise<number> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return project.files.length;
  }

  /**
   * Get project dependencies
   */
  async getDependencies(projectId: string): Promise<ProjectDependency[]> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return project.dependencies;
  }

  /**
   * Check if project has file
   */
  async hasFile(projectId: string, filePath: string): Promise<boolean> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return false;
    }
    return project.files.some(f => f.path === filePath);
  }
}
