/**
 * Collective Artifact Entity
 *
 * Domain entity representing shared artifacts (project board items) in a collective.
 */

export enum ArtifactType {
  CODE = 'code',
  DOCUMENT = 'doc',
  DATA = 'data',
  DESIGN = 'design',
  CONFIG = 'config',
  TEST = 'test',
  OTHER = 'other',
}

export enum LockType {
  READ = 'READ',
  WRITE = 'WRITE',
}

export interface ArtifactLock {
  lockedBy: string; // Agent ID
  lockedAt: Date;
  lockType: LockType;
  expiresAt: Date;
}

export interface CollectiveArtifact {
  id: string;
  collectiveId: string;
  taskId: string;
  name: string;
  type: ArtifactType;
  description?: string;
  content: string;
  version: number;
  previousVersionId?: string;
  lock?: ArtifactLock;
  createdBy: string; // Agent ID
  tags: string[];
  searchableContent: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new collective artifact
 */
export function createCollectiveArtifact(
  collectiveId: string,
  taskId: string,
  name: string,
  content: string,
  createdBy: string,
  options: {
    type?: ArtifactType;
    description?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  } = {},
): CollectiveArtifact {
  return {
    id: `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    collectiveId,
    taskId,
    name,
    type: options.type || ArtifactType.OTHER,
    description: options.description,
    content,
    version: 1,
    createdBy,
    tags: options.tags || [],
    searchableContent:
      `${name} ${options.description || ''} ${content}`.toLowerCase(),
    metadata: options.metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
