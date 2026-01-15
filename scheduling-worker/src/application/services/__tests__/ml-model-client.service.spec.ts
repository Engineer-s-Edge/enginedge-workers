import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MLModelClient } from '../ml-model-client.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MLModelClient', () => {
  let service: MLModelClient;
  let configService: ConfigService;

  beforeEach(async () => {
    mockedAxios.create.mockReturnValue(mockedAxios);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MLModelClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ML_SERVICE_URL') return 'http://localhost:8000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MLModelClient>(MLModelClient);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('healthCheck', () => {
    it('should return true when ML service is healthy', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { status: 'ok', models_initialized: true },
      });

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/health',
      );
    });

    it('should return false when ML service is down', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on timeout', async () => {
      mockedAxios.get.mockRejectedValueOnce({ code: 'ECONNABORTED' });

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('mapDeliverable', () => {
    it('should map deliverable text to features successfully', async () => {
      const mockResponse = {
        embedding: [0.1, 0.2, 0.3],
        category: 'review',
        category_confidence: 0.9,
        urgency: 'medium',
        priority: 'high',
        estimated_duration_hours: 0.75,
        semantic_features: {},
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.mapDeliverable('Review PR #123', {
        userId: 'user1',
      });

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/map-deliverable',
        {
          deliverable_text: 'Review PR #123',
          context: { userId: 'user1' },
        },
      );
    });

    it('should throw error when ML service fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('ML service error'));

      await expect(
        service.mapDeliverable('Invalid task', {}),
      ).rejects.toThrow();
    });

    it('should handle empty text gracefully', async () => {
      const mockResponse = {
        embedding: [],
        category: 'unknown',
        category_confidence: 0,
        urgency: 'low',
        priority: 'low',
        estimated_duration_hours: 0.5,
        semantic_features: {},
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.mapDeliverable('', {});

      expect(result).toEqual(mockResponse);
    });
  });

  describe('predictOptimalSlots', () => {
    it('should predict optimal time slots successfully', async () => {
      const mockResponse = {
        recommendations: [
          { hour: 9, confidence: 0.9, reasoning: 'Morning productivity peak' },
          { hour: 14, confidence: 0.7, reasoning: 'Post-lunch focus time' },
        ],
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.predictOptimalSlots(
        'user1',
        { text: 'Code review', priority: 'high' },
        { workingHours: [9, 17] },
      );

      expect(result).toEqual(mockResponse.recommendations);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/predict-slots',
        {
          user_id: 'user1',
          deliverable: { text: 'Code review', priority: 'high' },
          context: { workingHours: [9, 17] },
        },
      );
    });

    it('should return empty array when no slots predicted', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { recommendations: [] } });

      const result = await service.predictOptimalSlots('user1', {}, {});

      expect(result).toEqual([]);
    });

    it('should handle ML service timeout', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout',
      });

      await expect(
        service.predictOptimalSlots('user1', {}, {}),
      ).rejects.toThrow();
    });
  });

  describe('batchMapDeliverables', () => {
    it('should map multiple deliverables in batch', async () => {
      const tasks = [
        { text: 'Task 1' },
        { text: 'Task 2' },
        { text: 'Task 3' },
      ];

      const mockResponses = tasks.map((task, i) => ({
        embedding: [i, i, i],
        category: 'review',
        category_confidence: 0.8,
        urgency: 'low',
        priority: 'low',
        estimated_duration_hours: 0.5 + i * 0.1,
        semantic_features: {},
      }));

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockResponses[0] })
        .mockResolvedValueOnce({ data: mockResponses[1] })
        .mockResolvedValueOnce({ data: mockResponses[2] });

      const results = await service.batchMapDeliverables(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].estimated_duration_hours).toBe(0.5);
      expect(results[2].estimated_duration_hours).toBe(0.7);
    });

    it('should handle empty batch', async () => {
      const results = await service.batchMapDeliverables([]);

      expect(results).toEqual([]);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should continue on individual failures', async () => {
      const tasks = [{ text: 'Task 1' }, { text: 'Task 2' }];

      mockedAxios.post
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          data: {
            embedding: [1],
            category: 'review',
            category_confidence: 0.8,
            urgency: 'low',
            priority: 'low',
            estimated_duration_hours: 0.5,
            semantic_features: {},
          },
        });

      const results = await service.batchMapDeliverables(tasks);

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('review');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        code: 'ENETUNREACH',
        message: 'Network unreachable',
      });

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should handle 503 Service Unavailable', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 503 },
        message: 'Service Unavailable',
      });

      await expect(service.mapDeliverable('test', {})).rejects.toThrow();
    });

    it('should handle malformed responses', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: null });

      await expect(service.mapDeliverable('test', {})).rejects.toThrow();
    });
  });

  describe('configuration', () => {
    it('should use configured ML service URL', () => {
      expect(configService.get).toHaveBeenCalledWith('ML_SERVICE_URL');
    });

    it('should have timeout configured', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000,
        }),
      );
    });
  });
});
