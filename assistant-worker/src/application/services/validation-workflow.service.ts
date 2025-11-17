import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BatchValidationRequest,
  ExpertReport,
  ValidationQueueItem,
  ValidationQueueStatus,
  ValidationStatusEvent,
  ValidationStatusSnapshot,
  ValidationReviewItem,
  ValidatorAgentDefinition,
  ValidatorAgentError,
  ValidatorAgentRun,
  ValidationCheckType,
  ValidationResult,
  ValidationSeverity,
} from '@domain/validation/validation.types';
import { ValidationService } from './validation.service';

type QueueMap = Map<string, ValidationQueueItem[]>;
type ReviewMap = Map<string, ValidationReviewItem[]>;
type ValidatorMap = Map<string, ValidatorAgentDefinition[]>;
type Subscriber = (event: ValidationStatusEvent) => void;

@Injectable()
export class ValidationWorkflowService {
  private readonly queues: QueueMap = new Map();
  private readonly reviews: ReviewMap = new Map();
  private readonly validators: ValidatorMap = new Map();
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private readonly statusSnapshots = new Map<string, ValidationStatusSnapshot>();
  private readonly validations = new Map<string, ValidationResult>();
  private readonly validationReports = new Map<string, ExpertReport>();
  private readonly validationAgents = new Map<string, string>();

  constructor(private readonly validationService: ValidationService) {}

  enqueue(
    agentId: string,
    report: ExpertReport,
    priority = 5,
  ): ValidationQueueItem {
    const queue = this.getQueue(agentId);
    const item: ValidationQueueItem = {
      id: randomUUID(),
      agentId,
      expertId: report.expertId,
      topic: report.topic,
      priority,
      status: 'pending',
      report,
      createdAt: new Date(),
      updatedAt: new Date(),
      history: [
        { status: 'pending', timestamp: new Date(), notes: 'Queued for validation' },
      ],
    };

    queue.push(item);
    queue.sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());

    this.emitEvent(agentId, {
      type: 'validation.started',
      timestamp: new Date(),
      payload: { queueId: item.id, agentId, expertId: item.expertId },
    });

    return item;
  }

  listQueue(agentId: string): ValidationQueueItem[] {
    return [...this.getQueue(agentId)];
  }

  getQueueItem(agentId: string, queueId: string): ValidationQueueItem | undefined {
    return this.getQueue(agentId).find((item) => item.id === queueId);
  }

  async processQueueItem(
    agentId: string,
    queueId: string,
    options?: { applyFixes?: boolean; config?: BatchValidationRequest['config'] },
  ): Promise<ValidationQueueItem> {
    const queue = this.getQueue(agentId);
    const item = queue.find((entry) => entry.id === queueId);

    if (!item) {
      throw new NotFoundException(`Validation queue item '${queueId}' not found`);
    }

    this.updateQueueStatus(item, 'in-progress', 'Validation started');
    this.emitStatus(agentId, item, 'validation.started');

    try {
      const result = await this.validationService.validateExpertWork({
        expertReport: item.report,
        config: options?.config,
        applyFixes: options?.applyFixes,
        metadata: {
          agentId,
          queueId: item.id,
        },
      });

      item.result = result;
      this.validations.set(result.id, result);
      this.validationReports.set(result.id, item.report);
      this.validationAgents.set(result.id, agentId);

      const status: ValidationQueueStatus =
        result.status === 'failed' ? 'failed' : 'completed';
      this.updateQueueStatus(item, status, 'Validation completed');
      this.captureSnapshot(item, result);

      if (result.requiresManualReview) {
        this.createManualReview(agentId, item, result);
      }

      this.emitStatus(agentId, item, 'validation.completed', result as unknown as Record<string, unknown>);
      return item;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown validation error';
      this.updateQueueStatus(item, 'failed', message);
      item.lastError = message;
      this.emitStatus(agentId, item, 'validation.failed', { message });
      throw error;
    }
  }

  listStatusSnapshots(agentId: string): ValidationStatusSnapshot[] {
    return Array.from(this.statusSnapshots.values()).filter(
      (snapshot) => snapshot.agentId === agentId,
    );
  }

  getStatus(expertId: string, reportId: string): ValidationStatusSnapshot | undefined {
    return this.statusSnapshots.get(this.snapshotKey(expertId, reportId));
  }

  subscribe(agentId: string, subscriber: Subscriber): () => void {
    const set = this.getSubscriberSet(agentId);
    set.add(subscriber);
    return () => set.delete(subscriber);
  }

  listManualReviews(agentId: string): ValidationReviewItem[] {
    return this.getReviews(agentId).filter(
      (review) => review.status === 'pending',
    );
  }

  updateManualReview(
    agentId: string,
    reviewId: string,
    action: 'approve' | 'reject' | 'request-changes',
    reviewerId: string,
    notes?: string,
  ): ValidationReviewItem {
    const reviews = this.getReviews(agentId);
    const review = reviews.find((entry) => entry.id === reviewId);

    if (!review) {
      throw new NotFoundException(`Review '${reviewId}' not found`);
    }

    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      'request-changes': 'changes-requested',
    } as const;

    review.status = statusMap[action];
    review.reviewerId = reviewerId;
    review.notes = notes;
    review.updatedAt = new Date();

    this.emitEvent(agentId, {
      type: 'review.updated',
      timestamp: new Date(),
      payload: { reviewId, status: review.status, agentId },
    });

    return review;
  }

  listValidations(agentId: string): ValidationResult[] {
    return Array.from(this.validations.values()).filter(
      (result) => this.validationAgents.get(result.id) === agentId,
    );
  }

  getValidation(validationId: string): ValidationResult | undefined {
    return this.validations.get(validationId);
  }

  getValidationsForExpert(expertId: string): ValidationResult[] {
    return Array.from(this.validations.values()).filter(
      (result) => result.expertId === expertId,
    );
  }

  async applyFixes(validationId: string): Promise<ValidationResult> {
    const report = this.validationReports.get(validationId);
    if (!report) {
      throw new NotFoundException(`Validation '${validationId}' not found`);
    }

    const result = await this.validationService.validateExpertWork({
      expertReport: report,
      applyFixes: true,
      metadata: { agentId: this.validationAgents.get(validationId) },
    });

    const merged: ValidationResult = { ...result, id: validationId };
    this.validations.set(validationId, merged);
    return merged;
  }

  addValidatorAgent(
    agentId: string,
    payload: {
      name: string;
      mode: ValidatorAgentDefinition['mode'];
      capabilities: ValidationCheckType[];
    },
  ): ValidatorAgentDefinition {
    const registry = this.getValidators(agentId);
    const definition: ValidatorAgentDefinition = {
      validatorId: randomUUID(),
      agentId,
      name: payload.name,
      mode: payload.mode,
      capabilities: payload.capabilities,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
      errorLog: [],
    };

    registry.push(definition);
    return definition;
  }

  listValidatorAgents(agentId: string): ValidatorAgentDefinition[] {
    return [...this.getValidators(agentId)];
  }

  async runValidator(
    agentId: string,
    validatorId: string,
    report: ExpertReport,
  ): Promise<ValidationResult> {
    const validator = this.getValidators(agentId).find(
      (entry) => entry.validatorId === validatorId,
    );
    if (!validator) {
      throw new NotFoundException(`Validator '${validatorId}' not found`);
    }

    validator.status = 'validating';
    validator.updatedAt = new Date();
    const run: ValidatorAgentRun = {
      reportId: report.reportId,
      startedAt: new Date(),
    };

    try {
      const result = await this.validationService.validateExpertWork({
        expertReport: report,
        config: { enabledChecks: validator.capabilities },
      });
      run.completedAt = new Date();
      run.resultStatus = result.status;
      run.issuesFound = result.issues.length;
      validator.lastRun = run;
      validator.status = 'idle';
      validator.updatedAt = new Date();
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Validator execution failed';
      const entry: ValidatorAgentError = {
        timestamp: new Date(),
        message,
        severity: ValidationSeverity.ERROR,
      };
      validator.errorLog.push(entry);
      validator.status = 'error';
      validator.updatedAt = new Date();
      throw error;
    }
  }

  listValidatorErrors(agentId: string, validatorId: string): ValidatorAgentError[] {
    const validator = this.getValidators(agentId).find(
      (entry) => entry.validatorId === validatorId,
    );
    if (!validator) {
      throw new NotFoundException(`Validator '${validatorId}' not found`);
    }
    return [...validator.errorLog];
  }

  private getQueue(agentId: string): ValidationQueueItem[] {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, []);
    }
    return this.queues.get(agentId)!;
  }

  private getReviews(agentId: string): ValidationReviewItem[] {
    if (!this.reviews.has(agentId)) {
      this.reviews.set(agentId, []);
    }
    return this.reviews.get(agentId)!;
  }

  private getValidators(agentId: string): ValidatorAgentDefinition[] {
    if (!this.validators.has(agentId)) {
      this.validators.set(agentId, []);
    }
    return this.validators.get(agentId)!;
  }

  private getSubscriberSet(agentId: string): Set<Subscriber> {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
    }
    return this.subscribers.get(agentId)!;
  }

  private updateQueueStatus(
    item: ValidationQueueItem,
    status: ValidationQueueStatus,
    notes?: string,
  ): void {
    item.status = status;
    item.updatedAt = new Date();
    item.history.push({ status, timestamp: item.updatedAt, notes });
  }

  private emitStatus(
    agentId: string,
    item: ValidationQueueItem,
    type: ValidationStatusEvent['type'],
    payload?: Record<string, unknown>,
  ): void {
    this.emitEvent(agentId, {
      type,
      timestamp: new Date(),
      payload: {
        queueId: item.id,
        expertId: item.expertId,
        topic: item.topic,
        status: item.status,
        resultStatus: item.result?.status,
        ...(payload || {}),
      },
    });
  }

  private emitEvent(agentId: string, event: ValidationStatusEvent): void {
    const subscribers = this.getSubscriberSet(agentId);
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event);
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  private snapshotKey(expertId: string, reportId: string): string {
    return `${expertId}:${reportId}`;
  }

  private captureSnapshot(
    item: ValidationQueueItem,
    result?: ValidationResult,
  ): void {
    const snapshot: ValidationStatusSnapshot = {
      agentId: item.agentId,
      expertId: item.expertId,
      reportId: item.report.reportId,
      status:
        result?.status === 'failed'
          ? 'invalid'
          : result
            ? 'valid'
            : item.status,
      progress: result ? 1 : item.status === 'in-progress' ? 0.5 : 0,
      score: result?.score,
      issues: result?.issues,
      topic: item.topic,
      updatedAt: new Date(),
    };
    this.statusSnapshots.set(
      this.snapshotKey(snapshot.expertId, snapshot.reportId),
      snapshot,
    );
  }

  private createManualReview(
    agentId: string,
    item: ValidationQueueItem,
    result: ValidationResult,
  ): void {
    const review: ValidationReviewItem = {
      id: randomUUID(),
      agentId,
      expertId: item.expertId,
      reportId: item.report.reportId,
      status: 'pending',
      reason: result.reviewReason || 'Manual review requested',
      createdAt: new Date(),
      updatedAt: new Date(),
      requestedBy: item.agentId,
      result,
    };
    this.getReviews(agentId).push(review);
  }
}
