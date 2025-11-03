import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResumeEvaluatorService } from '../src/application/services/resume-evaluator.service';
import { BulletEvaluatorService } from '../src/application/services/bullet-evaluator.service';

describe('ResumeEvaluatorService', () => {
  let service: ResumeEvaluatorService;
  let mockReportModel: any;
  let mockResumeModel: any;
  let mockJobPostingModel: any;
  let mockBulletEvaluator: any;

  beforeEach(async () => {
    mockReportModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
    };

    mockResumeModel = {
      findById: jest.fn(),
    };

    mockJobPostingModel = {
      findById: jest.fn(),
    };

    mockBulletEvaluator = {
      evaluateBullet: jest.fn(),
      evaluateBullets: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeEvaluatorService,
        {
          provide: getModelToken('EvaluationReport'),
          useValue: mockReportModel,
        },
        {
          provide: getModelToken('Resume'),
          useValue: mockResumeModel,
        },
        {
          provide: getModelToken('JobPosting'),
          useValue: mockJobPostingModel,
        },
        {
          provide: BulletEvaluatorService,
          useValue: mockBulletEvaluator,
        },
      ],
    }).compile();

    service = module.get<ResumeEvaluatorService>(ResumeEvaluatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateResume', () => {
    it('should evaluate resume in standalone mode', async () => {
      const mockResume = {
        _id: 'resume123',
        userId: 'user123',
        latexContent: '\\documentclass{article}...',
      };

      mockResumeModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResume),
      });

      mockBulletEvaluator.evaluateBullets.mockResolvedValue([
        { overallScore: 0.9, passed: true },
        { overallScore: 0.85, passed: true },
      ]);

      const savedReport = {
        _id: 'report123',
        resumeId: 'resume123',
        scores: { overall: 85 },
        save: jest.fn().mockResolvedValue(this),
      };

      mockReportModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        _id: 'report123',
        save: jest.fn().mockResolvedValue({ ...data, _id: 'report123' }),
      }));

      const result = await service.evaluateResume('resume123', {
        mode: 'standalone',
      });

      expect(result).toBeDefined();
      expect(mockResumeModel.findById).toHaveBeenCalledWith('resume123');
    });

    it('should evaluate resume against job posting', async () => {
      const mockResume = {
        _id: 'resume123',
        userId: 'user123',
        latexContent: '\\documentclass{article}...',
      };

      const mockJobPosting = {
        _id: 'posting123',
        parsed: {
          skills: {
            skillsExplicit: ['Python', 'AWS', 'Docker'],
          },
        },
      };

      mockResumeModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResume),
      });

      mockJobPostingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockJobPosting),
      });

      mockBulletEvaluator.evaluateBullets.mockResolvedValue([
        { overallScore: 0.9, passed: true },
      ]);

      mockReportModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue({ ...data, _id: 'report123' }),
      }));

      const result = await service.evaluateResume('resume123', {
        mode: 'jd-match',
        jobPostingId: 'posting123',
      });

      expect(result).toBeDefined();
      expect(result.coverage).toBeDefined();
    });
  });

  describe('getReportById', () => {
    it('should retrieve evaluation report by ID', async () => {
      const mockReport = {
        _id: 'report123',
        resumeId: 'resume123',
        scores: { overall: 85 },
      };

      mockReportModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockReport),
      });

      const result = await service.getReportById('report123');

      expect(result).toEqual(mockReport);
      expect(mockReportModel.findById).toHaveBeenCalledWith('report123');
    });
  });
});
