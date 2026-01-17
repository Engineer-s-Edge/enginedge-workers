/**
 * Whiteboard State Entity
 *
 * Represents the state of a whiteboard diagram for a session/question.
 */

export interface WhiteboardNode {
  id: string;
  type: 'component' | 'shape' | 'text';
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface WhiteboardEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface WhiteboardState {
  id: string;
  sessionId: string;
  questionId: string;
  diagram: {
    nodes: WhiteboardNode[];
    edges: WhiteboardEdge[];
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
}
