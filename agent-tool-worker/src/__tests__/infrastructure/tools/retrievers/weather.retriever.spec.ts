/**
 * Weather Retriever - Unit Tests
 *
 * Tests the Weather retriever implementation for weather data retrieval.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  WeatherRetriever,
  WeatherArgs,
} from '@infrastructure/tools/retrievers/weather.retriever';

describe('WeatherRetriever', () => {
  let retriever: WeatherRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WeatherRetriever],
    }).compile();

    retriever = module.get<WeatherRetriever>(WeatherRetriever);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('weather-retriever');
      expect(retriever.description).toContain('weather data');
    });

    it('should have metadata configured', () => {
      expect(retriever.metadata).toBeDefined();
      expect(retriever.metadata.name).toBe('weather-retriever');
    });

    it('should have error events configured', () => {
      expect(retriever.errorEvents).toBeDefined();
      expect(retriever.errorEvents.length).toBeGreaterThan(0);
    });

    it('should have correct retrieval type and caching settings', () => {
      expect(retriever.retrievalType).toBe('API_DATA');
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject empty location', async () => {
      const args: WeatherArgs = {
        location: '',
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Location cannot be empty');
    });

    it('should reject location that is only whitespace', async () => {
      const args: WeatherArgs = {
        location: '   ',
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Location cannot be empty');
    });

    it('should reject location longer than 100 characters', async () => {
      const longLocation = 'a'.repeat(101);
      const args: WeatherArgs = {
        location: longLocation,
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Location too long');
    });

    it('should reject invalid date format for historical data', async () => {
      const args: WeatherArgs = {
        location: 'London',
        type: 'historical',
        date: '2023/12/25', // Invalid format
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'Date must be in YYYY-MM-DD format',
      );
    });
  });

  describe('Weather Types', () => {
    it('should handle current weather requests (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'London',
        type: 'current',
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle forecast weather requests (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'New York',
        type: 'forecast',
        days: 5,
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle historical weather requests (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'Tokyo',
        type: 'historical',
        date: '2023-12-25',
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Configuration Options', () => {
    it('should handle different units (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'Paris',
        units: 'imperial',
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle forecast days configuration (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'Sydney',
        type: 'forecast',
        days: 10,
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle hourly forecast option (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'Berlin',
        type: 'forecast',
        include_hourly: true,
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle weather alerts option (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'Miami',
        type: 'forecast',
        include_alerts: true,
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle language configuration (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'Madrid',
        language: 'es',
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('RAG Configuration', () => {
    it('should handle RAG configuration parameters (will fail due to network)', async () => {
      const args: WeatherArgs = {
        location: 'Toronto',
      };

      const ragConfig = {
        similarity: 0.8,
        topK: 50,
        includeMetadata: false,
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args: { ...args, ragConfig },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network connectivity issues', async () => {
      const args: WeatherArgs = {
        location: 'non-existent-location-12345',
      };

      const result = await retriever.execute({
        name: 'weather-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
