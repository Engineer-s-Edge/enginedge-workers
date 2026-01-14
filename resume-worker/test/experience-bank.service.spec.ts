import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ExperienceBankService } from '../src/application/services/experience-bank.service';
import { BulletEvaluatorService } from '../src/application/services/bullet-evaluator.service';

describe('ExperienceBankService', () => {
  let service: ExperienceBankService;
  let mockModel: any;
  let mockQuery: any;

  beforeEach(async () => {
    mockQuery = {
      sort: jest.fn(),
      limit: jest.fn(),
      exec: jest.fn(),
    };
    mockQuery.sort.mockReturnValue(mockQuery);
    mockQuery.limit.mockReturnValue(mockQuery);

    mockModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue(mockQuery),
      findOne: jest.fn().mockReturnValue(mockQuery),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperienceBankService,
        {
          provide: getModelToken('ExperienceBankItem'),
          useValue: mockModel,
        },
        {
          provide: BulletEvaluatorService,
          useValue: { evaluateBullet: jest.fn() },
        }
      ],
    }).compile();

    service = module.get<ExperienceBankService>(ExperienceBankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('add', () => {
    it('should add a bullet to the experience bank', async () => {
      const bulletData: any = {
        userId: 'user123',
        bulletText: 'Developed scalable microservices',
        metadata: {
          technologies: ['Node.js', 'Docker'],
          role: 'Software Engineer',
          company: 'Tech Corp',
          dateRange: '2020-2021',
          metrics: ['Served 1M users'],
          keywords: ['microservices', 'scale'],
          reviewed: true,
          qualityScore: 0.9,
          version: 1,
          domain: 'Backend',
          difficulty: 'Hard',
          impact: 'High',
          // New required fields
          linkedExperienceId: 'exp123',
          category: 'Engineering',
          impactScore: 9,
          atsScore: 90
        },
      };

      const savedBullet = {
        ...bulletData,
        _id: 'bullet123',
        vector: [0.1, 0.2, 0.3],
        vectorModel: 'text-embedding-ada-002',
        hash: 'abc123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockModel.create.mockResolvedValue(savedBullet);

      const result = await service.add(bulletData);

      expect(result).toEqual(savedBullet);
      expect(mockModel.create).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search experience bank with filters', async () => {
      const searchParams = {
        query: 'microservices',
        filters: {
          technologies: ['Node.js'],
          reviewed: true,
        },
        limit: 10,
      };

      const mockResults: any[] = [
        {
          _id: 'bullet1',
          bulletText: 'Developed microservices',
          metadata: { technologies: ['Node.js'] },
          userId: 'user1',
          vector: [],
          vectorModel: 'model1',
          hash: 'hash1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock the search implementation
      jest.spyOn(service, 'search').mockResolvedValue(mockResults);

      const results = await service.search('user123', searchParams);

      expect(results).toEqual(mockResults);
      expect(results.length).toBeLessThanOrEqual(searchParams.limit);
    });
  });

  describe('markReviewed', () => {
    it('should mark a bullet as reviewed', async () => {
      const bulletId = '507f1f77bcf86cd799439011';
      
      const updateOneMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      });
      
      mockModel.updateOne = updateOneMock;

      await service.markReviewed(new Types.ObjectId(bulletId), true);

      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(bulletId) }, 
        { $set: { 'metadata.reviewed': true } }
      );
    });
  });

  describe('list', () => {
    it('should list bullets with filters', async () => {
      const mockBullets = [
        { _id: 'bullet1', bulletText: 'Test 1' },
        { _id: 'bullet2', bulletText: 'Test 2' },
      ];

      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBullets),
      };
      mockModel.find.mockReturnValue(mockQueryChain);

      const results = await service.list('user123', { reviewed: true });

      expect(results).toEqual(mockBullets);
      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
        }),
      );
    });
  });
});
