/**
 * Validation check types supported by the validation pipeline.
 */
export enum ValidationCheckType {
  HALLUCINATION_DETECTION = 'hallucination_detection',
  SOURCE_VERIFICATION = 'source_verification',
  FACT_CONSISTENCY = 'fact_consistency',
  LOGICAL_COHERENCE = 'logical_coherence',
  DUPLICATE_DETECTION = 'duplicate_detection',
  RELATIONSHIP_VALIDITY = 'relationship_validity',
  CATEGORY_CONSISTENCY = 'category_consistency',
  COMPLEXITY_MATCH = 'complexity_match',
  SOURCE_QUALITY = 'source_quality',
  COVERAGE_COMPLETENESS = 'coverage_completeness',
  CITATION_ACCURACY = 'citation_accuracy',
  BIAS_DETECTION = 'bias_detection',
}

export enum ValidationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface CitationEntry {
  text: string;
  sourceId?: string;
  url?: string;
  verified?: boolean;
}

export interface KnowledgeGraphReference {
  nodeId: string;
  label?: string;
  relation?: string;
  supportScore?: number;
}

export interface ExpertReport {
  reportId: string;
  expertId: string;
  topic: string;
  summary?: string;
  findings: string[];
  sources: string[];
  confidence: number;
  contradictions?: string[];
  citations?: CitationEntry[];
  categories?: string[];
  complexity?: number;
  relatedNodes?: KnowledgeGraphReference[];
  metadata?: Record<string, unknown>;
}

export interface ValidationIssue {
  id: string;
  type: ValidationCheckType;
  severity: ValidationSeverity;
  confidence: number;
  summary: string;
  details?: string;
  location?: string;
  recommendation?: string;
  evidence?: {
    source?: string;
    snippet?: string;
    findingIndex?: number;
  };
}

export interface ValidationCheckSummary {
  type: ValidationCheckType;
  passed: boolean;
  score: number;
  durationMs: number;
  issueCount: number;
}

export interface ValidationAutoFix {
  issueId: string;
  action: string;
  success: boolean;
  appliedAt: Date;
  details?: string;
}

export interface ValidationResult {
  id: string;
  expertId: string;
  reportId: string;
  topic: string;
  validatedAt: Date;
  validationDurationMs: number;
  status: 'passed' | 'passed-with-warnings' | 'failed';
  score: number;
  coverageScore: number;
  completenessScore: number;
  issues: ValidationIssue[];
  issuesBySeverity: Record<ValidationSeverity, number>;
  checks: Partial<Record<ValidationCheckType, ValidationCheckSummary>>;
  requiresManualReview: boolean;
  reviewReason?: string;
  autoFixesApplied?: ValidationAutoFix[];
  metadata?: Record<string, unknown>;
}

export interface ValidationConfig {
  enabledChecks: ValidationCheckType[];
  minConfidenceThreshold: number;
  autoFixEnabled: boolean;
  blockingSeverity: ValidationSeverity;
  useValidatorAgents: boolean;
  timeoutMs: number;
  coverageTarget?: number;
  applyBiasHeuristics?: boolean;
}

export interface ValidateExpertWorkRequest {
  expertReport: ExpertReport;
  config?: Partial<ValidationConfig>;
  applyFixes?: boolean;
  metadata?: Record<string, unknown>;
}

export interface BatchValidationRequest {
  expertReports: ExpertReport[];
  config?: Partial<ValidationConfig>;
  maxConcurrent?: number;
}

export interface BatchValidationResult {
  total: number;
  passed: number;
  failed: number;
  elapsedMs: number;
  results: ValidationResult[];
}

export type ValidationQueueStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'failed';

export interface ValidationQueueHistoryEntry {
  status: ValidationQueueStatus;
  timestamp: Date;
  notes?: string;
}

export interface ValidationQueueItem {
  id: string;
  agentId: string;
  expertId: string;
  topic: string;
  priority: number;
  status: ValidationQueueStatus;
  report: ExpertReport;
  result?: ValidationResult;
  createdAt: Date;
  updatedAt: Date;
  lastError?: string;
  history: ValidationQueueHistoryEntry[];
}

export interface ValidationStatusSnapshot {
  agentId?: string;
  expertId: string;
  reportId: string;
  status: ValidationQueueStatus | 'valid' | 'invalid';
  progress: number;
  score?: number;
  issues?: ValidationIssue[];
  topic?: string;
  updatedAt: Date;
}

export interface ValidationReviewItem {
  id: string;
  agentId: string;
  expertId: string;
  reportId: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes-requested';
  reason: string;
  createdAt: Date;
  updatedAt: Date;
  requestedBy: string;
  reviewerId?: string;
  notes?: string;
  result?: ValidationResult;
}

export interface ValidationStatistics {
  totalValidations: number;
  passRate: number;
  averageScore: number;
  autoFixSuccessRate: number;
  issuesByType: Record<ValidationCheckType, number>;
  issuesBySeverity: Record<ValidationSeverity, number>;
  averageDurationMs: number;
  lastUpdated: Date;
}

export type ValidatorAgentMode = 'reactive' | 'skin-phase' | 'safety';

export interface ValidatorAgentDefinition {
  validatorId: string;
  agentId: string;
  name: string;
  mode: ValidatorAgentMode;
  capabilities: ValidationCheckType[];
  status: 'idle' | 'validating' | 'error';
  createdAt: Date;
  updatedAt: Date;
  errorLog: ValidatorAgentError[];
  lastRun?: ValidatorAgentRun;
}

export interface ValidatorAgentError {
  timestamp: Date;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidatorAgentRun {
  startedAt: Date;
  completedAt?: Date;
  reportId: string;
  resultStatus?: ValidationResult['status'];
  issuesFound?: number;
}

export interface ValidationStatusEvent {
  type:
    | 'validation.started'
    | 'validation.completed'
    | 'validation.failed'
    | 'validation.progress'
    | 'review.updated';
  timestamp: Date;
  payload: Record<string, unknown>;
}
