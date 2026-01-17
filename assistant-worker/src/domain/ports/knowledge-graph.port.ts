export interface NodeLock {
  lockedBy: string;
  lockedAt: Date;
}

export interface KnowledgeGraphNode {
  id: string;
  lock?: NodeLock;
  [key: string]: unknown;
}

export interface KnowledgeGraphPort {
  getNode(id: string): Promise<KnowledgeGraphNode | null>;
  unlockNode(id: string, lockedBy: string): Promise<void>;
}
