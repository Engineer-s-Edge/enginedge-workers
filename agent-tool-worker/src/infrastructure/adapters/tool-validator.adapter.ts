/**
 * Tool Validator Adapter
 *
 * Implements validation logic for tool inputs and outputs.
 */

import { Injectable } from '@nestjs/common';
import { IToolValidator } from '../../domain/ports/tool.ports';

@Injectable()
export class ToolValidator implements IToolValidator {
  /**
   * Validates tool input against basic criteria
   */
  async validateToolInput(toolName: string, input: unknown): Promise<boolean> {
    // Basic validation: ensure input is not null/undefined
    if (input === null || input === undefined) {
      return false;
    }

    // Tool-specific validation could be added here
    return true;
  }

  /**
   * Validates tool output against basic criteria
   */
  async validateToolOutput(
    toolName: string,
    output: unknown,
  ): Promise<boolean> {
    // Basic validation: ensure output is not null/undefined
    if (output === null || output === undefined) {
      return false;
    }

    // Tool-specific validation could be added here
    return true;
  }
}
