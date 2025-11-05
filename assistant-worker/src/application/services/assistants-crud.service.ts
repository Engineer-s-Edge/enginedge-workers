/**
 * Assistants CRUD Service
 *
 * Application layer service for assistant CRUD operations
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { IAssistantRepository } from '../ports/assistant.repository';
import {
  CreateAssistantDto,
  UpdateAssistantDto,
  AssistantFiltersDto,
} from '../dto/assistant.dto';
import {
  Assistant,
  AssistantStatus,
  AssistantType,
  AssistantMode,
} from '@domain/entities/assistant.entity';
import { ILogger } from '../ports/logger.port';

@Injectable()
export class AssistantsCrudService {
  constructor(
    private readonly assistantsRepository: IAssistantRepository,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.logger.info('AssistantsCrudService initialized');
  }

  async create(createAssistantDto: CreateAssistantDto): Promise<Assistant> {
    this.logger.info(`Creating assistant: ${createAssistantDto.name}`);
    try {
      const existingAssistant = await this.assistantsRepository.findByName(
        createAssistantDto.name,
      );
      if (existingAssistant) {
        this.logger.warn(
          `Assistant with name '${createAssistantDto.name}' already exists`,
        );
        throw new ConflictException(
          `Assistant with name '${createAssistantDto.name}' already exists`,
        );
      }
      const assistantData = this.transformCreateDtoToEntity(createAssistantDto);
      const createdAssistant =
        await this.assistantsRepository.create(assistantData);
      this.logger.info(
        `Successfully created assistant: ${createdAssistant.name}`,
      );
      return createdAssistant;
    } catch (error: unknown) {
      const e =
        error instanceof ConflictException
          ? error
          : error instanceof Error
            ? error
            : new Error(String(error));
      if (e instanceof ConflictException) {
        throw e;
      }
      this.logger.error(
        `Failed to create assistant: ${createAssistantDto.name}`,
        e.message,
      );
      throw e;
    }
  }

  async findAll(filters: AssistantFiltersDto = {}): Promise<Assistant[]> {
    this.logger.info(
      `Finding all assistants with filters: ${JSON.stringify(filters)}`,
    );
    try {
      const assistants = await this.assistantsRepository.findAll(filters);
      this.logger.info(`Found ${assistants.length} assistants`);
      return assistants;
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to find assistants', e.message);
      throw e;
    }
  }

  async findByName(name: string): Promise<Assistant> {
    this.logger.info(`Finding assistant by name: ${name}`);
    try {
      const assistant = await this.assistantsRepository.findByName(name);
      if (!assistant) {
        this.logger.warn(`Assistant '${name}' not found`);
        throw new NotFoundException(`Assistant '${name}' not found`);
      }
      this.logger.info(`Found assistant: ${name}`);
      return assistant;
    } catch (error: unknown) {
      const e =
        error instanceof NotFoundException
          ? error
          : error instanceof Error
            ? error
            : new Error(String(error));
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.logger.error(`Failed to find assistant: ${name}`, e.message);
      throw e;
    }
  }

  async update(
    name: string,
    updateAssistantDto: UpdateAssistantDto,
  ): Promise<Assistant> {
    this.logger.info(`Updating assistant: ${name}`);
    try {
      const updateData = this.transformUpdateDtoToEntity(updateAssistantDto);
      const updatedAssistant = await this.assistantsRepository.update(
        name,
        updateData,
      );
      if (!updatedAssistant) {
        this.logger.warn(`Assistant '${name}' not found for update`);
        throw new NotFoundException(`Assistant '${name}' not found`);
      }
      this.logger.info(`Successfully updated assistant: ${name}`);
      return updatedAssistant;
    } catch (error: unknown) {
      const e =
        error instanceof NotFoundException
          ? error
          : error instanceof Error
            ? error
            : new Error(String(error));
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.logger.error(`Failed to update assistant: ${name}`, e.message);
      throw e;
    }
  }

  async remove(name: string): Promise<void> {
    this.logger.info(`Removing assistant: ${name}`);
    try {
      const deleted = await this.assistantsRepository.delete(name);
      if (!deleted)
        this.logger.warn(`Assistant '${name}' not found for deletion`);
      this.logger.info(`Successfully removed assistant: ${name}`);
    } catch (error: unknown) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to remove assistant: ${name}`, e.message);
      throw e;
    }
  }

  private transformCreateDtoToEntity(
    dto: CreateAssistantDto,
  ): Partial<Assistant> {
    const mapType = (t?: string | AssistantType): AssistantType => {
      if (!t) return AssistantType.CUSTOM;
      if (typeof t === 'string') {
        const v = String(t).toLowerCase();
        if (v === 'react' || v === 'react_agent' || v === 'react-agent')
          return AssistantType.REACT_AGENT;
        if (v === 'graph' || v === 'graph_agent' || v === 'graph-agent')
          return AssistantType.GRAPH_AGENT;
        return (Object.values(AssistantType) as string[]).includes(t)
          ? (t as AssistantType)
          : AssistantType.CUSTOM;
      }
      return t;
    };

    const mapMode = (m?: AssistantMode | string): AssistantMode =>
      m && (Object.values(AssistantMode) as any[]).includes(m)
        ? (m as AssistantMode)
        : AssistantMode.BALANCED;

    return {
      name: dto.name,
      description: dto.description,
      type: mapType(dto.type),
      primaryMode: mapMode(dto.primaryMode),
      status: AssistantStatus.ACTIVE,
      agentType:
        dto.agentType ||
        (dto.type && String(dto.type).toLowerCase().includes('graph')
          ? 'graph'
          : dto.type && String(dto.type).toLowerCase().includes('react')
            ? 'react'
            : 'custom'),
      blocks: dto.blocks || [],
      customPrompts: dto.customPrompts || [],
      contextBlocks: dto.contextBlocks || [],
      tools: dto.tools || [],
      subjectExpertise: dto.subjectExpertise || [],
      reactConfig: dto.reactConfig,
      graphConfig: dto.graphConfig,
      isPublic: dto.isPublic || false,
      userId: dto.userId,
      metadata: {},
    };
  }

  private transformUpdateDtoToEntity(
    dto: UpdateAssistantDto,
  ): Partial<Assistant> {
    const entity: Partial<Assistant> = {};
    const mapType = (t?: string | AssistantType): AssistantType | undefined => {
      if (!t) return undefined;
      if (typeof t === 'string') {
        const v = String(t).toLowerCase();
        if (v === 'react' || v === 'react_agent' || v === 'react-agent')
          return AssistantType.REACT_AGENT;
        if (v === 'graph' || v === 'graph_agent' || v === 'graph-agent')
          return AssistantType.GRAPH_AGENT;
        return (Object.values(AssistantType) as string[]).includes(t)
          ? (t as AssistantType)
          : undefined;
      }
      return t;
    };

    const mapMode = (m?: AssistantMode | string): AssistantMode | undefined =>
      m && (Object.values(AssistantMode) as any[]).includes(m)
        ? (m as AssistantMode)
        : undefined;

    if (dto.description !== undefined) entity.description = dto.description;
    const t = mapType(dto.type);
    if (t !== undefined) entity.type = t;
    const m = mapMode(dto.primaryMode);
    if (m !== undefined) entity.primaryMode = m;
    if (dto.agentType !== undefined) entity.agentType = dto.agentType;
    if (dto.blocks !== undefined) entity.blocks = dto.blocks;
    if (dto.customPrompts !== undefined)
      entity.customPrompts = dto.customPrompts;
    if (dto.contextBlocks !== undefined)
      entity.contextBlocks = dto.contextBlocks;
    if (dto.tools !== undefined) entity.tools = dto.tools;
    if (dto.subjectExpertise !== undefined)
      entity.subjectExpertise = dto.subjectExpertise;
    if (dto.reactConfig !== undefined) entity.reactConfig = dto.reactConfig;
    if (dto.graphConfig !== undefined) entity.graphConfig = dto.graphConfig;
    if (dto.isPublic !== undefined) entity.isPublic = dto.isPublic;
    if (dto.userId !== undefined) entity.userId = dto.userId;

    return entity;
  }
}
