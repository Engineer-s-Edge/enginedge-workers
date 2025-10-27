import { Injectable, Logger } from '@nestjs/common';
import { LoaderRegistryService } from './loader-registry.service';

/**
 * URL Detection Service
 * 
 * Automatically detects the type of URL and selects the appropriate loader
 * Based on URL patterns, domain names, and file extensions
 */
@Injectable()
export class UrlDetectionService {
  private readonly logger = new Logger(UrlDetectionService.name);

  constructor(private readonly loaderRegistry: LoaderRegistryService) {}

  /**
   * Detect the best loader for a given URL
   */
  detectLoader(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();
      const protocol = urlObj.protocol;

      this.logger.debug(`Detecting loader for URL: ${url}`);

      // S3 URLs
      if (protocol === 's3:' || hostname.includes('s3.amazonaws.com')) {
        return 's3';
      }

      // GitHub URLs
      if (hostname === 'github.com' || hostname === 'raw.githubusercontent.com') {
        return 'github';
      }

      // YouTube URLs
      if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
        return 'youtube';
      }

      // Notion URLs
      if (hostname.includes('notion.so') || hostname.includes('notion.site')) {
        return 'notion-api';
      }

      // Sitemap URLs
      if (pathname.includes('sitemap') && pathname.endsWith('.xml')) {
        return 'sitemap';
      }

      // Check for file extensions in URL
      const fileExt = this._extractFileExtension(pathname);
      if (fileExt) {
        // If it's a document file extension, use curl to download
        const documentExts = ['pdf', 'docx', 'csv', 'pptx', 'epub', 'txt'];
        if (documentExts.includes(fileExt)) {
          return 'curl';
        }
      }

      // Search engine URLs
      if (this._isSearchEngineUrl(hostname, urlObj.searchParams)) {
        // Check if user has API keys configured
        if (process.env.TAVILY_API_KEY) {
          return 'tavily';
        } else if (process.env.SERPAPI_API_KEY) {
          return 'serpapi';
        }
      }

      // For most web pages, use Playwright for JavaScript-heavy sites
      // or Cheerio for simpler sites
      if (this._isJavaScriptHeavySite(hostname)) {
        return 'playwright';
      }

      // Default to Cheerio for general web scraping
      return 'cheerio';
    } catch (error) {
      this.logger.warn(`Failed to detect loader for URL: ${url}`);
      return null;
    }
  }

  /**
   * Load a URL with auto-detected loader
   */
  async loadUrl(
    url: string,
    options?: {
      preferredLoader?: string;
      fallbackToDefault?: boolean;
    },
  ): Promise<any[]> {
    let loaderName: string | undefined = options?.preferredLoader;

    if (!loaderName) {
      const detected = this.detectLoader(url);
      loaderName = detected ?? undefined;
    }

    if (!loaderName) {
      if (options?.fallbackToDefault !== false) {
        loaderName = 'cheerio'; // Default fallback
        this.logger.log(`Using default loader (cheerio) for URL: ${url}`);
      } else {
        throw new Error(`Could not detect loader for URL: ${url}`);
      }
    }

    this.logger.log(`Using loader "${loaderName}" for URL: ${url}`);

    const loader = this.loaderRegistry.getLoader(loaderName);
    if (!loader) {
      throw new Error(`Loader not found: ${loaderName}`);
    }

    return loader.load(url);
  }

  /**
   * Detect if a URL is a search engine query
   */
  private _isSearchEngineUrl(hostname: string, searchParams: URLSearchParams): boolean {
    const searchEngines = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com'];
    const hasSearchQuery = searchParams.has('q') || searchParams.has('query');
    
    return searchEngines.some(engine => hostname.includes(engine)) && hasSearchQuery;
  }

  /**
   * Detect if a site is JavaScript-heavy (SPAs, dynamic content)
   */
  private _isJavaScriptHeavySite(hostname: string): boolean {
    // Common SPA frameworks and dynamic sites
    const jsSites = [
      'twitter.com',
      'facebook.com',
      'instagram.com',
      'reddit.com',
      'medium.com',
      'linkedin.com',
      'discord.com',
      'slack.com',
    ];

    return jsSites.some(site => hostname.includes(site));
  }

  /**
   * Extract file extension from pathname
   */
  private _extractFileExtension(pathname: string): string | null {
    const match = pathname.match(/\.([a-z0-9]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Get all supported URL patterns
   */
  getSupportedPatterns(): Array<{ pattern: string; loader: string; description: string }> {
    return [
      { pattern: 's3://*', loader: 's3', description: 'AWS S3 URLs' },
      { pattern: 'https://*.s3.amazonaws.com/*', loader: 's3', description: 'AWS S3 HTTPS URLs' },
      { pattern: 'https://github.com/*', loader: 'github', description: 'GitHub repositories' },
      { pattern: 'https://youtube.com/watch?v=*', loader: 'youtube', description: 'YouTube videos' },
      { pattern: 'https://youtu.be/*', loader: 'youtube', description: 'YouTube short URLs' },
      { pattern: 'https://*.notion.so/*', loader: 'notion-api', description: 'Notion pages' },
      { pattern: 'https://*/sitemap*.xml', loader: 'sitemap', description: 'XML sitemaps' },
      { pattern: 'https://*.pdf', loader: 'curl', description: 'PDF documents' },
      { pattern: 'https://*.docx', loader: 'curl', description: 'Word documents' },
      { pattern: 'https://google.com/search?q=*', loader: 'tavily', description: 'Google search (via Tavily/SerpAPI)' },
      { pattern: 'https://*', loader: 'cheerio', description: 'General web pages (static)' },
      { pattern: 'https://*', loader: 'playwright', description: 'JavaScript-heavy sites' },
    ];
  }

  /**
   * Validate if a URL is supported
   */
  isSupported(url: string): boolean {
    try {
      new URL(url); // Will throw if invalid
      const loader = this.detectLoader(url);
      return loader !== null;
    } catch {
      return false;
    }
  }
}
