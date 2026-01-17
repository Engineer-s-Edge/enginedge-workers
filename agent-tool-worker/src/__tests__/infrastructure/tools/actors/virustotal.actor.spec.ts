/**
 * VirusTotal Actor - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  VirusTotalActor,
  VirusTotalArgs,
} from '../../../../infrastructure/tools/actors/virustotal.actor';

describe('VirusTotalActor', () => {
  let actor: VirusTotalActor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VirusTotalActor],
    }).compile();

    actor = module.get<VirusTotalActor>(VirusTotalActor);
  });

  it('should be defined', () => {
    expect(actor).toBeDefined();
  });

  describe('Metadata', () => {
    it('should have correct name', () => {
      expect(actor.name).toBe('virustotal-actor');
    });

    it('should have correct description', () => {
      expect(actor.description).toBe(
        'Provides integration with VirusTotal API for file scanning and analysis',
      );
    });

    it('should have correct category', () => {
      expect(actor.category).toBe('EXTERNAL_SECURITY');
    });

    it('should require authentication', () => {
      expect(actor.requiresAuth).toBe(true);
    });
  });

  describe('Error Events', () => {
    it('should define all required error events', () => {
      const errorNames = actor.errorEvents.map((e) => e.name);
      expect(errorNames).toContain('AuthenticationError');
      expect(errorNames).toContain('RateLimitError');
      expect(errorNames).toContain('NetworkError');
      expect(errorNames).toContain('ValidationError');
      expect(errorNames).toContain('NotFoundError');
      expect(errorNames).toContain('QuotaExceededError');
    });
  });

  describe('Authentication', () => {
    it('should throw AuthenticationError when API key is missing', async () => {
      const args: VirusTotalArgs = {
        operation: 'scan-file',
        fileContent: 'dGVzdCBmaWxlIGNvbnRlbnQ=', // base64 "test file content"
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('VirusTotal API key is required');
      expect(result.error?.name).toBe('AuthenticationError');
    });
  });

  describe('scan-file operation', () => {
    const validArgs: VirusTotalArgs = {
      operation: 'scan-file',
      apiKey: 'test-api-key',
      fileContent: 'dGVzdCBmaWxlIGNvbnRlbnQ=', // base64 "test file content"
      fileName: 'test.txt',
    };

    it('should successfully scan a file', async () => {
      const result = await actor.execute({
        name: 'virustotal-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('scan-file');
      expect(result.output?.scanId).toBeDefined();
      expect(result.output?.resource).toBeDefined();
      expect(result.output?.permalink).toContain('virustotal.com');
    });

    it('should throw ValidationError when file content is missing', async () => {
      const args: VirusTotalArgs = {
        operation: 'scan-file',
        apiKey: 'test-api-key',
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'File content is required for scanning',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('get-scan-report operation', () => {
    const validArgs: VirusTotalArgs = {
      operation: 'get-scan-report',
      apiKey: 'test-api-key',
      resource: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a66c4538dfd',
    };

    it('should successfully get scan report', async () => {
      const result = await actor.execute({
        name: 'virustotal-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('get-scan-report');
      expect(result.output?.report).toBeDefined();
      expect(result.output?.positives).toBeDefined();
      expect(result.output?.total).toBeDefined();
      expect(result.output?.detected).toBeDefined();
      expect(result.output?.permalink).toContain('virustotal.com');
    });

    it('should throw ValidationError when resource is missing', async () => {
      const args: VirusTotalArgs = {
        operation: 'get-scan-report',
        apiKey: 'test-api-key',
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Resource identifier is required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('scan-url operation', () => {
    const validArgs: VirusTotalArgs = {
      operation: 'scan-url',
      apiKey: 'test-api-key',
      url: 'https://example.com',
    };

    it('should successfully scan a URL', async () => {
      const result = await actor.execute({
        name: 'virustotal-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('scan-url');
      expect(result.output?.scanId).toBeDefined();
      expect(result.output?.resource).toBeDefined();
      expect(result.output?.permalink).toContain('virustotal.com');
    });

    it('should throw ValidationError when URL is missing', async () => {
      const args: VirusTotalArgs = {
        operation: 'scan-url',
        apiKey: 'test-api-key',
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('URL is required for scanning');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('get-url-report operation', () => {
    const validArgs: VirusTotalArgs = {
      operation: 'get-url-report',
      apiKey: 'test-api-key',
      resource: 'url-resource-123',
    };

    it('should successfully get URL report', async () => {
      const result = await actor.execute({
        name: 'virustotal-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('get-url-report');
      expect(result.output?.report).toBeDefined();
      expect(result.output?.positives).toBeDefined();
      expect(result.output?.total).toBeDefined();
      expect(result.output?.detected).toBeDefined();
      expect(result.output?.permalink).toContain('virustotal.com');
    });

    it('should accept URL parameter', async () => {
      const args: VirusTotalArgs = {
        operation: 'get-url-report',
        apiKey: 'test-api-key',
        url: 'https://example.com',
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('get-url-report');
      expect(result.output?.report).toBeDefined();
    });

    it('should throw ValidationError when both resource and URL are missing', async () => {
      const args: VirusTotalArgs = {
        operation: 'get-url-report',
        apiKey: 'test-api-key',
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Resource identifier or URL is required',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('get-file-behaviors operation', () => {
    const validArgs: VirusTotalArgs = {
      operation: 'get-file-behaviors',
      apiKey: 'test-api-key',
      resource: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a66c4538dfd',
    };

    it('should successfully get file behaviors', async () => {
      const result = await actor.execute({
        name: 'virustotal-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('get-file-behaviors');
      expect(result.output?.behaviors).toBeDefined();
      expect(Array.isArray(result.output?.behaviors)).toBe(true);
    });

    it('should throw ValidationError when resource is missing', async () => {
      const args: VirusTotalArgs = {
        operation: 'get-file-behaviors',
        apiKey: 'test-api-key',
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Resource identifier is required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('get-domain-report operation', () => {
    const validArgs: VirusTotalArgs = {
      operation: 'get-domain-report',
      apiKey: 'test-api-key',
      domain: 'example.com',
    };

    it('should successfully get domain report', async () => {
      const result = await actor.execute({
        name: 'virustotal-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('get-domain-report');
      expect(result.output?.report).toBeDefined();
      expect(result.output?.positives).toBeDefined();
      expect(result.output?.total).toBeDefined();
      expect(result.output?.detected).toBeDefined();
      expect(result.output?.permalink).toContain('virustotal.com');
    });

    it('should throw ValidationError when domain is missing', async () => {
      const args: VirusTotalArgs = {
        operation: 'get-domain-report',
        apiKey: 'test-api-key',
      };

      const result = await actor.execute({
        name: 'virustotal-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Domain is required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Unsupported operations', () => {
    it('should throw ValidationError for unsupported operation', async () => {
      const args = {
        operation: 'unsupported-op',
        apiKey: 'test-api-key',
      };

      const result = await actor.execute({ name: 'virustotal-actor', args });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Unsupported operation: unsupported-op',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Error handling', () => {
    it('should handle authentication errors', () => {
      const error = new Error('403 Forbidden');
      const handledError = (
        actor as unknown as { handleApiError: (error: unknown) => Error }
      ).handleApiError(error);

      expect(handledError.name).toBe('AuthenticationError');
      expect(handledError.message).toContain('Invalid API key');
    });

    it('should handle rate limit errors', () => {
      const error = new Error('429 Too Many Requests');
      const handledError = (
        actor as unknown as { handleApiError: (error: unknown) => Error }
      ).handleApiError(error);

      expect(handledError.name).toBe('RateLimitError');
      expect(handledError.message).toContain('rate limit exceeded');
    });

    it('should handle quota exceeded errors', () => {
      const error = new Error('Quota limit exceeded');
      const handledError = (
        actor as unknown as { handleApiError: (error: unknown) => Error }
      ).handleApiError(error);

      expect(handledError.name).toBe('QuotaExceededError');
      expect(handledError.message).toContain('quota exceeded');
    });

    it('should handle not found errors', () => {
      const error = new Error('204 No Content');
      const handledError = (
        actor as unknown as { handleApiError: (error: unknown) => Error }
      ).handleApiError(error);

      expect(handledError.name).toBe('NotFoundError');
      expect(handledError.message).toContain('Resource not found');
    });

    it('should handle network errors', () => {
      const error = new Error('Network timeout');
      const handledError = (
        actor as unknown as { handleApiError: (error: unknown) => Error }
      ).handleApiError(error);

      expect(handledError.name).toBe('NetworkError');
      expect(handledError.message).toContain('Network connectivity issue');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      const handledError = (
        actor as unknown as { handleApiError: (error: unknown) => Error }
      ).handleApiError(error);

      expect(handledError.name).toBe('ApiError');
      expect(handledError.message).toContain('VirusTotal API error');
    });
  });
});
