/**
 * Project Service Tests
 */

import { ProjectService } from '../../../application/services/project.service';
import { IProjectRepository } from '../../../domain/ports';
import { LaTeXProject, ProjectFile, ProjectDependency } from '../../../domain/entities';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepository: jest.Mocked<IProjectRepository>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUser: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
    };

    service = new ProjectService(mockRepository);
  });

  describe('createProject', () => {
    it('should create a single-file project', async () => {
      const project = await service.createProject(
        'proj-1',
        'My Project',
        'main.tex',
        '\\documentclass{article}\\begin{document}Hello\\end{document}',
        'user-123',
      );

      expect(project.id).toBe('proj-1');
      expect(project.name).toBe('My Project');
      expect(project.mainFile).toBe('main.tex');
      expect(project.files).toHaveLength(1);
      expect(mockRepository.save).toHaveBeenCalledWith(project);
    });

    it('should create project without userId', async () => {
      const project = await service.createProject(
        'proj-2',
        'Public Project',
        'main.tex',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
      );

      expect(project.userId).toBeUndefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('createMultiFileProject', () => {
    it('should create a multi-file project', async () => {
      const files: ProjectFile[] = [
        { path: 'main.tex', content: '\\input{chapter1}', type: 'tex' },
        { path: 'chapter1.tex', content: '\\section{Chapter 1}', type: 'tex' },
        { path: 'refs.bib', content: '@article{test}', type: 'bib' },
      ];

      const project = await service.createMultiFileProject(
        'proj-3',
        'Book Project',
        'main.tex',
        files,
        'user-123',
      );

      expect(project.files).toHaveLength(3);
      expect(project.mainFile).toBe('main.tex');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle empty main file content', async () => {
      const files: ProjectFile[] = [
        { path: 'chapter.tex', content: 'Chapter content', type: 'tex' },
      ];

      const project = await service.createMultiFileProject(
        'proj-4',
        'Test',
        'missing.tex',
        files,
      );

      expect(project.files[0].content).toBe('');
    });
  });

  describe('getProject', () => {
    it('should get project by ID', async () => {
      const mockProject = LaTeXProject.create(
        'proj-1',
        'Test',
        'main.tex',
        'content',
      );
      mockRepository.findById.mockResolvedValue(mockProject);

      const result = await service.getProject('proj-1');

      expect(result).toBe(mockProject);
      expect(mockRepository.findById).toHaveBeenCalledWith('proj-1');
    });

    it('should return null for non-existent project', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getProject('proj-999');

      expect(result).toBeNull();
    });
  });

  describe('listUserProjects', () => {
    it('should list projects for a user', async () => {
      const projects = [
        LaTeXProject.create('p1', 'Project 1', 'main.tex', 'content', 'user-1'),
        LaTeXProject.create('p2', 'Project 2', 'main.tex', 'content', 'user-1'),
      ];
      mockRepository.findByUser.mockResolvedValue(projects);

      const result = await service.listUserProjects('user-1');

      expect(result).toHaveLength(2);
      expect(mockRepository.findByUser).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array for user with no projects', async () => {
      mockRepository.findByUser.mockResolvedValue([]);

      const result = await service.listUserProjects('user-999');

      expect(result).toEqual([]);
    });
  });

  describe('listProjects', () => {
    it('should list projects with pagination', async () => {
      const projects = [
        LaTeXProject.create('p1', 'Project 1', 'main.tex', 'content'),
      ];
      mockRepository.list.mockResolvedValue(projects);

      const result = await service.listProjects(0, 10);

      expect(result).toHaveLength(1);
      expect(mockRepository.list).toHaveBeenCalledWith(0, 10);
    });

    it('should use default pagination values', async () => {
      mockRepository.list.mockResolvedValue([]);

      await service.listProjects();

      expect(mockRepository.list).toHaveBeenCalledWith(0, 50);
    });
  });

  describe('addFile', () => {
    it('should add a file to project', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      mockRepository.findById.mockResolvedValue(project);

      const newFile: ProjectFile = {
        path: 'chapter.tex',
        content: 'Chapter',
        type: 'tex',
      };

      const result = await service.addFile('p1', newFile);

      expect(result.files).toHaveLength(2);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error if project not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.addFile('p999', { path: 'test.tex', content: '', type: 'tex' }),
      ).rejects.toThrow('Project p999 not found');
    });
  });

  describe('updateFile', () => {
    it('should update file content', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'old content');
      mockRepository.findById.mockResolvedValue(project);

      const result = await service.updateFile('p1', 'main.tex', 'new content');

      expect(result.files[0].content).toBe('new content');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error if file not found', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      mockRepository.findById.mockResolvedValue(project);

      await expect(
        service.updateFile('p1', 'missing.tex', 'content'),
      ).rejects.toThrow('File missing.tex not found');
    });

    it('should throw error if project not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateFile('p999', 'main.tex', 'content'),
      ).rejects.toThrow('Project p999 not found');
    });
  });

  describe('removeFile', () => {
    it('should remove a file from project', async () => {
      let project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      project = project.addFile({ path: 'chapter.tex', content: 'ch', type: 'tex' });
      mockRepository.findById.mockResolvedValue(project);

      const result = await service.removeFile('p1', 'chapter.tex');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('main.tex');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error if trying to remove main file', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      mockRepository.findById.mockResolvedValue(project);

      await expect(
        service.removeFile('p1', 'main.tex'),
      ).rejects.toThrow('Cannot remove main file');
    });
  });

  describe('addDependency', () => {
    it('should add a dependency to project', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      mockRepository.findById.mockResolvedValue(project);

      const dep: ProjectDependency = {
        type: 'package',
        name: 'amsmath',
        version: '2.0',
      };

      const result = await service.addDependency('p1', dep);

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].name).toBe('amsmath');
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('updateMainFile', () => {
    it('should update project main file', async () => {
      let project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      project = project.addFile({ path: 'alt.tex', content: 'alt', type: 'tex' });
      mockRepository.findById.mockResolvedValue(project);

      const result = await service.updateMainFile('p1', 'alt.tex');

      expect(result.mainFile).toBe('alt.tex');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error if file does not exist', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      mockRepository.findById.mockResolvedValue(project);

      await expect(
        service.updateMainFile('p1', 'missing.tex'),
      ).rejects.toThrow('File missing.tex not found');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      await service.deleteProject('p1');

      expect(mockRepository.delete).toHaveBeenCalledWith('p1');
    });
  });

  describe('getFileCount', () => {
    it('should return file count', async () => {
      let project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      project = project.addFile({ path: 'ch1.tex', content: '', type: 'tex' });
      project = project.addFile({ path: 'ch2.tex', content: '', type: 'tex' });
      mockRepository.findById.mockResolvedValue(project);

      const count = await service.getFileCount('p1');

      expect(count).toBe(3);
    });

    it('should throw error if project not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getFileCount('p999')).rejects.toThrow('not found');
    });
  });

  describe('getDependencies', () => {
    it('should return project dependencies', async () => {
      let project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      project = project.addDependency({ type: 'package', name: 'amsmath' });
      mockRepository.findById.mockResolvedValue(project);

      const deps = await service.getDependencies('p1');

      expect(deps).toHaveLength(1);
      expect(deps[0].name).toBe('amsmath');
    });
  });

  describe('hasFile', () => {
    it('should return true if file exists', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      mockRepository.findById.mockResolvedValue(project);

      const result = await service.hasFile('p1', 'main.tex');

      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const project = LaTeXProject.create('p1', 'Test', 'main.tex', 'content');
      mockRepository.findById.mockResolvedValue(project);

      const result = await service.hasFile('p1', 'missing.tex');

      expect(result).toBe(false);
    });

    it('should return false if project not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.hasFile('p999', 'main.tex');

      expect(result).toBe(false);
    });
  });
});
