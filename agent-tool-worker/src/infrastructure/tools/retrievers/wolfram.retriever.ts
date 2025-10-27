/**
 * Wolfram Retriever - Infrastructure Layer
 *
 * Sends Wolfram Alpha computation requests to the Wolfram worker node via Kafka.
 * Acts as a proxy to the dedicated Wolfram computation service.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import { RetrieverConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, RAGConfig, RetrievalType } from '@domain/entities/tool.entities';
import axios, { AxiosResponse } from 'axios';

export interface WolframArgs {
  query: string;
  format?: 'plaintext' | 'image' | 'mathml' | 'json';
  timeout?: number;
  assumptions?: string[];
  [key: string]: unknown; // Index signature for compatibility
}

export interface WolframOutput extends ToolOutput {
  success: boolean;
  query: string;
  result?: string;
  pods?: Array<{
    title: string;
    content: string;
    position: number;
    scanner: string;
    id: string;
    subpods?: Array<{
      title?: string;
      content: string;
      img?: string;
      plaintext?: string;
    }>;
  }>;
  assumptions?: Array<{
    type: string;
    word: string;
    template: string;
    count: number;
  }>;
  sources?: Array<{
    url: string;
    title: string;
  }>;
  processingTime?: number;
  message?: string;
}

@Injectable()
export class WolframRetriever extends BaseRetriever<WolframArgs, WolframOutput> {
  readonly name = 'wolfram-retriever';
  readonly description = 'Query Wolfram Alpha computational knowledge engine via Wolfram worker';

  readonly metadata: RetrieverConfig;

  readonly errorEvents: ErrorEvent[];

  constructor() {
    const errorEvents = [
      new ErrorEvent('wolfram-query-failed', 'Wolfram Alpha query failed - check query syntax and try again', false),
      new ErrorEvent('wolfram-timeout', 'Wolfram Alpha request timed out - consider simplifying the query', true),
      new ErrorEvent('wolfram-service-unavailable', 'Wolfram Alpha service is unavailable - check service status', false)
    ];

    const metadata = new RetrieverConfig(
      'wolfram-retriever',
      'Query Wolfram Alpha computational knowledge engine',
      'Perform mathematical computations, symbolic algebra, calculus, and scientific calculations',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The computational query to send to Wolfram Alpha'
          },
          format: {
            type: 'string',
            enum: ['plaintext', 'image', 'mathml', 'json'],
            description: 'Output format preference',
            default: 'plaintext'
          },
          timeout: {
            type: 'number',
            description: 'Request timeout in milliseconds',
            default: 30000,
            minimum: 5000,
            maximum: 120000
          },
          assumptions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Assumptions to guide the computation'
          }
        }
      },
      {
        type: 'object',
        required: ['success', 'query'],
        properties: {
          success: { type: 'boolean' },
          query: { type: 'string' },
          result: { type: 'string' },
          pods: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                position: { type: 'number' },
                scanner: { type: 'string' },
                id: { type: 'string' },
                subpods: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      content: { type: 'string' },
                      img: { type: 'string' },
                      plaintext: { type: 'string' }
                    }
                  }
                }
              }
            }
          },
          assumptions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                word: { type: 'string' },
                template: { type: 'string' },
                count: { type: 'number' }
              }
            }
          },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                title: { type: 'string' }
              }
            }
          },
          processingTime: { type: 'number' },
          message: { type: 'string' }
        }
      },
      [
        {
          name: 'wolfram-retriever',
          args: { query: 'solve x^2 + 2x + 1 = 0' }
        },
        {
          name: 'wolfram-retriever',
          args: { query: 'integrate sin(x) dx', timeout: 10000 }
        }
      ],
      RetrievalType.COMPUTATION,
      false, // caching disabled for computational results
      {
        similarity: 0.0,
        topK: 1,
        includeMetadata: true
      }
    );

    super(metadata, errorEvents);

    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get retrievalType(): string {
    return 'mathematical-computation';
  }

  get caching(): boolean {
    return false; // Wolfram computations are typically not cached due to computational cost
  }

  protected async retrieve(args: WolframArgs & { ragConfig: RAGConfig }): Promise<WolframOutput> {
    const { query, format = 'plaintext', timeout = 30000, assumptions = [] } = args;

    // Validate required parameters
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw Object.assign(new Error('Query parameter is required and must be a non-empty string'), {
        name: 'ValidationError'
      });
    }

    // Validate format
    const validFormats = ['plaintext', 'image', 'mathml', 'json'];
    if (!validFormats.includes(format)) {
      throw Object.assign(new Error(`Invalid format. Must be one of: ${validFormats.join(', ')}`), {
        name: 'ValidationError'
      });
    }

    // Send request to Wolfram worker via Kafka
    return await this.sendWolframRequest({
      query: query.trim(),
      format,
      timeout,
      assumptions
    });
  }

  private async sendWolframRequest(request: {
    query: string;
    format: string;
    timeout: number;
    assumptions: string[];
  }): Promise<WolframOutput> {
    const startTime = Date.now();

    try {
      // Make HTTP call to enginedge-local-kernel
      const response: AxiosResponse = await axios.post('http://enginedge-local-kernel:5001/compute', {
        code: request.query
      }, {
        timeout: request.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const processingTime = Date.now() - startTime;

      if (response.data.success) {
        return {
          success: true,
          query: request.query,
          result: response.data.result,
          processingTime
        };
      } else {
        return {
          success: false,
          query: request.query,
          message: response.data.error || 'Computation failed',
          processingTime
        };
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const axiosError = error as {
        code?: string;
        response?: { status?: number; data?: { error?: string } };
        message?: string
      };

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        throw Object.assign(new Error('Wolfram service is not available'), {
          name: 'ServiceUnavailableError'
        });
      }

      if (axiosError.response?.status === 408 || axiosError.code === 'ETIMEDOUT') {
        throw Object.assign(new Error('Wolfram computation timed out'), {
          name: 'TimeoutError'
        });
      }

      const errorMessage = axiosError.response?.data?.error || axiosError.message || 'Unknown error';
      throw Object.assign(new Error(`Wolfram computation failed: ${errorMessage}`), {
        name: 'WolframError'
      });
    }
  }

  private generateMockWolframResponse(request: {
    query: string;
    format: string;
    timeout: number;
    assumptions: string[];
  }): WolframOutput {
    // Mock Wolfram Alpha response based on query type
    const query = request.query.toLowerCase();

    let result: string;
    let pods: WolframOutput['pods'] = [];

    if (query.includes('solve') || query.includes('equation')) {
      result = 'x = 5';
      pods = [
        {
          title: 'Solutions',
          content: 'x = 5',
          position: 1,
          scanner: 'Solve',
          id: 'Solution',
          subpods: [
            {
              title: 'Solution',
              content: 'x = 5',
              plaintext: 'x = 5'
            }
          ]
        }
      ];
    } else if (query.includes('integral') || query.includes('integrate') || query.includes('derivative') || query.includes('differentiate')) {
      result = '\\int x^2 dx = \\frac{x^3}{3} + C';
      pods = [
        {
          title: 'Indefinite integral',
          content: '\\int x^2 dx = \\frac{x^3}{3} + C',
          position: 1,
          scanner: 'Integral',
          id: 'IndefiniteIntegral',
          subpods: [
            {
              title: 'Result',
              content: '\\int x^2 dx = \\frac{x^3}{3} + C',
              plaintext: 'integral x^2 dx = x^3/3 + constant'
            }
          ]
        }
      ];
    } else if (query.includes('plot') || query.includes('graph')) {
      result = 'Plot generated successfully';
      pods = [
        {
          title: 'Plot',
          content: 'Function plot for the given expression',
          position: 1,
          scanner: 'Plot',
          id: 'Plot',
          subpods: [
            {
              title: 'Plot',
              content: 'Plot image would be here',
              img: 'data:image/png;base64,mock_plot_data'
            }
          ]
        }
      ];
    } else {
      // General computational query
      result = '42';
      pods = [
        {
          title: 'Result',
          content: '42',
          position: 1,
          scanner: 'Numeric',
          id: 'Result',
          subpods: [
            {
              title: 'Decimal approximation',
              content: '42.',
              plaintext: '42'
            }
          ]
        }
      ];
    }

    return {
      success: true,
      query: request.query,
      result,
      pods,
      assumptions: request.assumptions.length > 0 ? [
        {
          type: 'Clash',
          word: 'assuming',
          template: 'Assuming ${desc1}. Use ${desc2} instead.',
          count: 1
        }
      ] : undefined,
      sources: [
        {
          url: 'https://www.wolframalpha.com/',
          title: 'Wolfram|Alpha'
        }
      ]
    };
  }
}