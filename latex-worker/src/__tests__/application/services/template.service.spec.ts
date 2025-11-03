/**
 * Template Service Tests
 */

import { TemplateService } from '../../../application/services/template.service';
import { ITemplateRepository } from '../../../domain/ports';
import {
  LaTeXTemplate,
  TemplateCategory,
  TemplateVariable,
} from '../../../domain/entities';

describe('TemplateService', () => {
  let service: TemplateService;
  let mockRepository: jest.Mocked<ITemplateRepository>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCategory: jest.fn(),
      findByUser: jest.fn(),
      findPublic: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    };

    service = new TemplateService(mockRepository);
  });

  describe('createTemplate', () => {
    it('should create a public template', async () => {
      const variables: TemplateVariable[] = [
        {
          name: 'author',
          description: 'Author name',
          required: true,
          type: 'string',
        },
      ];

      const template = await service.createTemplate(
        'tmpl-1',
        'Resume Template',
        TemplateCategory.RESUME,
        '\\documentclass{article}\\author{{{author}}}',
        variables,
        true,
        'user-123',
      );

      expect(template.id).toBe('tmpl-1');
      expect(template.category).toBe(TemplateCategory.RESUME);
      expect(template.isPublic).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create private template by default', async () => {
      const template = await service.createTemplate(
        'tmpl-2',
        'Private Template',
        TemplateCategory.ARTICLE,
        'content',
      );

      expect(template.isPublic).toBe(false);
    });
  });

  describe('getTemplate', () => {
    it('should get template by ID', async () => {
      const mockTemplate = LaTeXTemplate.create(
        'tmpl-1',
        'Test',
        TemplateCategory.RESUME,
        'content',
      );
      mockRepository.findById.mockResolvedValue(mockTemplate);

      const result = await service.getTemplate('tmpl-1');

      expect(result).toBe(mockTemplate);
      expect(mockRepository.findById).toHaveBeenCalledWith('tmpl-1');
    });

    it('should return null for non-existent template', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getTemplate('tmpl-999');

      expect(result).toBeNull();
    });
  });

  describe('listByCategory', () => {
    it('should list templates by category', async () => {
      const templates = [
        LaTeXTemplate.create(
          't1',
          'Resume 1',
          TemplateCategory.RESUME,
          'content',
        ),
        LaTeXTemplate.create(
          't2',
          'Resume 2',
          TemplateCategory.RESUME,
          'content',
        ),
      ];
      mockRepository.findByCategory.mockResolvedValue(templates);

      const result = await service.listByCategory(TemplateCategory.RESUME);

      expect(result).toHaveLength(2);
      expect(mockRepository.findByCategory).toHaveBeenCalledWith(
        TemplateCategory.RESUME,
      );
    });
  });

  describe('listPublicTemplates', () => {
    it('should list public templates', async () => {
      const templates = [
        LaTeXTemplate.create(
          't1',
          'Public 1',
          TemplateCategory.ARTICLE,
          'content',
          [],
          true,
        ),
      ];
      mockRepository.findPublic.mockResolvedValue(templates);

      const result = await service.listPublicTemplates();

      expect(result).toHaveLength(1);
      expect(mockRepository.findPublic).toHaveBeenCalled();
    });
  });

  describe('listUserTemplates', () => {
    it('should list user templates', async () => {
      const templates = [
        LaTeXTemplate.create(
          't1',
          'My Template',
          TemplateCategory.RESUME,
          'content',
          [],
          false,
          'user-1',
        ),
      ];
      mockRepository.findByUser.mockResolvedValue(templates);

      const result = await service.listUserTemplates('user-1');

      expect(result).toHaveLength(1);
      expect(mockRepository.findByUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('searchTemplates', () => {
    it('should search templates', async () => {
      const templates = [
        LaTeXTemplate.create(
          't1',
          'Resume Template',
          TemplateCategory.RESUME,
          'content',
        ),
      ];
      mockRepository.search.mockResolvedValue(templates);

      const result = await service.searchTemplates('resume');

      expect(result).toHaveLength(1);
      expect(mockRepository.search).toHaveBeenCalledWith('resume');
    });
  });

  describe('updateContent', () => {
    it('should update template content', async () => {
      const template = LaTeXTemplate.create(
        't1',
        'Test',
        TemplateCategory.ARTICLE,
        'old',
      );
      mockRepository.findById.mockResolvedValue(template);

      const result = await service.updateContent('t1', 'new content');

      expect(result.content).toBe('new content');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error if template not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateContent('t999', 'content')).rejects.toThrow(
        'Template t999 not found',
      );
    });
  });

  describe('updateVariables', () => {
    it('should update template variables', async () => {
      const template = LaTeXTemplate.create(
        't1',
        'Test',
        TemplateCategory.RESUME,
        'content',
      );
      mockRepository.findById.mockResolvedValue(template);

      const newVars: TemplateVariable[] = [
        {
          name: 'name',
          description: 'Full name',
          required: true,
          type: 'string',
        },
      ];

      const result = await service.updateVariables('t1', newVars);

      expect(result.variables).toHaveLength(1);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('toggleVisibility', () => {
    it('should toggle template from private to public', async () => {
      const template = LaTeXTemplate.create(
        't1',
        'Test',
        TemplateCategory.ARTICLE,
        'content',
        [],
        false,
      );
      mockRepository.findById.mockResolvedValue(template);

      const result = await service.toggleVisibility('t1');

      expect(result.isPublic).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should toggle template from public to private', async () => {
      const template = LaTeXTemplate.create(
        't1',
        'Test',
        TemplateCategory.ARTICLE,
        'content',
        [],
        true,
      );
      mockRepository.findById.mockResolvedValue(template);

      const result = await service.toggleVisibility('t1');

      expect(result.isPublic).toBe(false);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      await service.deleteTemplate('t1');

      expect(mockRepository.delete).toHaveBeenCalledWith('t1');
    });
  });

  describe('substituteVariables', () => {
    it('should substitute variables in content', () => {
      const content = 'Hello {{name}}, your email is {{email}}';
      const values = { name: 'John', email: 'john@example.com' };

      const result = service.substituteVariables(content, values);

      expect(result).toBe('Hello John, your email is john@example.com');
    });

    it('should handle variables with spaces', () => {
      const content = 'Welcome {{ name }}!';
      const values = { name: 'Alice' };

      const result = service.substituteVariables(content, values);

      expect(result).toBe('Welcome Alice!');
    });

    it('should handle missing variables gracefully', () => {
      const content = 'Hello {{name}}, {{missing}}';
      const values = { name: 'Bob' };

      const result = service.substituteVariables(content, values);

      expect(result).toBe('Hello Bob, {{missing}}');
    });
  });

  describe('cloneToProject', () => {
    it('should clone template to project with variables', async () => {
      const variables: TemplateVariable[] = [
        { name: 'name', description: 'Name', required: true, type: 'string' },
        {
          name: 'email',
          description: 'Email',
          required: false,
          type: 'string',
          defaultValue: 'no-reply@example.com',
        },
      ];

      const template = LaTeXTemplate.create(
        't1',
        'Resume',
        TemplateCategory.RESUME,
        '\\author{{{name}}}\\email{{{email}}}',
        variables,
      );
      mockRepository.findById.mockResolvedValue(template);

      const project = await service.cloneToProject(
        't1',
        'p1',
        'My Resume',
        { name: 'John Doe' },
        'user-1',
      );

      expect(project.id).toBe('p1');
      expect(project.name).toBe('My Resume');
      expect(project.files[0].content).toContain('John Doe');
      expect(project.files[0].content).toContain('no-reply@example.com');
    });

    it('should throw error for missing required variables', async () => {
      const variables: TemplateVariable[] = [
        { name: 'name', description: 'Name', required: true, type: 'string' },
      ];

      const template = LaTeXTemplate.create(
        't1',
        'Test',
        TemplateCategory.RESUME,
        'content',
        variables,
      );
      mockRepository.findById.mockResolvedValue(template);

      await expect(
        service.cloneToProject('t1', 'p1', 'Project', {}),
      ).rejects.toThrow('Missing required variables: name');
    });

    it('should throw error if template not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.cloneToProject('t999', 'p1', 'Project', {}),
      ).rejects.toThrow('Template t999 not found');
    });
  });

  describe('extractVariables', () => {
    it('should extract variable names from content', () => {
      const content = 'Name: {{name}}, Email: {{email}}, Phone: {{phone}}';

      const variables = service.extractVariables(content);

      expect(variables).toEqual(['name', 'email', 'phone']);
    });

    it('should handle duplicates', () => {
      const content = '{{name}} {{name}} {{email}}';

      const variables = service.extractVariables(content);

      expect(variables).toEqual(['name', 'email']);
    });

    it('should return empty array if no variables', () => {
      const content = 'No variables here';

      const variables = service.extractVariables(content);

      expect(variables).toEqual([]);
    });
  });

  describe('validateTemplate', () => {
    it('should validate correct template', () => {
      const content =
        '\\documentclass{article}\\begin{document}Hello\\end{document}';

      const result = service.validateTemplate(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing documentclass', () => {
      const content = '\\begin{document}Hello\\end{document}';

      const result = service.validateTemplate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template must include \\documentclass');
    });

    it('should detect missing begin document', () => {
      const content = '\\documentclass{article}\\end{document}';

      const result = service.validateTemplate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Template must include \\begin{document}',
      );
    });

    it('should detect missing end document', () => {
      const content = '\\documentclass{article}\\begin{document}';

      const result = service.validateTemplate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template must include \\end{document}');
    });

    it('should detect unmatched braces', () => {
      const content =
        '\\documentclass{article}\\begin{document}{Hello\\end{document}';

      const result = service.validateTemplate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched braces in template');
    });
  });

  describe('getTemplateStats', () => {
    it('should return template statistics', async () => {
      const variables: TemplateVariable[] = [
        { name: 'name', description: 'Name', required: true, type: 'string' },
        {
          name: 'email',
          description: 'Email',
          required: false,
          type: 'string',
        },
        { name: 'phone', description: 'Phone', required: true, type: 'string' },
      ];

      const content = 'Line 1\nLine 2\nLine 3';
      const template = LaTeXTemplate.create(
        't1',
        'Test',
        TemplateCategory.RESUME,
        content,
        variables,
      );
      mockRepository.findById.mockResolvedValue(template);

      const stats = await service.getTemplateStats('t1');

      expect(stats.variableCount).toBe(3);
      expect(stats.requiredVariableCount).toBe(2);
      expect(stats.lineCount).toBe(3);
      expect(stats.characterCount).toBe(content.length);
    });

    it('should throw error if template not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getTemplateStats('t999')).rejects.toThrow(
        'not found',
      );
    });
  });
});
