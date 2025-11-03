import { Injectable } from '@nestjs/common';
import { WebLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * GitHub Repository Loader Adapter
 * Loads files and content from GitHub repositories
 * Supports loading individual files, directories, or entire repos
 */
@Injectable()
export class GithubLoaderAdapter extends WebLoaderPort {
  readonly name = 'github';
  readonly supportedProtocols = ['https'];

  /**
   * Load content from a GitHub URL
   */
  async loadUrl(
    url: string,
    options?: {
      branch?: string;
      accessToken?: string;
      recursive?: boolean;
      fileExtensions?: string[];
      ignorePaths?: string[];
    },
  ): Promise<Document[]> {
    try {
      const { owner, repo, path, type } = this._parseGithubUrl(url);

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };

      if (options?.accessToken) {
        headers['Authorization'] = `token ${options.accessToken}`;
      }

      const branch = options?.branch || 'main';
      const documents: Document[] = [];

      if (type === 'file') {
        // Load single file
        const doc = await this._loadFile(owner, repo, path, branch, headers);
        if (doc) documents.push(doc);
      } else {
        // Load directory or entire repo
        await this._loadDirectory(
          owner,
          repo,
          path,
          branch,
          headers,
          options?.recursive !== false,
          options?.fileExtensions,
          options?.ignorePaths || [],
          documents,
        );
      }

      return documents;
    } catch (error: any) {
      throw new Error(`Failed to load GitHub content: ${error.message}`);
    }
  }

  /**
   * Load a single file from GitHub
   */
  private async _loadFile(
    owner: string,
    repo: string,
    path: string,
    branch: string,
    headers: Record<string, string>,
  ): Promise<Document | null> {
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await axios.get(apiUrl, { headers });

      if (response.data.type !== 'file') {
        return null;
      }

      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString(
        'utf-8',
      );

      const documentId = `github-${crypto.createHash('md5').update(`${owner}/${repo}/${path}-${Date.now()}`).digest('hex')}`;
      return new Document(documentId, content, {
        source: response.data.html_url,
        sourceType: 'url',
        loader: this.name,
        owner,
        repo,
        path: response.data.path,
        branch,
        fileName: response.data.name,
        size: response.data.size,
        sha: response.data.sha,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.warn(`Failed to load file ${path}: ${error.message}`);
      return null;
    }
  }

  /**
   * Load directory recursively
   */
  private async _loadDirectory(
    owner: string,
    repo: string,
    path: string,
    branch: string,
    headers: Record<string, string>,
    recursive: boolean,
    fileExtensions: string[] | undefined,
    ignorePaths: string[],
    documents: Document[],
  ): Promise<void> {
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await axios.get(apiUrl, { headers });

      const items = Array.isArray(response.data)
        ? response.data
        : [response.data];

      for (const item of items) {
        // Check ignore paths
        if (ignorePaths.some((ignore) => item.path.includes(ignore))) {
          continue;
        }

        if (item.type === 'file') {
          // Check file extensions
          if (fileExtensions && fileExtensions.length > 0) {
            const ext = item.name.split('.').pop()?.toLowerCase();
            if (!ext || !fileExtensions.includes(ext)) {
              continue;
            }
          }

          const doc = await this._loadFile(
            owner,
            repo,
            item.path,
            branch,
            headers,
          );
          if (doc) documents.push(doc);
        } else if (item.type === 'dir' && recursive) {
          await this._loadDirectory(
            owner,
            repo,
            item.path,
            branch,
            headers,
            recursive,
            fileExtensions,
            ignorePaths,
            documents,
          );
        }
      }
    } catch (error: any) {
      console.warn(`Failed to load directory ${path}: ${error.message}`);
    }
  }

  /**
   * Parse GitHub URL to extract owner, repo, and path
   */
  private _parseGithubUrl(url: string): {
    owner: string;
    repo: string;
    path: string;
    type: 'file' | 'dir' | 'repo';
  } {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter((p) => p);

    if (pathParts.length < 2) {
      throw new Error('Invalid GitHub URL: must contain owner and repo');
    }

    const owner = pathParts[0];
    const repo = pathParts[1];

    // Check if it's a file or directory
    if (pathParts[2] === 'blob' || pathParts[2] === 'tree') {
      const type = pathParts[2] === 'blob' ? 'file' : 'dir';
      const path = pathParts.slice(4).join('/'); // Skip owner/repo/blob|tree/branch
      return { owner, repo, path, type };
    }

    // Root repository
    return { owner, repo, path: '', type: 'repo' };
  }

  /**
   * Check if this loader supports the given URL
   */
  canLoad(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'github.com';
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
