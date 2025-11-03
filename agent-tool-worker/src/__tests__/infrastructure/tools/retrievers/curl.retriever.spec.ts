/**
 * Curl Retriever - Unit Tests
 *
 * Tests the Curl retriever implementation for HTTP requests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  CurlRetriever,
  CurlArgs,
} from '@infrastructure/tools/retrievers/curl.retriever';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

describe('CurlRetriever', () => {
  let retriever: CurlRetriever;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurlRetriever],
    }).compile();

    retriever = module.get<CurlRetriever>(CurlRetriever);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('curl-retriever');
      expect(retriever.description).toContain('HTTP requests');
    });

    it('should have metadata configured', () => {
      expect(retriever.metadata).toBeDefined();
      expect(retriever.metadata.name).toBe('curl-retriever');
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
    it('should reject invalid URL', async () => {
      const args: CurlArgs = {
        url: 'not-a-valid-url',
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Invalid URL format');
    });

    it('should accept valid HTTP URL', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
      });

      const args: CurlArgs = {
        url: 'http://httpbin.org/get',
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should accept valid HTTPS URL', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/get',
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });

  describe('HTTP Methods', () => {
    it('should handle GET request', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/get',
        method: 'GET',
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(200);
    });

    it('should handle POST request', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: { message: 'created' },
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: { test: 'data' },
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(201);
    });

    it('should handle PUT request (will return 405 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 405,
        statusText: 'Method Not Allowed',
        headers: { 'content-type': 'text/html' },
        data: '<html>Method not allowed</html>',
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/put',
        method: 'PUT',
        body: 'test data',
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(405);
    });

    it('should handle DELETE request (will return 405 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 405,
        statusText: 'Method Not Allowed',
        headers: { 'content-type': 'text/html' },
        data: '<html>Method not allowed</html>',
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/delete',
        method: 'DELETE',
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(405);
    });
  });

  describe('Headers and Parameters', () => {
    it('should handle custom headers (will return 401 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'content-type': 'text/html' },
        data: '<html>Unauthorized</html>',
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/get',
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(401);
    });

    it('should handle query parameters (will return 400 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'text/html' },
        data: '<html>Bad Request</html>',
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/get',
        params: {
          param1: 'value1',
          param2: 'value2',
        },
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(400);
    });
  });

  describe('Request Body', () => {
    it('should handle JSON body (will return 400 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'text/html' },
        data: '<html>Bad Request</html>',
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(400);
    });

    it('should handle string body (will return 400 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'text/html' },
        data: '<html>Bad Request</html>',
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: '<xml><data>test</data></xml>',
        headers: { 'Content-Type': 'application/xml' },
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(400);
    });
  });

  describe('Configuration Options', () => {
    it('should handle custom timeout (will return 200 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'delayed response' },
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/delay/1',
        timeout: 5000,
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(200);
    });

    it('should handle redirect settings (will return 200 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'redirected' },
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/redirect/1',
        followRedirects: true,
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(200);
    });

    it('should handle SSL verification settings (will return 200 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/get',
        verifySSL: true,
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(200);
    });
  });

  describe('RAG Configuration', () => {
    it('should handle RAG configuration parameters (will return 200 status)', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/get',
      };

      const ragConfig = {
        similarity: 0.8,
        topK: 50,
        includeMetadata: false,
      };

      const result = await retriever.execute({
        name: 'curl-retriever',
        args: { ...args, ragConfig },
      });
      expect(result.success).toBe(true);
      expect(result.output!.statusCode).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle network connectivity issues', async () => {
      mockedAxios.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: CurlArgs = {
        url: 'http://non-existent-domain-12345.com',
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Network connectivity issue');
    });

    it('should handle timeout errors', async () => {
      mockedAxios.mockRejectedValueOnce({
        code: 'ETIMEDOUT',
        message: 'Timeout occurred',
      });

      const args: CurlArgs = {
        url: 'https://httpbin.org/delay/10',
        timeout: 1000,
      };

      const result = await retriever.execute({ name: 'curl-retriever', args });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Request timed out');
    });
  });
});
