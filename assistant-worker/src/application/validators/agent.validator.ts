/**
 * Agent Configuration Validators
 */

import {
  CreateAgentDTO,
  UpdateAgentDTO,
  ExecuteAgentDTO,
  StreamAgentExecutionDTO,
  ConfigureAgentDTO,
  ListAgentsQueryDTO,
  DeleteAgentDTO,
} from '../dto/agent.dto';
import {
  InvalidDTOException,
  InvalidAgentTypeException,
  InvalidMemoryTypeException,
} from '../exceptions';
import { AgentTypeValue, MemoryTypeValue } from '../dto/types';

const VALID_AGENT_TYPES: AgentTypeValue[] = [
  'react',
  'graph',
  'expert',
  'genius',
  'collective',
];
const VALID_MEMORY_TYPES: MemoryTypeValue[] = [
  'buffer',
  'buffer_window',
  'token_buffer',
  'summary',
  'summary_buffer',
  'entity',
  'knowledge_graph',
  'vector_store',
];

/**
 * Validates CreateAgentDTO
 */
export class CreateAgentValidator {
  validate(dto: CreateAgentDTO): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validate name
    if (!dto.name || dto.name.trim().length === 0) {
      errors.name = 'Agent name is required';
    } else if (dto.name.length > 100) {
      errors.name = 'Agent name must be less than 100 characters';
    }

    // Validate agent type
    if (!dto.agentType) {
      errors.agentType = 'Agent type is required';
    } else if (!VALID_AGENT_TYPES.includes(dto.agentType)) {
      throw new InvalidAgentTypeException(dto.agentType);
    }

    // Validate memory type
    if (!dto.memoryType) {
      errors.memoryType = 'Memory type is required';
    } else if (!VALID_MEMORY_TYPES.includes(dto.memoryType)) {
      throw new InvalidMemoryTypeException(dto.memoryType);
    }

    // Validate config is object
    if (!dto.config || typeof dto.config !== 'object') {
      errors.config = 'Agent configuration is required and must be an object';
    }

    // For Collective: require child agents
    if (dto.agentType === 'collective') {
      if (!dto.childAgentIds || dto.childAgentIds.length === 0) {
        errors.childAgentIds = 'Collective agents must have at least one child agent';
      }
    }

    return errors;
  }
}

/**
 * Validates UpdateAgentDTO
 */
export class UpdateAgentValidator {
  validate(dto: UpdateAgentDTO): Record<string, string> {
    const errors: Record<string, string> = {};

    // At least one field must be provided
    if (
      !dto.name &&
      !dto.config &&
      !dto.memoryType &&
      !dto.memoryConfig
    ) {
      errors.general = 'At least one field must be provided for update';
    }

    // Validate name if provided
    if (dto.name !== undefined) {
      if (dto.name.trim().length === 0) {
        errors.name = 'Agent name cannot be empty';
      } else if (dto.name.length > 100) {
        errors.name = 'Agent name must be less than 100 characters';
      }
    }

    // Validate memory type if provided
    if (
      dto.memoryType !== undefined &&
      !VALID_MEMORY_TYPES.includes(dto.memoryType)
    ) {
      throw new InvalidMemoryTypeException(dto.memoryType);
    }

    // Validate config is object if provided
    if (dto.config !== undefined && typeof dto.config !== 'object') {
      errors.config = 'Agent configuration must be an object';
    }

    return errors;
  }
}

/**
 * Validates ExecuteAgentDTO
 */
export class ExecuteAgentValidator {
  validate(dto: ExecuteAgentDTO): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validate agent ID
    if (!dto.agentId || dto.agentId.trim().length === 0) {
      errors.agentId = 'Agent ID is required';
    }

    // Validate user input
    if (!dto.userInput || dto.userInput.trim().length === 0) {
      errors.userInput = 'User input is required';
    }

    // Validate timeout if provided
    if (dto.timeoutMs !== undefined) {
      if (dto.timeoutMs < 1000) {
        errors.timeoutMs = 'Timeout must be at least 1000ms';
      } else if (dto.timeoutMs > 3600000) {
        errors.timeoutMs = 'Timeout must be less than 1 hour (3600000ms)';
      }
    }

    return errors;
  }
}

/**
 * Validates StreamAgentExecutionDTO
 */
export class StreamAgentExecutionValidator {
  validate(dto: StreamAgentExecutionDTO): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validate agent ID
    if (!dto.agentId || dto.agentId.trim().length === 0) {
      errors.agentId = 'Agent ID is required';
    }

    // Validate user input
    if (!dto.userInput || dto.userInput.trim().length === 0) {
      errors.userInput = 'User input is required';
    }

    // Validate timeout if provided
    if (dto.timeoutMs !== undefined) {
      if (dto.timeoutMs < 1000) {
        errors.timeoutMs = 'Timeout must be at least 1000ms';
      } else if (dto.timeoutMs > 3600000) {
        errors.timeoutMs = 'Timeout must be less than 1 hour';
      }
    }

    // Validate batch size if provided
    if (dto.batchSize !== undefined) {
      if (dto.batchSize < 1 || dto.batchSize > 1000) {
        errors.batchSize = 'Batch size must be between 1 and 1000';
      }
    }

    return errors;
  }
}

/**
 * Validates ConfigureAgentDTO
 */
export class ConfigureAgentValidator {
  validate(dto: ConfigureAgentDTO): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validate agent ID
    if (!dto.agentId || dto.agentId.trim().length === 0) {
      errors.agentId = 'Agent ID is required';
    }

    // Validate config is object
    if (!dto.config || typeof dto.config !== 'object') {
      errors.config = 'Agent configuration is required and must be an object';
    }

    return errors;
  }
}

/**
 * Validates ListAgentsQueryDTO
 */
export class ListAgentsQueryValidator {
  validate(dto: ListAgentsQueryDTO): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validate page
    if (dto.page < 0) {
      errors.page = 'Page must be non-negative';
    }

    // Validate limit
    if (dto.limit < 1 || dto.limit > 100) {
      errors.limit = 'Limit must be between 1 and 100';
    }

    // Validate agent type if provided
    if (
      dto.agentType !== undefined &&
      !VALID_AGENT_TYPES.includes(dto.agentType)
    ) {
      throw new InvalidAgentTypeException(dto.agentType);
    }

    // Validate sort direction
    if (dto.sortDir !== 'asc' && dto.sortDir !== 'desc') {
      errors.sortDir = 'Sort direction must be "asc" or "desc"';
    }

    return errors;
  }
}

/**
 * Validates DeleteAgentDTO
 */
export class DeleteAgentValidator {
  validate(dto: DeleteAgentDTO): Record<string, string> {
    const errors: Record<string, string> = {};

    // Validate agent ID
    if (!dto.agentId || dto.agentId.trim().length === 0) {
      errors.agentId = 'Agent ID is required';
    }

    return errors;
  }
}

/**
 * Composite validator for all DTOs
 */
export class AgentDTOValidator {
  private createValidator = new CreateAgentValidator();
  private updateValidator = new UpdateAgentValidator();
  private executeValidator = new ExecuteAgentValidator();
  private streamValidator = new StreamAgentExecutionValidator();
  private configureValidator = new ConfigureAgentValidator();
  private listValidator = new ListAgentsQueryValidator();
  private deleteValidator = new DeleteAgentValidator();

  validateCreateAgent(dto: CreateAgentDTO): void {
    const errors = this.createValidator.validate(dto);
    if (Object.keys(errors).length > 0) {
      throw new InvalidDTOException('CreateAgentDTO', errors);
    }
  }

  validateUpdateAgent(dto: UpdateAgentDTO): void {
    const errors = this.updateValidator.validate(dto);
    if (Object.keys(errors).length > 0) {
      throw new InvalidDTOException('UpdateAgentDTO', errors);
    }
  }

  validateExecuteAgent(dto: ExecuteAgentDTO): void {
    const errors = this.executeValidator.validate(dto);
    if (Object.keys(errors).length > 0) {
      throw new InvalidDTOException('ExecuteAgentDTO', errors);
    }
  }

  validateStreamAgentExecution(dto: StreamAgentExecutionDTO): void {
    const errors = this.streamValidator.validate(dto);
    if (Object.keys(errors).length > 0) {
      throw new InvalidDTOException('StreamAgentExecutionDTO', errors);
    }
  }

  validateConfigureAgent(dto: ConfigureAgentDTO): void {
    const errors = this.configureValidator.validate(dto);
    if (Object.keys(errors).length > 0) {
      throw new InvalidDTOException('ConfigureAgentDTO', errors);
    }
  }

  validateListAgents(dto: ListAgentsQueryDTO): void {
    const errors = this.listValidator.validate(dto);
    if (Object.keys(errors).length > 0) {
      throw new InvalidDTOException('ListAgentsQueryDTO', errors);
    }
  }

  validateDeleteAgent(dto: DeleteAgentDTO): void {
    const errors = this.deleteValidator.validate(dto);
    if (Object.keys(errors).length > 0) {
      throw new InvalidDTOException('DeleteAgentDTO', errors);
    }
  }
}
