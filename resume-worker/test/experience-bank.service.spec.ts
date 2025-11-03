import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ExperienceBankService } from '../src/application/services/experience-bank.service';

describe('ExperienceBankService', () => {
  let service: ExperienceBankService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      create: jest.fn(),
      find: jest.fn(),
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
      ],
    }).compile();

    service = module.get<ExperienceBankService>(ExperienceBankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('add', () => {
    it('should add a bullet to the experience bank', async () => {
      const bulletData = {
        userId: 'user123',
        bulletText: 'Developed scalable microservices',
        metadata: {
          technologies: ['Node.js', 'Docker'],
          role: 'Software Engineer',
        },
      };

      const savedBullet = {
        ...bulletData,
        _id: 'bullet123',
        vector: [0.1, 0.2, 0.3],
        hash: 'abc123',
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

      const mockResults = [
        {
          _id: 'bullet1',
          bulletText: 'Developed microservices',
          metadata: { technologies: ['Node.js'] },
        },
      ];

      // Mock the search implementation
      jest.spyOn(service, 'search').mockResolvedValue(mockResults);

      const results = await service.search('user123', searchParams);

      expect(results).toEqual(mockResults);
      expect(results.length).toBeLessThanOrEqual(searchParams.limit);
    });
  });

  describe('markAsReviewed', () => {
    it('should mark a bullet as reviewed', async () => {
      const bulletId = 'bullet123';
      const updatedBullet = {
        _id: bulletId,
        metadata: { reviewed: true },
      };

      mockModel.findByIdAndUpdate.mockResolvedValue(updatedBullet);

      const result = await service.markAsReviewed(bulletId);

      expect(result.metadata.reviewed).toBe(true);
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        bulletId,
        expect.objectContaining({
          'metadata.reviewed': true,
        }),
        expect.any(Object)
      );
    });
  });

  describe('list', () => {
    it('should list bullets with filters', async () => {
      const mockBullets = [
        { _id: 'bullet1', bulletText: 'Test 1' },
        { _id: 'bullet2', bulletText: 'Test 2' },
      ];

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockBullets),
        }),
      });

      const results = await service.list('user123', { reviewed: true });

      expect(results).toEqual(mockBullets);
      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
        })
      );
    });
  });
});

