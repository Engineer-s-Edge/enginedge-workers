import { Types } from 'mongoose';

/**
 * Experience Bank Item - Represents a single resume bullet point
 * stored in the user's experience bank for reuse across resumes.
 */
export interface ExperienceBankItemMetadata {
  technologies: string[]; // ["Java", "Kubernetes", "Redis"]
  role: string; // "Backend Engineer"
  company: string;
  dateRange: {
    start: Date;
    end: Date | null; // null for current roles
  };
  metrics: string[]; // ["42% latency reduction", "5k RPS"]
  keywords: string[]; // extracted nouns/verbs for search
  reviewed: boolean; // has been verified by review agent
  linkedExperienceId: Types.ObjectId | null; // parent experience entry
  category: string; // "achievement" | "responsibility" | "project"
  impactScore: number; // 0-100 from evaluator
  atsScore: number; // 0-100 ATS compliance
  lastUsedDate: Date;
  usageCount: number;
}

export interface ExperienceBankItem {
  id: Types.ObjectId;
  userId: string;
  bulletText: string;
  vector: number[]; // Google embedding vector
  vectorModel: string; // "text-embedding-004"
  metadata: ExperienceBankItemMetadata;
  hash: string; // SHA-256 for deduplication
  createdAt: Date;
  updatedAt: Date;
}

export type ExperienceBankItemDocument = ExperienceBankItem & Document;

