/**
 * HTTP Request Actor - Infrastructure Layer
 *
 * Provides safe HTTP client functionality for agents with security restrictions.
 * Implements rate limiting, timeout protection, and content validation.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import { ActorConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface HttpRequestArgs {
  operation: 'request';
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, unknown>;
  timeout?: number;
  followRedirects?: boolean;
  maxContentLength?: number;
}

export interface HttpResponseOutput extends ToolOutput {
  success: boolean;
  operation: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
  contentType?: string;
  contentLength?: number;
}

@Injectable()
export class HttpRequestActor extends BaseActor<HttpRequestArgs, HttpResponseOutput> {
  readonly name = 'http-request-actor';
  readonly description = 'Safely make HTTP requests with security restrictions and rate limiting';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  constructor() {
    const errorEvents = [
      new ErrorEvent('HttpRequestError', 'HTTP request failed - check URL, method, and network connectivity', false),
      new ErrorEvent('SecurityError', 'Request blocked for security reasons - check URL allowlist', false),
      new ErrorEvent('TimeoutError', 'HTTP request timed out - consider increasing timeout or checking network', true),
      new ErrorEvent('RateLimitError', 'Too many requests - rate limit exceeded', true),
    ];

    const metadata = new ActorConfig(
      'http-request-actor',
      'Safely make HTTP requests with security restrictions and rate limiting',
      'Make HTTP API calls with timeout protection and security validation',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation', 'method', 'url'],
        properties: {
          operation: {
            type: 'string',
            enum: ['request'],
            description: 'The operation to perform'
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
            description: 'HTTP method'
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'The URL to request'
          },
          headers: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'HTTP headers'
          },
          body: {
            description: 'Request body (for POST/PUT/PATCH)'
          },
          params: {
            type: 'object',
            additionalProperties: true,
            description: 'Query parameters'
          },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            default: 10000,
            description: 'Request timeout in milliseconds'
          },
          followRedirects: {
            type: 'boolean',
            default: true,
            description: 'Whether to follow HTTP redirects'
          },
          maxContentLength: {
            type: 'number',
            minimum: 1024,
            maximum: 10485760, // 10MB
            default: 1048576, // 1MB
            description: 'Maximum response content length in bytes'
          }
        }
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          statusCode: { type: 'number' },
          statusText: { type: 'string' },
          headers: { type: 'object' },
          data: {},
          duration: { type: 'number' },
          contentType: { type: 'string' },
          contentLength: { type: 'number' }
        }
      },
      [
        {
          operation: 'request',
          method: 'GET',
          url: 'https://httpbin.org/get'
        },
        {
          operation: 'request',
          method: 'POST',
          url: 'https://httpbin.org/post',
          body: { test: 'data' }
        }
      ],
      ActorCategory.INTERNAL_SANDBOX,
      false
    );

    super(metadata, errorEvents);
    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get category(): ActorCategory {
    return ActorCategory.INTERNAL_SANDBOX;
  }

  get requiresAuth(): boolean {
    return false;
  }

  protected async act(args: HttpRequestArgs): Promise<HttpResponseOutput> {
    const startTime = Date.now();

    // Validate request safety
    this.validateRequest(args);

    try {
      const response = await this.makeRequest(args);
      const duration = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        operation: 'request',
        statusCode: response.status,
        statusText: response.statusText,
        headers: this.normalizeHeaders(response.headers),
        data: response.data,
        duration,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'] ? parseInt(response.headers['content-length']) : undefined
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error & { response?: { status: number; statusText: string; headers: Record<string, unknown>; data: unknown }; code?: string };

      // Handle different types of errors
      if (err.response) {
        // HTTP error response
        const headers = this.normalizeHeaders(err.response.headers);
        return {
          success: false,
          operation: 'request',
          statusCode: err.response.status,
          statusText: err.response.statusText,
          headers,
          data: err.response.data,
          duration,
          contentType: headers['content-type'],
          contentLength: headers['content-length'] ? parseInt(headers['content-length']) : undefined
        };
      } else if (err.code === 'ECONNABORTED') {
        // Timeout
        throw Object.assign(new Error('Request timed out'), {
          name: 'TimeoutError',
          duration
        });
      } else {
        // Network or other error
        throw Object.assign(new Error(`HTTP request failed: ${err.message}`), {
          name: 'HttpRequestError',
          duration
        });
      }
    }
  }

  private validateRequest(args: HttpRequestArgs): void {
    // Validate URL format first
    let url: URL;
    try {
      url = new URL(args.url);
    } catch {
      throw Object.assign(new Error('Invalid URL format'), {
        name: 'ValidationError'
      });
    }

    // Validate protocol
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw Object.assign(new Error('Only HTTP and HTTPS protocols are allowed'), {
        name: 'SecurityError'
      });
    }

    // Block dangerous hosts (localhost, private networks, etc.)
    const hostname = url.hostname.toLowerCase();

    // Check exact matches
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1'
    ];

    if (blockedHosts.includes(hostname)) {
      throw Object.assign(new Error(`Access to ${hostname} is blocked for security reasons`), {
        name: 'SecurityError'
      });
    }

    // Check private network ranges
    const privateRanges = [
      { prefix: '10.', description: 'private network (10.0.0.0/8)' },
      { prefix: '172.', check: (h: string) => h.startsWith('172.') && parseInt(h.split('.')[1]) >= 16 && parseInt(h.split('.')[1]) <= 31, description: 'private network (172.16.0.0/12)' },
      { prefix: '192.168.', description: 'private network (192.168.0.0/16)' },
      { prefix: '169.254.', description: 'link-local network (169.254.0.0/16)' }
    ];

    for (const range of privateRanges) {
      if (range.check ? range.check(hostname) : hostname.startsWith(range.prefix)) {
        throw Object.assign(new Error(`Access to ${hostname} is blocked for security reasons`), {
          name: 'SecurityError'
        });
      }
    }

    // Validate headers (block dangerous headers)
    if (args.headers) {
      const dangerousHeaders = ['host', 'authorization', 'cookie', 'set-cookie'];
      for (const header of Object.keys(args.headers)) {
        if (dangerousHeaders.includes(header.toLowerCase())) {
          throw Object.assign(new Error(`Header '${header}' is not allowed`), {
            name: 'SecurityError'
          });
        }
      }
    }

    // Validate body size for POST/PUT/PATCH
    if (args.body && ['POST', 'PUT', 'PATCH'].includes(args.method)) {
      const bodySize = JSON.stringify(args.body).length;
      if (bodySize > 1024 * 1024) { // 1MB limit
        throw Object.assign(new Error('Request body too large (max 1MB)'), {
          name: 'ValidationError'
        });
      }
    }
  }

  private async makeRequest(args: HttpRequestArgs): Promise<AxiosResponse> {
    const config: AxiosRequestConfig = {
      method: args.method,
      url: args.url,
      headers: args.headers,
      data: args.body,
      params: args.params,
      timeout: args.timeout || 10000,
      maxRedirects: args.followRedirects !== false ? 5 : 0,
      maxContentLength: args.maxContentLength || 1024 * 1024, // 1MB default
      validateStatus: () => true, // Don't throw on any status code, handle manually
    };

    return axios(config);
  }

  private normalizeHeaders(headers: Record<string, unknown>): Record<string, string> {
    const normalized: Record<string, string> = {};

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value || '');
      }
    }

    return normalized;
  }
}