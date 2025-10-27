import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CompileCommandUseCase, CompileCommand, CompileResult } from '../application/use-cases/compile-command.use-case';
import { ProjectService } from '../application/services/project.service';
import { TemplateService } from '../application/services/template.service';
import { MessageBrokerPort } from '../application/ports/message-broker.port';
import { LaTeXProject } from '../domain/entities/latex-project.entity';
import { LaTeXTemplate, TemplateCategory } from '../domain/entities/latex-template.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * LaTeX Worker Controller
 * 
 * REST API for LaTeX compilation, project management, and templates.
 */
@Controller('latex')
export class LaTeXController {
  private readonly logger = new Logger(LaTeXController.name);

  constructor(
    private readonly compileCommandUseCase: CompileCommandUseCase,
    private readonly projectService: ProjectService,
    private readonly templateService: TemplateService,
    @Inject('MessageBrokerPort') private readonly messageBroker: MessageBrokerPort,
  ) {}

  /**
   * POST /latex/compile - Synchronous compilation
   */
  @Post('compile')
  @HttpCode(HttpStatus.OK)
  async compile(
    @Body() body: {
      content: string;
      userId: string;
      settings?: {
        engine?: 'xelatex';
        shellEscape?: boolean;
        maxPasses?: number;
        timeout?: number;
      };
      metadata?: Record<string, unknown>;
    },
  ): Promise<CompileResult> {
    this.logger.log(`Received sync compilation request for user ${body.userId}`);

    const command: CompileCommand = {
      jobId: uuidv4(),
      userId: body.userId,
      content: body.content,
      settings: body.settings,
      metadata: body.metadata,
    };

    return await this.compileCommandUseCase.execute(command);
  }

  /**
   * POST /latex/compile-async - Asynchronous Kafka-based compilation
   */
  @Post('compile-async')
  @HttpCode(HttpStatus.ACCEPTED)
  async compileAsync(
    @Body() body: {
      content: string;
      userId: string;
      settings?: {
        engine?: 'xelatex';
        shellEscape?: boolean;
        maxPasses?: number;
        timeout?: number;
      };
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ jobId: string; message: string }> {
    const jobId = uuidv4();
    this.logger.log(`Received async compilation request for user ${body.userId} (job: ${jobId})`);

    // Publish compile request to Kafka
    await this.messageBroker.sendMessage('latex.compile.request', {
      jobId,
      userId: body.userId,
      content: body.content,
      settings: body.settings,
      metadata: body.metadata,
    });

    return {
      jobId,
      message: 'Compilation job queued successfully',
    };
  }

  /**
   * GET /latex/projects - List user projects
   */
  @Get('projects')
  async listProjects(
    @Query('userId') userId: string,
  ): Promise<{ projects: LaTeXProject[]; total: number }> {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    this.logger.log(`Listing projects for user ${userId}`);

    const projects = await this.projectService.listUserProjects(userId);
    const total = projects.length;

    return {
      projects,
      total,
    };
  }

  /**
   * POST /latex/projects - Create a new project
   */
  @Post('projects')
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @Body() body: {
      userId: string;
      name: string;
      content?: string;
      files?: Array<{ path: string; content: string; type: 'tex' | 'bib' | 'image' | 'style' | 'other' }>;
      mainFile?: string;
    },
  ): Promise<LaTeXProject> {
    this.logger.log(`Creating project "${body.name}" for user ${body.userId}`);

    const projectId = uuidv4();

    if (body.files && body.files.length > 0) {
      // Multi-file project
      const mainFile = body.mainFile || body.files[0].path;
      return await this.projectService.createMultiFileProject(
        projectId,
        body.name,
        mainFile,
        body.files,
        body.userId,
      );
    } else {
      // Single-file project
      const content = body.content || '\\documentclass{article}\\begin{document}\\end{document}';
      return await this.projectService.createProject(
        projectId,
        body.name,
        'main.tex',
        content,
        body.userId,
      );
    }
  }

  /**
   * GET /latex/projects/:id - Get project by ID
   */
  @Get('projects/:id')
  async getProject(@Param('id') id: string): Promise<LaTeXProject> {
    this.logger.log(`Fetching project ${id}`);

    const project = await this.projectService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  /**
   * PUT /latex/projects/:id - Update project
   */
  @Put('projects/:id')
  async updateProject(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      mainFile?: string;
    },
  ): Promise<LaTeXProject> {
    this.logger.log(`Updating project ${id}`);

    const project = await this.projectService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    if (body.mainFile) {
      return await this.projectService.updateMainFile(id, body.mainFile);
    }

    // For now, just return the project (name update would need new method)
    return project;
  }

  /**
   * DELETE /latex/projects/:id - Delete project
   */
  @Delete('projects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProject(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting project ${id}`);

    const project = await this.projectService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    await this.projectService.deleteProject(id);
  }

  /**
   * POST /latex/projects/:id/files - Add file to project
   */
  @Post('projects/:id/files')
  @HttpCode(HttpStatus.CREATED)
  async addProjectFile(
    @Param('id') id: string,
    @Body() body: {
      path: string;
      content: string;
      type: 'tex' | 'bib' | 'image' | 'style' | 'other';
    },
  ): Promise<LaTeXProject> {
    this.logger.log(`Adding file "${body.path}" to project ${id}`);

    return await this.projectService.addFile(id, {
      path: body.path,
      content: body.content,
      type: body.type,
    });
  }

  /**
   * PUT /latex/projects/:id/files/:fileName - Update file in project
   */
  @Put('projects/:id/files/:fileName')
  async updateProjectFile(
    @Param('id') id: string,
    @Param('fileName') fileName: string,
    @Body() body: {
      content: string;
    },
  ): Promise<LaTeXProject> {
    this.logger.log(`Updating file "${fileName}" in project ${id}`);

    return await this.projectService.updateFile(id, fileName, body.content);
  }

  /**
   * DELETE /latex/projects/:id/files/:fileName - Remove file from project
   */
  @Delete('projects/:id/files/:fileName')
  async removeProjectFile(
    @Param('id') id: string,
    @Param('fileName') fileName: string,
  ): Promise<LaTeXProject> {
    this.logger.log(`Removing file "${fileName}" from project ${id}`);

    return await this.projectService.removeFile(id, fileName);
  }

  /**
   * GET /latex/templates - List templates
   */
  @Get('templates')
  async listTemplates(
    @Query('category') category?: TemplateCategory,
    @Query('userId') userId?: string,
    @Query('publicOnly') publicOnly: boolean = true,
  ): Promise<LaTeXTemplate[]> {
    this.logger.log(`Listing templates (category: ${category}, userId: ${userId}, publicOnly: ${publicOnly})`);

    if (category) {
      return await this.templateService.listByCategory(category);
    } else if (userId && !publicOnly) {
      return await this.templateService.listUserTemplates(userId);
    } else {
      return await this.templateService.listPublicTemplates();
    }
  }

  /**
   * POST /latex/templates - Create template
   */
  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Body() body: {
      userId: string;
      name: string;
      content: string;
      category: TemplateCategory;
      variables?: Array<{ name: string; description: string; defaultValue?: string; required?: boolean; type?: 'string' | 'text' | 'date' | 'boolean' | 'list' }>;
      isPublic?: boolean;
    },
  ): Promise<LaTeXTemplate> {
    this.logger.log(`Creating template "${body.name}" for user ${body.userId}`);

    const templateId = uuidv4();
    const variables = (body.variables || []).map(v => ({
      name: v.name,
      description: v.description,
      defaultValue: v.defaultValue,
      required: v.required || false,
      type: v.type || 'string' as const,
    }));

    return await this.templateService.createTemplate(
      templateId,
      body.name,
      body.category,
      body.content,
      variables,
      body.isPublic || false,
      body.userId,
    );
  }

  /**
   * GET /latex/templates/:id - Get template by ID
   */
  @Get('templates/:id')
  async getTemplate(@Param('id') id: string): Promise<LaTeXTemplate> {
    this.logger.log(`Fetching template ${id}`);

    const template = await this.templateService.getTemplate(id);
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    return template;
  }

  /**
   * POST /latex/templates/:id/clone - Clone template to project
   */
  @Post('templates/:id/clone')
  @HttpCode(HttpStatus.CREATED)
  async cloneTemplate(
    @Param('id') id: string,
    @Body() body: {
      userId: string;
      projectName: string;
      variables?: Record<string, string>;
    },
  ): Promise<LaTeXProject> {
    this.logger.log(`Cloning template ${id} to project "${body.projectName}" for user ${body.userId}`);

    return await this.templateService.cloneToProject(
      id,
      body.userId,
      body.projectName,
      body.variables,
    );
  }

  /**
   * DELETE /latex/templates/:id - Delete template
   */
  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting template ${id}`);

    const template = await this.templateService.getTemplate(id);
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    await this.templateService.deleteTemplate(id);
  }

  /**
   * GET /latex/jobs/:jobId/pdf - Download compiled PDF
   */
  @Get('jobs/:jobId/pdf')
  async downloadPdf(
    @Param('jobId') jobId: string,
  ): Promise<void> {
    this.logger.log(`Downloading PDF for job ${jobId}`);

    // In real implementation, would fetch from GridFS or filesystem
    // For now, return 404
    throw new NotFoundException(`PDF for job ${jobId} not found`);
  }
}
