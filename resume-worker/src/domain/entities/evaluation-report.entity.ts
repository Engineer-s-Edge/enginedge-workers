import { Types } from 'mongoose';

/**
 * Evaluation Report - Comprehensive resume evaluation results
 */

export interface EvaluationScores {
  atsParseability: number; // 0-100
  bulletQuality: number;
  roleJdAlignment: number;
  repetitionCoverage: number;
  scanability: number;
  mechanics: number;
  overall: number;
}

export interface EvaluationGates {
  atsFail: boolean;
  contactMissing: boolean;
  pageOver: boolean;
}

export interface AutoFix {
  description: string;
  confidence: number; // 0-1
  latexPatch: string;
}

export interface EvaluationFinding {
  type: 'error' | 'warning' | 'improvement' | 'gap';
  code: string; // "TABLE_DETECTED" | "BULLET_TOO_LONG"
  location?: string; // "Experience[0].bullets[2]"
  evidence?: string;
  autoFixes?: AutoFix[];
}

export interface EvaluationCoverage {
  skillsHit: string[];
  skillsMissingRequired: string[];
  competencyHits: string[];
}

export interface EvaluationRepetition {
  nearDuplicateClusters: Array<{
    topic: string;
    bulletCount: number;
  }>;
  skillEntropy: number; // 0-1, higher = more diverse
}

export interface BulletSwapSuggestion {
  bulletId?: Types.ObjectId; // null = suggest adding new
  location: string; // "Experience[0].bullets[2]"
  reason: string;
  alternatives: Array<{
    bankItemId: Types.ObjectId;
    bulletText: string;
    score: number;
  }>;
}

/**
 * Evaluation Report Entity
 */
export interface EvaluationReport {
  id: Types.ObjectId;
  resumeId: Types.ObjectId;
  userId: string;
  mode: 'standalone' | 'role-guided' | 'jd-match';
  jobPostingId?: Types.ObjectId;
  targetRole?: string;
  scores: EvaluationScores;
  gates: EvaluationGates;
  findings: EvaluationFinding[];
  coverage: EvaluationCoverage;
  repetition: EvaluationRepetition;
  suggestedSwaps: BulletSwapSuggestion[];
  createdAt: Date;
}

export type EvaluationReportDocument = EvaluationReport & Document;
