import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LaTeXController } from '../../presentation/latex.controller';
import { CompileCommandUseCase } from '../../application/use-cases/compile-command.use-case';
import { ProjectService } from '../../application/services/project.service';
import { TemplateService } from '../../application/services/template.service';
import { MessageBrokerPort } from '../../application/ports/message-broker.port';
import { LaTeXProject } from '../../domain/entities/latex-project.entity';
import {
  LaTeXTemplate,
  TemplateCategory,
} from '../../domain/entities/latex-template.entity';

describe('LaTeXController', () => {
  let controller: LaTeXController;
  let compileCommandUseCase: jest.Mocked<CompileCommandUseCase>;
  let projectService: jest.Mocked<ProjectService>;
  let templateService: jest.Mocked<TemplateService>;
  let messageBroker: jest.Mocked<MessageBrokerPort>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaTeXController],
      providers: [
        {
          provide: CompileCommandUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: ProjectService,
          useValue: {
            createProject: jest.fn(),
            createMultiFileProject: jest.fn(),
            getProject: jest.fn(),
            listUserProjects: jest.fn(),
            updateMainFile: jest.fn(),
            deleteProject: jest.fn(),
            addFile: jest.fn(),
            updateFile: jest.fn(),
            removeFile: jest.fn(),
          },
        },
        {
          provide: TemplateService,
          useValue: {
            createTemplate: jest.fn(),
            getTemplate: jest.fn(),
            listByCategory: jest.fn(),
            listPublicTemplates: jest.fn(),
            listUserTemplates: jest.fn(),
            deleteTemplate: jest.fn(),
            cloneToProject: jest.fn(),
          },
        },
        {
          provide: 'MessageBrokerPort',
          useValue: {
            sendMessage: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            isConnected: jest.fn(() => true),
            subscribe: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LaTeXController>(LaTeXController);
    compileCommandUseCase = module.get(CompileCommandUseCase);
    projectService = module.get(ProjectService);
    templateService = module.get(TemplateService);
    messageBroker = module.get('MessageBrokerPort');
  });

  describe('compile', () => {
    it('should compile LaTeX content synchronously', async () => {
      const compileResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        errors: [],
        warnings: [],
        compilationTime: 1500,
      };

      compileCommandUseCase.execute.mockResolvedValue(compileResult);

      const result = await controller.compile({
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
        userId: 'user-123',
      });

      expect(result).toEqual(compileResult);
      expect(compileCommandUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          content:
            '\\documentclass{article}\\begin{document}Test\\end{document}',
        }),
      );
    });

    it('should pass compilation settings', async () => {
      const compileResult = {
        success: true,
        errors: [],
        warnings: [],
        compilationTime: 1000,
      };
      compileCommandUseCase.execute.mockResolvedValue(compileResult);

      await controller.compile({
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
        userId: 'user-123',
        settings: {
          maxPasses: 5,
          timeout: 60000,
        },
      });

      expect(compileCommandUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: {
            maxPasses: 5,
            timeout: 60000,
          },
        }),
      );
    });
  });

  describe('compileAsync', () => {
    it('should queue async compilation via Kafka', async () => {
      messageBroker.sendMessage.mockResolvedValue(undefined);

      const result = await controller.compileAsync({
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
        userId: 'user-456',
      });

      expect(result).toEqual({
        jobId: expect.any(String),
        message: 'Compilation job queued successfully',
      });

      expect(messageBroker.sendMessage).toHaveBeenCalledWith(
        'latex.compile.request',
        expect.objectContaining({
          jobId: expect.any(String),
          userId: 'user-456',
          content:
            '\\documentclass{article}\\begin{document}Test\\end{document}',
        }),
      );
    });
  });

  describe('listProjects', () => {
    it('should list user projects', async () => {
      const projects: LaTeXProject[] = [
        new LaTeXProject('proj-1', 'Project 1', 'main.tex', [], [], 'user-123'),
        new LaTeXProject('proj-2', 'Project 2', 'main.tex', [], [], 'user-123'),
      ];

      projectService.listUserProjects.mockResolvedValue(projects);

      const result = await controller.listProjects('user-123');

      expect(result.projects).toEqual(projects);
      expect(result.total).toBe(2);
      expect(projectService.listUserProjects).toHaveBeenCalledWith('user-123');
    });

    it('should throw error if userId not provided', async () => {
      await expect(controller.listProjects('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createProject', () => {
    it('should create single-file project', async () => {
      const project = new LaTeXProject(
        'proj-123',
        'My Project',
        'main.tex',
        [],
        [],
        'user-123',
      );
      projectService.createProject.mockResolvedValue(project);

      const result = await controller.createProject({
        userId: 'user-123',
        name: 'My Project',
        content:
          '\\documentclass{article}\\begin{document}Content\\end{document}',
      });

      expect(result).toEqual(project);
      expect(projectService.createProject).toHaveBeenCalledWith(
        expect.any(String),
        'My Project',
        'main.tex',
        '\\documentclass{article}\\begin{document}Content\\end{document}',
        'user-123',
      );
    });

    it('should create multi-file project', async () => {
      const project = new LaTeXProject(
        'proj-456',
        'Multi Project',
        'main.tex',
        [],
        [],
        'user-123',
      );
      projectService.createMultiFileProject.mockResolvedValue(project);

      const result = await controller.createProject({
        userId: 'user-123',
        name: 'Multi Project',
        files: [
          {
            path: 'main.tex',
            content: '\\documentclass{article}',
            type: 'tex',
          },
          { path: 'chapter1.tex', content: '\\chapter{One}', type: 'tex' },
        ],
        mainFile: 'main.tex',
      });

      expect(result).toEqual(project);
      expect(projectService.createMultiFileProject).toHaveBeenCalledWith(
        expect.any(String),
        'Multi Project',
        'main.tex',
        expect.arrayContaining([
          expect.objectContaining({ path: 'main.tex' }),
          expect.objectContaining({ path: 'chapter1.tex' }),
        ]),
        'user-123',
      );
    });
  });

  describe('getProject', () => {
    it('should get project by ID', async () => {
      const project = new LaTeXProject(
        'proj-789',
        'Test Project',
        'main.tex',
        [],
        [],
      );
      projectService.getProject.mockResolvedValue(project);

      const result = await controller.getProject('proj-789');

      expect(result).toEqual(project);
      expect(projectService.getProject).toHaveBeenCalledWith('proj-789');
    });

    it('should throw NotFoundException if project not found', async () => {
      projectService.getProject.mockResolvedValue(null);

      await expect(controller.getProject('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteProject', () => {
    it('should delete project', async () => {
      const project = new LaTeXProject(
        'proj-delete',
        'Delete Me',
        'main.tex',
        [],
        [],
      );
      projectService.getProject.mockResolvedValue(project);
      projectService.deleteProject.mockResolvedValue(undefined);

      await controller.deleteProject('proj-delete');

      expect(projectService.deleteProject).toHaveBeenCalledWith('proj-delete');
    });

    it('should throw NotFoundException if project not found', async () => {
      projectService.getProject.mockResolvedValue(null);

      await expect(controller.deleteProject('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addProjectFile', () => {
    it('should add file to project', async () => {
      const updatedProject = new LaTeXProject(
        'proj-123',
        'Project',
        'main.tex',
        [],
        [],
      );
      projectService.addFile.mockResolvedValue(updatedProject);

      const result = await controller.addProjectFile('proj-123', {
        path: 'chapter2.tex',
        content: '\\chapter{Two}',
        type: 'tex',
      });

      expect(result).toEqual(updatedProject);
      expect(projectService.addFile).toHaveBeenCalledWith('proj-123', {
        path: 'chapter2.tex',
        content: '\\chapter{Two}',
        type: 'tex',
      });
    });
  });

  describe('updateProjectFile', () => {
    it('should update file in project', async () => {
      const updatedProject = new LaTeXProject(
        'proj-123',
        'Project',
        'main.tex',
        [],
        [],
      );
      projectService.updateFile.mockResolvedValue(updatedProject);

      const result = await controller.updateProjectFile(
        'proj-123',
        'chapter1.tex',
        {
          content: 'Updated content',
        },
      );

      expect(result).toEqual(updatedProject);
      expect(projectService.updateFile).toHaveBeenCalledWith(
        'proj-123',
        'chapter1.tex',
        'Updated content',
      );
    });
  });

  describe('removeProjectFile', () => {
    it('should remove file from project', async () => {
      const updatedProject = new LaTeXProject(
        'proj-123',
        'Project',
        'main.tex',
        [],
        [],
      );
      projectService.removeFile.mockResolvedValue(updatedProject);

      const result = await controller.removeProjectFile('proj-123', 'old.tex');

      expect(result).toEqual(updatedProject);
      expect(projectService.removeFile).toHaveBeenCalledWith(
        'proj-123',
        'old.tex',
      );
    });
  });

  describe('listTemplates', () => {
    it('should list public templates', async () => {
      const templates: LaTeXTemplate[] = [
        LaTeXTemplate.create(
          'tpl-1',
          'Resume',
          'resume' as TemplateCategory,
          'content',
          [],
          true,
        ),
        LaTeXTemplate.create(
          'tpl-2',
          'Article',
          'article' as TemplateCategory,
          'content',
          [],
          true,
        ),
      ];

      templateService.listPublicTemplates.mockResolvedValue(templates);

      const result = await controller.listTemplates();

      expect(result).toEqual(templates);
      expect(templateService.listPublicTemplates).toHaveBeenCalled();
    });

    it('should list templates by category', async () => {
      const templates: LaTeXTemplate[] = [
        LaTeXTemplate.create(
          'tpl-1',
          'Resume 1',
          'resume' as TemplateCategory,
          'content',
          [],
          true,
        ),
      ];

      templateService.listByCategory.mockResolvedValue(templates);

      const result = await controller.listTemplates(
        'resume' as TemplateCategory,
      );

      expect(result).toEqual(templates);
      expect(templateService.listByCategory).toHaveBeenCalledWith('resume');
    });

    it('should list user templates', async () => {
      const templates: LaTeXTemplate[] = [
        LaTeXTemplate.create(
          'tpl-private',
          'My Template',
          'custom' as TemplateCategory,
          'content',
          [],
          false,
          'user-123',
        ),
      ];

      templateService.listUserTemplates.mockResolvedValue(templates);

      const result = await controller.listTemplates(
        undefined,
        'user-123',
        false,
      );

      expect(result).toEqual(templates);
      expect(templateService.listUserTemplates).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('createTemplate', () => {
    it('should create template', async () => {
      const template = LaTeXTemplate.create(
        'tpl-new',
        'New Template',
        'article' as TemplateCategory,
        'content',
        [],
        true,
        'user-123',
      );
      templateService.createTemplate.mockResolvedValue(template);

      const result = await controller.createTemplate({
        userId: 'user-123',
        name: 'New Template',
        content: '\\documentclass{article}',
        category: 'article' as TemplateCategory,
        isPublic: true,
      });

      expect(result).toEqual(template);
      expect(templateService.createTemplate).toHaveBeenCalledWith(
        expect.any(String),
        'New Template',
        'article',
        '\\documentclass{article}',
        [],
        true,
        'user-123',
      );
    });

    it('should create template with variables', async () => {
      const template = LaTeXTemplate.create(
        'tpl-vars',
        'Template with Vars',
        'resume' as TemplateCategory,
        'content',
        [],
        true,
        'user-123',
      );
      templateService.createTemplate.mockResolvedValue(template);

      await controller.createTemplate({
        userId: 'user-123',
        name: 'Template with Vars',
        content: 'Hello {{name}}',
        category: 'resume' as TemplateCategory,
        variables: [
          {
            name: 'name',
            description: 'Your name',
            defaultValue: 'John',
            required: true,
            type: 'string',
          },
        ],
      });

      expect(templateService.createTemplate).toHaveBeenCalledWith(
        expect.any(String),
        'Template with Vars',
        'resume',
        'Hello {{name}}',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            defaultValue: 'John',
            required: true,
          }),
        ]),
        false,
        'user-123',
      );
    });
  });

  describe('getTemplate', () => {
    it('should get template by ID', async () => {
      const template = LaTeXTemplate.create(
        'tpl-get',
        'Get Me',
        'article' as TemplateCategory,
        'content',
        [],
        true,
      );
      templateService.getTemplate.mockResolvedValue(template);

      const result = await controller.getTemplate('tpl-get');

      expect(result).toEqual(template);
      expect(templateService.getTemplate).toHaveBeenCalledWith('tpl-get');
    });

    it('should throw NotFoundException if template not found', async () => {
      templateService.getTemplate.mockResolvedValue(null);

      await expect(controller.getTemplate('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cloneTemplate', () => {
    it('should clone template to project', async () => {
      const project = new LaTeXProject(
        'cloned-proj',
        'Cloned Project',
        'main.tex',
        [],
        [],
        'user-123',
      );
      templateService.cloneToProject.mockResolvedValue(project);

      const result = await controller.cloneTemplate('tpl-clone', {
        userId: 'user-123',
        projectName: 'Cloned Project',
        variables: { name: 'Alice' },
      });

      expect(result).toEqual(project);
      expect(templateService.cloneToProject).toHaveBeenCalledWith(
        'tpl-clone',
        'user-123',
        'Cloned Project',
        { name: 'Alice' },
      );
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      const template = LaTeXTemplate.create(
        'tpl-delete',
        'Delete Me',
        'article' as TemplateCategory,
        'content',
        [],
        true,
      );
      templateService.getTemplate.mockResolvedValue(template);
      templateService.deleteTemplate.mockResolvedValue(undefined);

      await controller.deleteTemplate('tpl-delete');

      expect(templateService.deleteTemplate).toHaveBeenCalledWith('tpl-delete');
    });

    it('should throw NotFoundException if template not found', async () => {
      templateService.getTemplate.mockResolvedValue(null);

      await expect(controller.deleteTemplate('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('downloadPdf', () => {
    it('should throw NotFoundException', async () => {
      await expect(controller.downloadPdf('job-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
