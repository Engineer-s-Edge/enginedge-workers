/**
 * Response Parser Service
 *
 * Parses and structures LLM responses into usable formats.
 * Handles text extraction, JSON parsing, and response validation.
 */

import { Injectable } from '@nestjs/common';

/**
 * Service for parsing LLM responses
 */
@Injectable()
export class ResponseParser {
  /**
   * Parse raw LLM response
   */
  parse(response: unknown): unknown {
    if (typeof response === 'string') {
      return this.parseString(response);
    }

    if (typeof response === 'object' && response !== null) {
      return this.parseObject(response as Record<string, unknown>);
    }

    return response;
  }

  /**
   * Parse string response
   */
  private parseString(response: string): unknown {
    // Try JSON parsing first
    try {
      return JSON.parse(response);
    } catch {
      // Not JSON, return as is
    }

    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Not valid JSON
      }
    }

    // Return as plain text
    return response;
  }

  /**
   * Parse object response
   */
  private parseObject(obj: Record<string, unknown>): unknown {
    // If has text field, extract it
    if (obj.text && typeof obj.text === 'string') {
      return this.parseString(obj.text);
    }

    // If has content field, extract it
    if (obj.content && typeof obj.content === 'string') {
      return this.parseString(obj.content);
    }

    // Return object as is
    return obj;
  }

  /**
   * Extract tool calls from response
   */
  extractToolCalls(response: string): Array<{
    toolName: string;
    input: unknown;
  }> {
    const toolCalls: Array<{ toolName: string; input: unknown }> = [];

    // Pattern: [TOOL: toolName(input)]
    const pattern = /\[TOOL:\s*(\w+)\s*\((.*?)\)\]/g;
    let match;

    while ((match = pattern.exec(response)) !== null) {
      const toolName = match[1];
      const inputStr = match[2];

      let input: unknown;
      try {
        input = JSON.parse(inputStr);
      } catch {
        input = inputStr;
      }

      toolCalls.push({ toolName, input });
    }

    return toolCalls;
  }

  /**
   * Extract final answer from response
   */
  extractFinalAnswer(response: string): string | null {
    // Pattern: [FINAL: answer]
    const match = response.match(/\[FINAL:\s*([\s\S]*?)\]/);
    if (match) {
      return match[1].trim();
    }

    // Pattern: **Final Answer:**
    const finalMatch = response.match(/\*\*Final Answer:\*\*\s*([\s\S]*?)(?:\n\n|\Z)/);
    if (finalMatch) {
      return finalMatch[1].trim();
    }

    // If response ends with conclusion, treat as final answer
    if (response.includes('Therefore,') || response.includes('In conclusion,')) {
      return response;
    }

    return null;
  }

  /**
   * Extract structured data from response
   */
  extractStructured(response: string, schema: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, pattern] of Object.entries(schema)) {
      const regex = new RegExp(pattern, 'i');
      const match = response.match(regex);
      result[key] = match ? match[1] : null;
    }

    return result;
  }

  /**
   * Validate response format
   */
  validate(response: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof response === 'string' && response.length > 0;

      case 'json':
        try {
          JSON.parse(String(response));
          return true;
        } catch {
          return false;
        }

      case 'object':
        return typeof response === 'object' && response !== null;

      case 'number':
        return typeof response === 'number';

      case 'boolean':
        return typeof response === 'boolean';

      default:
        return true;
    }
  }

  /**
   * Sanitize response for output
   */
  sanitize(response: string): string {
    return response
      .trim()
      .replace(/\n\s*\n/g, '\n\n') // Normalize whitespace
      .replace(/[^\x20-\x7E\n]/g, ''); // Remove non-printable chars
  }

  /**
   * Split response into chunks
   */
  split(response: string, delimiter: string = '\n'): string[] {
    return response
      .split(delimiter)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);
  }

  /**
   * Extract URLs from response
   */
  extractUrls(response: string): string[] {
    const urlPattern = /https?:\/\/[^\s)]+/g;
    const matches = response.match(urlPattern);
    return matches || [];
  }

  /**
   * Extract code blocks from response
   */
  extractCodeBlocks(
    response: string,
  ): Array<{ language: string; code: string }> {
    const codeBlocks: Array<{ language: string; code: string }> = [];
    const pattern = /```([\w]*)\n([\s\S]*?)```/g;
    let match;

    while ((match = pattern.exec(response)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }

    return codeBlocks;
  }
}
