/**
 * Entity Memory Adapter
 *
 * Extracts and stores facts about entities (people, places, things) from conversations.
 * Maintains a knowledge base of entity attributes and relationships.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Message } from '@domain/value-objects/message.vo';
import { IMemoryAdapter } from './buffer-memory.adapter';
import { ILLMProvider } from '@application/ports/llm-provider.port';

interface Entity {
  name: string;
  type: 'person' | 'place' | 'thing' | 'concept' | 'other';
  attributes: Record<string, string>;
  mentions: number;
  lastMentioned: Date;
}

/**
 * Entity Memory - tracks entities and their attributes
 */
@Injectable()
export class EntityMemoryAdapter implements IMemoryAdapter {
  private memory: Map<string, Message[]> = new Map(); // Message history
  private entities: Map<string, Map<string, Entity>> = new Map(); // conversationId -> entities

  constructor(
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
  ) {}

  /**
   * Add a message and extract entities
   */
  async addMessage(conversationId: string, message: Message): Promise<void> {
    // Store message
    if (!this.memory.has(conversationId)) {
      this.memory.set(conversationId, []);
    }
    this.memory.get(conversationId)!.push(message);

    // Extract and update entities
    await this.extractEntities(conversationId, message);
  }

  /**
   * Get messages
   */
  async getMessages(
    conversationId: string,
    limit?: number,
  ): Promise<Message[]> {
    const messages = this.memory.get(conversationId) || [];

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Clear memory
   */
  async clear(conversationId: string): Promise<void> {
    this.memory.delete(conversationId);
    this.entities.delete(conversationId);
  }

  /**
   * Get context with entity information
   */
  async getContext(conversationId: string): Promise<string> {
    const messages = await this.getMessages(conversationId, 5);
    const entities = this.getEntities(conversationId);

    const parts: string[] = [];

    // Add entity knowledge
    if (entities.length > 0) {
      parts.push('Known entities:');
      entities.forEach((entity) => {
        const attrs = Object.entries(entity.attributes)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        parts.push(`- ${entity.name} (${entity.type}): ${attrs}`);
      });
      parts.push('');
    }

    // Add recent messages
    parts.push('Recent messages:');
    parts.push(messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n'));

    return parts.join('\n');
  }

  /**
   * Get all entities for a conversation
   */
  getEntities(conversationId: string): Entity[] {
    const entityMap = this.entities.get(conversationId);
    if (!entityMap) {
      return [];
    }
    return Array.from(entityMap.values());
  }

  /**
   * Get a specific entity
   */
  getEntity(conversationId: string, entityName: string): Entity | undefined {
    const entityMap = this.entities.get(conversationId);
    return entityMap?.get(entityName.toLowerCase());
  }

  /**
   * Extract entities from a message
   */
  private async extractEntities(
    conversationId: string,
    message: Message,
  ): Promise<void> {
    // Initialize entity map if needed
    if (!this.entities.has(conversationId)) {
      this.entities.set(conversationId, new Map());
    }

    const entityMap = this.entities.get(conversationId)!;

    // Use LLM to extract entities (simplified for now)
    const extractedEntities = await this.llmExtractEntities(message.content);

    // Update entity map
    extractedEntities.forEach((entity) => {
      const key = entity.name.toLowerCase();
      const existing = entityMap.get(key);

      if (existing) {
        // Update existing entity
        existing.mentions++;
        existing.lastMentioned = new Date();
        // Merge attributes
        Object.assign(existing.attributes, entity.attributes);
      } else {
        // Add new entity
        entityMap.set(key, {
          ...entity,
          mentions: 1,
          lastMentioned: new Date(),
        });
      }
    });
  }

  /**
   * Use LLM to extract entities from text
   */
  private async llmExtractEntities(
    text: string,
  ): Promise<Omit<Entity, 'mentions' | 'lastMentioned'>[]> {
    try {
      const prompt = `Extract entities (people, places, things, concepts) from the following text. For each entity, provide its name, type, and any attributes mentioned.

Text: "${text}"

Format your response as JSON array:
[
  {
    "name": "entity name",
    "type": "person|place|thing|concept|other",
    "attributes": { "key": "value" }
  }
]`;

      const response = await this.llmProvider.complete({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are an entity extraction assistant. Extract entities and their attributes from text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        maxTokens: 500,
      });

      // Parse JSON response
      try {
        const entities = JSON.parse(response.content);
        return Array.isArray(entities) ? entities : [];
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Failed to extract entities:', error);
      return [];
    }
  }

  /**
   * Search entities by name or attribute
   */
  searchEntities(conversationId: string, query: string): Entity[] {
    const entities = this.getEntities(conversationId);
    const lowerQuery = query.toLowerCase();

    return entities.filter((entity) => {
      // Check name
      if (entity.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Check attributes
      return Object.values(entity.attributes).some((value) =>
        value.toLowerCase().includes(lowerQuery),
      );
    });
  }
}
