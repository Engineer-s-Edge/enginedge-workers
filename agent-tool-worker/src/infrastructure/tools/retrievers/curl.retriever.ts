/**
 * Curl Retriever - Infrastructure Layer
 *
 * Makes HTTP requests to external APIs and web services.
 * Provides a flexible interface for GET, POST, PUT, DELETE operations.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import {
  RetrieverConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import {
  ToolOutput,
  RAGConfig,
  RetrievalType,
} from '@domain/entities/tool.entities';
import axios, { AxiosResponse, Method } from 'axios';

export interface CurlArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  params?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
  verifySSL?: boolean;
  [key: string]: unknown; // Index signature for compatibility
}

export interface CurlOutput extends ToolOutput {
  success: boolean;
  url: string;
  method: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  responseTime?: number;
  contentType?: string;
  contentLength?: number;
  processingTime?: number;
  message?: string;
}

@Injectable()
export class CurlRetriever extends BaseRetriever<CurlArgs, CurlOutput> {
  readonly name = 'curl-retriever';
  readonly description =
    'Make HTTP requests to external APIs and web services with full control over headers, methods, and request body';
  readonly retrievalType: RetrievalType = RetrievalType.API_DATA;
  readonly caching = false;

  readonly inputSchema = {
    type: 'object',
    required: ['url'],
    properties: {
      url: {
        type: 'string',
        description: 'The URL to make the request to',
        format: 'uri',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        description: 'HTTP method to use',
        default: 'GET',
      },
      headers: {
        type: 'object',
        description: 'HTTP headers to include in the request',
        additionalProperties: { type: 'string' },
      },
      body: {
        description: 'Request body (string or object for JSON)',
      },
      params: {
        type: 'object',
        description: 'Query parameters to append to the URL',
        additionalProperties: { type: 'string' },
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        minimum: 1000,
        maximum: 300000,
        default: 30000,
      },
      followRedirects: {
        type: 'boolean',
        description: 'Whether to follow HTTP redirects',
        default: true,
      },
      verifySSL: {
        type: 'boolean',
        description: 'Whether to verify SSL certificates',
        default: true,
      },
    },
  };

  readonly outputSchema = {
    type: 'object',
    required: [
      'success',
      'url',
      'method',
      'statusCode',
      'statusText',
      'headers',
    ],
    properties: {
      success: { type: 'boolean' },
      url: { type: 'string' },
      method: { type: 'string' },
      statusCode: { type: 'number' },
      statusText: { type: 'string' },
      headers: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      body: { type: 'string' },
      responseTime: { type: 'number' },
      contentType: { type: 'string' },
      contentLength: { type: 'number' },
      processingTime: { type: 'number' },
      message: { type: 'string' },
    },
  };

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'HTTP client for making API requests and web service calls',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {},
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent('curl-request-failed', 'HTTP request failed', true),
    new ErrorEvent('curl-timeout', 'Request timed out', true),
    new ErrorEvent('curl-invalid-url', 'Invalid URL provided', false),
    new ErrorEvent('curl-network-error', 'Network connectivity issue', true),
  ];

  protected async retrieve(
    args: CurlArgs & { ragConfig: RAGConfig },
  ): Promise<CurlOutput> {
    // Validate input
    this.validateInput(args);

    const {
      url,
      method = 'GET',
      headers = {},
      body,
      params,
      timeout = 30000,
      followRedirects = true,
      verifySSL = true,
    } = args;

    // Validate URL
    try {
      new URL(url);
    } catch {
      throw Object.assign(new Error('Invalid URL format'), {
        name: 'ValidationError',
      });
    }

    // Send HTTP request
    return await this.sendHttpRequest({
      url,
      method,
      headers,
      body,
      params,
      timeout,
      followRedirects,
      verifySSL,
    });
  }

  private async sendHttpRequest(request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string | Record<string, unknown>;
    params?: Record<string, string>;
    timeout: number;
    followRedirects: boolean;
    verifySSL: boolean;
  }): Promise<CurlOutput> {
    const startTime = Date.now();

    try {
      // Prepare axios config
      const axiosConfig = {
        method: request.method as Method,
        url: request.url,
        headers: {
          'User-Agent': 'CurlRetriever/1.0',
          ...request.headers,
        },
        params: request.params,
        timeout: request.timeout,
        maxRedirects: request.followRedirects ? 5 : 0,
        httpsAgent: request.verifySSL
          ? undefined
          : ({ rejectUnauthorized: false } as any),
        validateStatus: () => true, // Don't throw on any status code
      } as any;

      // Add body for non-GET methods
      if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        if (typeof request.body === 'string') {
          axiosConfig.data = request.body;
        } else {
          axiosConfig.data = JSON.stringify(request.body);
          axiosConfig.headers['Content-Type'] = 'application/json';
        }
      }

      const response: AxiosResponse = await axios(axiosConfig);
      const processingTime = Date.now() - startTime;

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      Object.entries(response.headers).forEach(([key, value]) => {
        responseHeaders[key] = Array.isArray(value)
          ? value.join(', ')
          : String(value);
      });

      return {
        success: true,
        url: request.url,
        method: request.method,
        statusCode: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body:
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data),
        responseTime: response.headers['request-duration']
          ? parseInt(response.headers['request-duration'])
          : undefined,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length']
          ? parseInt(response.headers['content-length'])
          : undefined,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const axiosError = error as {
        code?: string;
        response?: {
          status?: number;
          statusText?: string;
          headers?: Record<string, string>;
          data?: unknown;
        };
        message?: string;
      };

      if (
        axiosError.code === 'ECONNREFUSED' ||
        axiosError.code === 'ENOTFOUND'
      ) {
        throw Object.assign(new Error('Network connectivity issue'), {
          name: 'NetworkError',
        });
      }

      if (axiosError.code === 'ETIMEDOUT') {
        throw Object.assign(new Error('Request timed out'), {
          name: 'TimeoutError',
        });
      }

      // If we have a response, return it as a successful result
      if (axiosError.response) {
        const responseHeaders: Record<string, string> = {};
        Object.entries(axiosError.response.headers || {}).forEach(
          ([key, value]) => {
            responseHeaders[key] = Array.isArray(value)
              ? value.join(', ')
              : String(value);
          },
        );

        return {
          success: true,
          url: request.url,
          method: request.method,
          statusCode: axiosError.response.status || 0,
          statusText: axiosError.response.statusText || 'Unknown',
          headers: responseHeaders,
          body:
            typeof axiosError.response.data === 'string'
              ? axiosError.response.data
              : JSON.stringify(axiosError.response.data || ''),
          contentType: axiosError.response.headers?.['content-type'],
          contentLength: axiosError.response.headers?.['content-length']
            ? parseInt(axiosError.response.headers['content-length'])
            : undefined,
          processingTime,
        };
      }

      const errorMessage = axiosError.message || 'Unknown error';
      throw Object.assign(new Error(`HTTP request failed: ${errorMessage}`), {
        name: 'HttpError',
      });
    }
  }
}
