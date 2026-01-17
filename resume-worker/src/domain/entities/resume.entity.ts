import { Types } from 'mongoose';

export interface ResumeVersion {
  versionNumber: number;
  content: string;
  timestamp: Date;
  changes: string;
  hash: string;
  createdBy: string;
  diff?: string;
}

export interface ResumeMetadata {
  targetRole?: string;
  targetCompany?: string;
  jobPostingId?: Types.ObjectId;
  lastEvaluationScore?: number;
  lastEvaluationReport?: Types.ObjectId;
  bulletPointIds: Types.ObjectId[];
  status: 'draft' | 'in-review' | 'finalized';
}

export interface Resume {
  _id?: Types.ObjectId;
  id?: Types.ObjectId;
  userId: string;
  name: string;
  latexContent: string;
  currentVersion: number;
  versions: ResumeVersion[];
  metadata: ResumeMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}
