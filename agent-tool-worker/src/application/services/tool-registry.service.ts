/**
 * ToolRegistry Service - Application Layer
 *
 * Manages registration and discovery of all tools in the system.
 * Provides query capabilities by name, category, and capability.
 */

import { Injectable } from '@nestjs/common';
import { ITool, IActor, IRetriever } from '@domain/ports/tool.ports';

export interface ToolInfo {
  name: string;
  description: string;
  type: 'actor' | 'retriever';
  category?: string;
  retrievalType?: string;
  requiresAuth?: boolean;
  caching?: boolean;
}

@Injectable()
export class ToolRegistry {
  private readonly tools = new Map<string, ITool>();
  private readonly actors = new Map<string, IActor>();
  private readonly retrievers = new Map<string, IRetriever>();

  /**
   * Register a tool in the registry
   */
  registerTool(tool: ITool): void {
    this.tools.set(tool.name, tool);

    if (tool.type === 'actor') {
      this.actors.set(tool.name, tool as IActor);
    } else if (tool.type === 'retriever') {
      this.retrievers.set(tool.name, tool as IRetriever);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get an actor by name
   */
  getActor(name: string): IActor | undefined {
    return this.actors.get(name);
  }

  /**
   * Get a retriever by name
   */
  getRetriever(name: string): IRetriever | undefined {
    return this.retrievers.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all registered actors
   */
  getAllActors(): IActor[] {
    return Array.from(this.actors.values());
  }

  /**
   * Get all registered retrievers
   */
  getAllRetrievers(): IRetriever[] {
    return Array.from(this.retrievers.values());
  }

  /**
   * Get tools by category (for actors)
   */
  getActorsByCategory(category: string): IActor[] {
    return Array.from(this.actors.values()).filter(
      (actor) => actor.category === category,
    );
  }

  /**
   * Get retrievers by retrieval type
   */
  getRetrieversByType(retrievalType: string): IRetriever[] {
    return Array.from(this.retrievers.values()).filter(
      (retriever) => retriever.retrievalType === retrievalType,
    );
  }

  /**
   * Get tools that require authentication
   */
  getToolsRequiringAuth(): IActor[] {
    return Array.from(this.actors.values()).filter(
      (actor) => actor.requiresAuth,
    );
  }

  /**
   * Get retrievers that use caching
   */
  getCachingRetrievers(): IRetriever[] {
    return Array.from(this.retrievers.values()).filter(
      (retriever) => retriever.caching,
    );
  }

  /**
   * Get tool information for all registered tools
   */
  getToolInfos(): ToolInfo[] {
    const infos: ToolInfo[] = [];

    for (const tool of this.tools.values()) {
      const info: ToolInfo = {
        name: tool.name,
        description: tool.description,
        type: tool.type,
      };

      if (tool.type === 'actor') {
        const actor = tool as IActor;
        info.category = actor.category;
        info.requiresAuth = actor.requiresAuth;
      } else if (tool.type === 'retriever') {
        const retriever = tool as IRetriever;
        info.retrievalType = retriever.retrievalType;
        info.caching = retriever.caching;
      }

      infos.push(info);
    }

    return infos;
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the count of registered tools
   */
  getToolCount(): { total: number; actors: number; retrievers: number } {
    return {
      total: this.tools.size,
      actors: this.actors.size,
      retrievers: this.retrievers.size,
    };
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.actors.clear();
    this.retrievers.clear();
  }
}
