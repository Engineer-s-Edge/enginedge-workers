/**
 * BaseActor - Abstract base class for actor-style tools
 *
 * Actors modify external state (create, update, delete operations).
 * They do not use RAG parameters and focus on state-changing operations.
 */

import { BaseTool } from './base-tool';
import { ToolOutput } from '../../entities/tool.entities';
import {
  ActorConfig,
  ErrorEvent,
} from '../../value-objects/tool-config.value-objects';

export abstract class BaseActor<
  TArgs = unknown,
  TOutput extends ToolOutput = ToolOutput,
> extends BaseTool<TArgs, TOutput> {
  /** Always 'actor'; actors do not use retrieverConfig */
  readonly type = 'actor' as const;

  constructor(
    public readonly metadata: ActorConfig,
    public readonly errorEvents: ErrorEvent[],
  ) {
    super();
  }

  /**
   * Execute the concrete actor logic
   * Actors perform state-changing operations without RAG parameters
   */
  protected abstract act(args: TArgs): Promise<TOutput>;

  /**
   * Internal dispatch: strips out any ragConfig and delegates to `act`
   */
  protected override async executeTool(args: TArgs): Promise<TOutput> {
    return await this.act(args);
  }

  /**
   * Get the actor category for organization and filtering
   */
  abstract get category(): string;

  /**
   * Check if this actor requires authentication
   */
  abstract get requiresAuth(): boolean;
}
