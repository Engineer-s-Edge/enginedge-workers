/**
 * HTTP Request Actor Unit Tests
 *
 * Tests for safe HTTP client functionality with security restrictions.
 */

import { HttpRequestActor, HttpRequestArgs, HttpResponseOutput } from '@infrastructure/tools/actors/http-request.actor';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = jest.mocked(axios);

// Mock the default axios function
const mockAxiosResponse = {
  status: 200,
  statusText: 'OK',
  headers: {},
  data: {}
};

beforeEach(() => {
  // Reset mock for each test
  mockedAxios.mockReset();
});

// Helper function to create axios error mocks
const createAxiosError = (message: string, code?: string, response?: unknown) => {
  const error = new Error(message) as Error & { isAxiosError: boolean; code?: string; response?: unknown };
  error.isAxiosError = true;
  if (code) error.code = code;
  if (response !== undefined) error.response = response;
  return error;
};

describe('HttpRequestActor', () => {
  let actor: HttpRequestActor;

  beforeEach(() => {
    actor = new HttpRequestActor();
  });

  describe('Basic Functionality', () => {
    it('should make a successful GET request', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'content-length': '123'
        },
        data: { message: 'success' }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/test'
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as HttpResponseOutput).statusCode).toBe(200);
      expect((result.output as HttpResponseOutput).statusText).toBe('OK');
      expect((result.output as HttpResponseOutput).data).toEqual({ message: 'success' });
      expect((result.output as HttpResponseOutput).contentType).toBe('application/json');
      expect((result.output as HttpResponseOutput).contentLength).toBe(123);
      expect((result.output as HttpResponseOutput).duration).toBeGreaterThanOrEqual(0);
    });

    it('should make a POST request with body', async () => {
      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: { id: 123, created: true }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'POST',
        url: 'https://api.example.com/users',
        body: { name: 'John Doe', email: 'john@example.com' },
        headers: { 'Content-Type': 'application/json' }
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as HttpResponseOutput).statusCode).toBe(201);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' },
        data: { name: 'John Doe', email: 'john@example.com' },
        timeout: 10000,
        maxRedirects: 5,
        maxContentLength: 1024 * 1024,
        validateStatus: expect.any(Function)
      });
    });

    it('should handle query parameters', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { results: [] }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/search',
        params: { q: 'test query', limit: 10 }
      };

      await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { q: 'test query', limit: 10 }
        })
      );
    });

    it('should handle custom timeout', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {}
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/test',
        timeout: 5000
      };

      await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000
        })
      );
    });
  });

  describe('Security', () => {
    it('should block localhost access', async () => {
      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'http://localhost:3000/api'
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('blocked for security reasons');
    });

    it('should block private network access', async () => {
      const privateUrls = [
        'http://192.168.1.1/api',
        'http://10.0.0.1/api',
        'http://172.16.0.1/api'
      ];

      for (const url of privateUrls) {
        const args: HttpRequestArgs = {
          operation: 'request',
          method: 'GET',
          url
        };

        const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('blocked for security reasons');
      }
    });

    it('should block dangerous headers', async () => {
      const dangerousHeaders = ['host', 'authorization', 'cookie'];

      for (const header of dangerousHeaders) {
        const args: HttpRequestArgs = {
          operation: 'request',
          method: 'GET',
          url: 'https://api.example.com/test',
          headers: { [header]: 'value' }
        };

        const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('not allowed');
      }
    });

    it('should only allow HTTP and HTTPS protocols', async () => {
      const invalidUrls = [
        'ftp://example.com/file',
        'file:///etc/passwd',
        'ws://example.com/socket'
      ];

      for (const url of invalidUrls) {
        const args: HttpRequestArgs = {
          operation: 'request',
          method: 'GET',
          url
        };

        const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });
        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Only HTTP and HTTPS protocols are allowed');
      }
    });

    it('should validate URL format', async () => {
      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'not-a-valid-url'
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid URL format');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
      const mockErrorResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/json' },
        data: { error: 'Resource not found' }
      };

      const axiosError = createAxiosError('Request failed', undefined, mockErrorResponse);
      mockedAxios.mockRejectedValueOnce(axiosError);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/missing'
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true); // Tool succeeded in making the request
      expect((result.output as HttpResponseOutput).success).toBe(false); // HTTP request failed
      expect((result.output as HttpResponseOutput).statusCode).toBe(404);
      expect((result.output as HttpResponseOutput).statusText).toBe('Not Found');
      expect((result.output as HttpResponseOutput).data).toEqual({ error: 'Resource not found' });
    });

    it('should handle network errors', async () => {
      const networkError = createAxiosError('Network Error', 'ENOTFOUND');
      mockedAxios.mockRejectedValueOnce(networkError);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://nonexistent-domain-12345.com/api'
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('HTTP request failed');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = createAxiosError('Timeout', 'ECONNABORTED');
      mockedAxios.mockImplementationOnce(() => Promise.reject(timeoutError));

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/slow-endpoint',
        timeout: 1000
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });    
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('HTTP request failed');
    });
  });

  describe('Configuration', () => {
    it('should disable redirects when specified', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {}
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/test',
        followRedirects: false
      };

      await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRedirects: 0
        })
      );
    });

    it('should respect max content length', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {}
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/test',
        maxContentLength: 2048
      };

      await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          maxContentLength: 2048
        })
      );
    });

    it('should validate request body size', async () => {
      const largeBody = { data: 'x'.repeat(1024 * 1024) }; // 1MB+ body

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'POST',
        url: 'https://api.example.com/test',
        body: largeBody
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Request body too large');
    });
  });

  describe('Header Normalization', () => {
    it('should normalize header names to lowercase', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value',
          'AUTHORIZATION': 'Bearer token'
        },
        data: {}
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/test'
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      const headers = (result.output as HttpResponseOutput).headers;
      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-custom-header']).toBe('value');
      expect(headers['authorization']).toBe('Bearer token');
    });

    it('should handle array headers', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'set-cookie': ['session=abc123', 'theme=dark']
        },
        data: {}
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const args: HttpRequestArgs = {
        operation: 'request',
        method: 'GET',
        url: 'https://api.example.com/test'
      };

      const result = await actor.execute({ name: 'http-request-actor', args: args as unknown as Record<string, unknown> });

      const headers = (result.output as HttpResponseOutput).headers;
      expect(headers['set-cookie']).toBe('session=abc123, theme=dark');
    });
  });
});