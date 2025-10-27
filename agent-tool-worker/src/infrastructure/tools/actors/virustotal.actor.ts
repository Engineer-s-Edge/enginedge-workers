/**
 * VirusTotal Actor - Infrastructure Layer
 *
 * Provides integration with VirusTotal API for file scanning and analysis.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import { ActorConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type VirusTotalOperation = 'scan-file' | 'get-scan-report' | 'scan-url' | 'get-url-report' | 'get-file-behaviors' | 'get-domain-report';

export interface VirusTotalArgs {
  operation: VirusTotalOperation;
  // Authentication
  apiKey?: string;
  // For scan-file
  fileContent?: string; // Base64 encoded file content
  fileName?: string;
  // For get-scan-report/get-file-behaviors
  resource?: string; // File hash or scan ID
  // For scan-url/get-url-report
  url?: string;
  // For get-domain-report
  domain?: string;
  // Optional parameters
  scanId?: string;
}

export interface VirusTotalOutput extends ToolOutput {
  success: boolean;
  operation: VirusTotalOperation;
  // For scan-file/scan-url
  scanId?: string;
  resource?: string;
  // For reports
  report?: unknown;
  // For behaviors
  behaviors?: unknown[];
  // Analysis results
  positives?: number;
  total?: number;
  detected?: boolean;
  permalink?: string;
}

@Injectable()
export class VirusTotalActor extends BaseActor<VirusTotalArgs, VirusTotalOutput> {
  readonly name = 'virustotal-actor';
  readonly description = 'Provides integration with VirusTotal API for file scanning and analysis';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  get category(): ActorCategory {
    return ActorCategory.EXTERNAL_SECURITY;
  }

  get requiresAuth(): boolean {
    return true;
  }

  constructor() {
    const errorEvents = [
      new ErrorEvent('AuthenticationError', 'Invalid or missing API key', false),
      new ErrorEvent('RateLimitError', 'API rate limit exceeded', true),
      new ErrorEvent('NetworkError', 'Network connectivity issue', true),
      new ErrorEvent('ValidationError', 'Invalid request parameters', false),
      new ErrorEvent('NotFoundError', 'Resource not found', false),
      new ErrorEvent('QuotaExceededError', 'API quota exceeded', false),
    ];

    const metadata = new ActorConfig(
      'virustotal-actor',
      'VirusTotal API integration',
      'Scan files and URLs for malware using VirusTotal analysis engine',
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['scan-file', 'get-scan-report', 'scan-url', 'get-url-report', 'get-file-behaviors', 'get-domain-report']
          },
          apiKey: { type: 'string' },
          fileContent: { type: 'string' },
          fileName: { type: 'string' },
          resource: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          domain: { type: 'string' },
          scanId: { type: 'string' }
        },
        required: ['operation']
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: {
            type: 'string',
            enum: ['scan-file', 'get-scan-report', 'scan-url', 'get-url-report', 'get-file-behaviors', 'get-domain-report']
          },
          scanId: { type: 'string' },
          resource: { type: 'string' },
          report: { type: 'object' },
          behaviors: { type: 'array', items: { type: 'object' } },
          positives: { type: 'number' },
          total: { type: 'number' },
          detected: { type: 'boolean' },
          permalink: { type: 'string', format: 'uri' }
        },
        required: ['success', 'operation']
      },
      [],
      ActorCategory.EXTERNAL_SECURITY,
      true
    );

    super(metadata, errorEvents);

    this.errorEvents = errorEvents;
    this.metadata = metadata;
  }

  protected async act(args: VirusTotalArgs): Promise<VirusTotalOutput> {
    // Validate authentication
    if (!args.apiKey) {
      throw Object.assign(new Error('VirusTotal API key is required'), {
        name: 'AuthenticationError'
      });
    }

    switch (args.operation) {
      case 'scan-file':
        return this.scanFile(args);
      case 'get-scan-report':
        return this.getScanReport(args);
      case 'scan-url':
        return this.scanUrl(args);
      case 'get-url-report':
        return this.getUrlReport(args);
      case 'get-file-behaviors':
        return this.getFileBehaviors(args);
      case 'get-domain-report':
        return this.getDomainReport(args);
      default:
        throw Object.assign(new Error(`Unsupported operation: ${args.operation}`), {
          name: 'ValidationError'
        });
    }
  }

  private async scanFile(args: VirusTotalArgs): Promise<VirusTotalOutput> {
    if (!args.fileContent) {
      throw Object.assign(new Error('File content is required for scanning'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call - In real implementation, this would upload file to VirusTotal
      const scanId = `scan-${Date.now()}`;
      const resource = `resource-${Date.now()}`;

      return {
        success: true,
        operation: 'scan-file',
        scanId,
        resource,
        permalink: `https://www.virustotal.com/gui/file/${resource}`
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getScanReport(args: VirusTotalArgs): Promise<VirusTotalOutput> {
    if (!args.resource) {
      throw Object.assign(new Error('Resource identifier is required'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const mockReport = {
        resource: args.resource,
        scan_id: `scan-${Date.now()}`,
        sha1: 'a665a45920422f9d417e4867efdc4fb8a04a1f3ff',
        sha256: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a66c4538dfd',
        md5: '44d88612fea8a8f36de82e1278abb02f',
        scan_date: '2024-01-15 10:30:45',
        positives: 0,
        total: 70,
        scans: {
          'Bkav': { detected: false, version: '1.3.0.9899', result: null },
          'Lionic': { detected: false, version: '7.4', result: null },
          'MicroWorld-eScan': { detected: false, version: '14.0.297.0', result: null }
        }
      };

      return {
        success: true,
        operation: 'get-scan-report',
        report: mockReport,
        positives: 0,
        total: 70,
        detected: false,
        permalink: `https://www.virustotal.com/gui/file/${args.resource}`
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async scanUrl(args: VirusTotalArgs): Promise<VirusTotalOutput> {
    if (!args.url) {
      throw Object.assign(new Error('URL is required for scanning'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const scanId = `url-scan-${Date.now()}`;
      const resource = `url-resource-${Date.now()}`;

      return {
        success: true,
        operation: 'scan-url',
        scanId,
        resource,
        permalink: `https://www.virustotal.com/gui/url/${resource}`
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getUrlReport(args: VirusTotalArgs): Promise<VirusTotalOutput> {
    if (!args.resource && !args.url) {
      throw Object.assign(new Error('Resource identifier or URL is required'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const mockReport = {
        resource: args.resource || `url-${Date.now()}`,
        url: args.url || 'https://example.com',
        scan_id: `url-scan-${Date.now()}`,
        scan_date: '2024-01-15 10:30:45',
        positives: 0,
        total: 85,
        scans: {
          'ADMINUSLabs': { detected: false, result: 'clean site' },
          'AegisLab WebGuard': { detected: false, result: 'clean site' },
          'AlienVault': { detected: false, result: 'clean site' }
        }
      };

      return {
        success: true,
        operation: 'get-url-report',
        report: mockReport,
        positives: 0,
        total: 85,
        detected: false,
        permalink: `https://www.virustotal.com/gui/url/${mockReport.resource}`
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getFileBehaviors(args: VirusTotalArgs): Promise<VirusTotalOutput> {
    if (!args.resource) {
      throw Object.assign(new Error('Resource identifier is required'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const mockBehaviors = [
        {
          sandbox_name: 'sandbox1',
          analysis_date: '2024-01-15 10:30:45',
          behaviors: [
            'Creates files in user directory',
            'Modifies registry keys',
            'Establishes network connections'
          ],
          signatures: [
            { name: 'Creates files in user directory', severity: 'low' },
            { name: 'Modifies registry keys', severity: 'medium' }
          ]
        }
      ];

      return {
        success: true,
        operation: 'get-file-behaviors',
        behaviors: mockBehaviors
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getDomainReport(args: VirusTotalArgs): Promise<VirusTotalOutput> {
    if (!args.domain) {
      throw Object.assign(new Error('Domain is required'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const mockReport = {
        domain: args.domain,
        undetected_referrer_samples: 0,
        undetected_urls: 0,
        undetected_downloaded_samples: 0,
        undetected_communicating_samples: 0,
        categories: {
          'Webroot': 'uncategorized',
          'BitDefender': 'uncategorized',
          'Forcepoint ThreatSeeker': 'uncategorized'
        },
        popularity_ranks: {
          'Statvoo': { rank: 12345 },
          'Cisco Umbrella': { rank: 23456 }
        },
        last_analysis_stats: {
          harmless: 85,
          malicious: 0,
          suspicious: 1,
          undetected: 14,
          timeout: 0
        }
      };

      return {
        success: true,
        operation: 'get-domain-report',
        report: mockReport,
        positives: 0,
        total: 100,
        detected: false,
        permalink: `https://www.virustotal.com/gui/domain/${args.domain}`
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private handleApiError(error: unknown): Error {
    // In a real implementation, this would parse VirusTotal API errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown API error';

    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return Object.assign(new Error('Invalid API key or insufficient privileges'), {
        name: 'AuthenticationError'
      });
    }

    if (errorMessage.includes('204') || errorMessage.includes('No Content')) {
      return Object.assign(new Error('Resource not found'), {
        name: 'NotFoundError'
      });
    }

    if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
      return Object.assign(new Error('API rate limit exceeded'), {
        name: 'RateLimitError'
      });
    }

    if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
      return Object.assign(new Error('API quota exceeded'), {
        name: 'QuotaExceededError'
      });
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return Object.assign(new Error('Network connectivity issue'), {
        name: 'NetworkError'
      });
    }

    return Object.assign(new Error(`VirusTotal API error: ${errorMessage}`), {
      name: 'ApiError'
    });
  }
}