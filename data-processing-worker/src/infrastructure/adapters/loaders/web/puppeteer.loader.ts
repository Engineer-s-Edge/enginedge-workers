import { Injectable, Logger } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';

/**
 * Puppeteer Web Loader Adapter
 * Uses Puppeteer for advanced browser automation and web scraping
 * Similar to Playwright but with Chromium-only support
 *
 * Note: Currently a placeholder - requires puppeteer package
 * Install with: npm install puppeteer
 */
@Injectable()
export class PuppeteerWebLoaderAdapter extends WebLoaderPort {
  readonly name = 'puppeteer';
  readonly supportedProtocols = ['http', 'https'];
  private readonly logger = new Logger(PuppeteerWebLoaderAdapter.name);

  /**
   * Load content from a URL using Puppeteer
   */
  async loadUrl(
    url: string,
    options?: {
      waitForSelector?: string;
      waitForTimeout?: number;
      screenshot?: boolean;
      pdf?: boolean;
      executeScript?: string;
    },
  ): Promise<Document[]> {
    try {
      // Try to use Puppeteer if available
      let puppeteer: any;
      try {
        puppeteer = require('puppeteer');
      } catch (requireError) {
        this.logger.warn(
          'Puppeteer not available, falling back to simple HTTP fetch',
        );
        return this.loadViaHttp(url, options);
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        if (options?.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, {
            timeout: options.waitForTimeout || 10000,
          });
        }

        if (options?.waitForTimeout) {
          await page.waitForTimeout(options.waitForTimeout);
        }

        if (options?.executeScript) {
          await page.evaluate(options.executeScript);
        }

        const content = await page.content();
        const title = await page.title();

        let screenshot: string | undefined;
        if (options?.screenshot) {
          const buffer = await page.screenshot({ fullPage: true });
          screenshot = buffer.toString('base64');
        }

        let pdfData: string | undefined;
        if (options?.pdf) {
          const buffer = await page.pdf({ format: 'A4' });
          pdfData = buffer.toString('base64');
        }

        await browser.close();

        const document = new Document(
          `puppeteer-${url}`.replace(/[^a-zA-Z0-9-]/g, '-'),
          content,
          {
            source: url,
            loader: this.name,
            title,
            screenshot,
            pdf: pdfData,
            timestamp: new Date().toISOString(),
          },
        );

        return [document];
      } catch (error) {
        await browser.close();
        throw error;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to load URL with Puppeteer: ${error.message}`,
      );
      // Fallback to HTTP
      try {
        return this.loadViaHttp(url, options);
      } catch (httpError: any) {
        throw new Error(
          `Failed to load URL with Puppeteer: ${error.message}. HTTP fallback also failed: ${httpError.message}`,
        );
      }
    }
  }

  /**
   * Fallback: Load URL via simple HTTP fetch
   */
  private async loadViaHttp(
    url: string,
    options?: {
      waitForSelector?: string;
      waitForTimeout?: number;
      screenshot?: boolean;
      pdf?: boolean;
      executeScript?: string;
    },
  ): Promise<Document[]> {
    this.logger.log(`Loading URL via HTTP fallback: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `HTTP request failed: ${response.status} ${response.statusText}`,
      );
    }

    const content = await response.text();

    return [
      new Document(
        `http-${url}`.replace(/[^a-zA-Z0-9-]/g, '-'),
        content,
        {
          source: url,
          loader: this.name,
          contentType: response.headers.get('content-type') || undefined,
          timestamp: new Date().toISOString(),
          note: 'Loaded via HTTP fallback (Puppeteer not available)',
        },
      ),
    ];
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.supportedProtocols.includes(urlObj.protocol.replace(':', ''));
    } catch {
      return false;
    }
  }

  supports(source: string | Blob): boolean {
    if (typeof source !== 'string') return false;
    try {
      const url = new URL(source);
      return (
        this.supportedProtocols?.includes(url.protocol.replace(':', '')) ??
        ['http', 'https'].includes(url.protocol.replace(':', ''))
      );
    } catch {
      return false;
    }
  }

  getSupportedTypes(): string[] {
    return this.supportedProtocols ?? ['http', 'https'];
  }
}
