/**
 * Tool Cache Adapter
 *
 * Implements in-memory caching for tool results.
 */

import { Injectable } from '@nestjs/common';
import { IToolCache } from '../../domain/ports/tool.ports';
import { ToolResult } from '../../domain/entities/tool.entities';

interface CacheEntry {
  result: ToolResult;
  expiresAt: number;
}

@Injectable()
export class ToolCache implements IToolCache {
  private cache = new Map<string, CacheEntry>();

  /**
   * Retrieve a cached tool result
   */
  async get(key: string): Promise<ToolResult | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Store a tool result in cache
   */
  async set(
    key: string,
    result: ToolResult,
    ttl: number = 3600000,
  ): Promise<void> {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { result, expiresAt });
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}
