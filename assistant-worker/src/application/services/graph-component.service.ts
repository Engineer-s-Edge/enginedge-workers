/**
 * Graph Component Service
 *
 * Manages disjoint graph detection and component merging for the Knowledge Graph.
 * Implements union-find logic to efficiently track and merge disconnected subgraphs.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { KnowledgeGraphService } from './knowledge-graph.service';
import {
  KGNode,
  KGEdge,
} from '@infrastructure/adapters/knowledge-graph/neo4j.adapter';

export interface GraphComponent {
  id: string;
  nodeCount: number;
  edgeCount: number;
  categories: string[];
  representativeNodes: string[];
  isActive: boolean;
  mergedInto?: string;
  lastMerged?: Date;
  metadata?: {
    avgConfidence?: number;
    researchProgress?: number;
  };
}

/**
 * Graph Component Service
 */
@Injectable()
export class GraphComponentService {
  private components: Map<string, GraphComponent> = new Map();
  private nodeToComponent: Map<string, string> = new Map();

  constructor(
    private readonly kgService: KnowledgeGraphService,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Create a new graph component
   */
  async createComponent(
    initialNodeId: string,
    category?: string,
  ): Promise<string> {
    const componentId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info(`Creating new graph component ${componentId}`, {
      initialNodeId,
    });

    const component: GraphComponent = {
      id: componentId,
      nodeCount: 1,
      edgeCount: 0,
      categories: category ? [category] : [],
      representativeNodes: [initialNodeId],
      isActive: true,
    };

    this.components.set(componentId, component);
    this.nodeToComponent.set(initialNodeId, componentId);

    // Update node with component ID
    const node = await this.kgService.getNode(initialNodeId);
    if (node) {
      await this.kgService.updateNode(initialNodeId, {
        graphComponentId: componentId,
      } as any);
    }

    return componentId;
  }

  /**
   * Get the component ID for a specific node
   */
  async getComponentId(nodeId: string): Promise<string | null> {
    return this.nodeToComponent.get(nodeId) || null;
  }

  /**
   * Merge two components when an edge connects them
   */
  async mergeComponents(
    componentId1: string,
    componentId2: string,
  ): Promise<void> {
    if (componentId1 === componentId2) {
      this.logger.warn(
        `Attempted to merge component ${componentId1} with itself`,
      );
      return;
    }

    this.logger.info(
      `Merging graph components ${componentId2} into ${componentId1}`,
    );

    const comp1 = this.components.get(componentId1);
    const comp2 = this.components.get(componentId2);

    if (!comp1 || !comp2) {
      this.logger.error(
        `Cannot merge components: ${componentId1} or ${componentId2} not found`,
      );
      return;
    }

    // Determine which is larger (merge smaller into larger for efficiency)
    const [largerComp, smallerComp, largerCompId, smallerCompId] =
      comp1.nodeCount >= comp2.nodeCount
        ? [comp1, comp2, componentId1, componentId2]
        : [comp2, comp1, componentId2, componentId1];

    // Update all nodes in smaller component to point to larger component
    for (const [nodeId, compId] of this.nodeToComponent.entries()) {
      if (compId === smallerCompId) {
        this.nodeToComponent.set(nodeId, largerCompId);
        // Update node in KG
        const node = await this.kgService.getNode(nodeId);
        if (node) {
          await this.kgService.updateNode(nodeId, {
            graphComponentId: largerCompId,
          } as any);
        }
      }
    }

    // Merge metadata
    const mergedCategories = Array.from(
      new Set([...largerComp.categories, ...smallerComp.categories]),
    );

    const mergedRepNodes = Array.from(
      new Set([
        ...largerComp.representativeNodes,
        ...smallerComp.representativeNodes,
      ]),
    ).slice(0, 10); // Keep max 10 representative nodes

    // Update larger component
    largerComp.nodeCount = largerComp.nodeCount + smallerComp.nodeCount;
    largerComp.edgeCount = largerComp.edgeCount + smallerComp.edgeCount + 1; // +1 for the connecting edge
    largerComp.categories = mergedCategories;
    largerComp.representativeNodes = mergedRepNodes;

    // Mark smaller component as merged
    smallerComp.isActive = false;
    smallerComp.mergedInto = largerCompId;
    smallerComp.lastMerged = new Date();

    this.components.set(largerCompId, largerComp);
    this.components.set(smallerCompId, smallerComp);

    this.logger.info(
      `Successfully merged component ${smallerCompId} into ${largerCompId}`,
    );
  }

  /**
   * Get all active (non-merged) components
   */
  async getDisjointComponents(): Promise<GraphComponent[]> {
    return Array.from(this.components.values())
      .filter((comp) => comp.isActive)
      .sort((a, b) => b.nodeCount - a.nodeCount);
  }

  /**
   * Get component count
   */
  async getComponentCount(): Promise<number> {
    return Array.from(this.components.values()).filter((comp) => comp.isActive)
      .length;
  }

  /**
   * Increment edge count for a component
   */
  async incrementEdgeCount(componentId: string): Promise<void> {
    const comp = this.components.get(componentId);
    if (comp) {
      comp.edgeCount++;
      this.components.set(componentId, comp);
    }
  }

  /**
   * Add a category to a component if not present
   */
  async addCategory(componentId: string, category: string): Promise<void> {
    const comp = this.components.get(componentId);
    if (comp && !comp.categories.includes(category)) {
      comp.categories.push(category);
      this.components.set(componentId, comp);
    }
  }

  /**
   * Get component by ID
   */
  async getComponent(componentId: string): Promise<GraphComponent | null> {
    return this.components.get(componentId) || null;
  }

  /**
   * Update component statistics when nodes/edges change
   */
  async updateComponentStats(componentId: string): Promise<void> {
    const comp = this.components.get(componentId);
    if (!comp) {
      return;
    }

    // Count nodes in this component
    let nodeCount = 0;
    let totalConfidence = 0;
    let researchedCount = 0;

    for (const [nodeId, compId] of this.nodeToComponent.entries()) {
      if (compId === componentId) {
        nodeCount++;
        const node = await this.kgService.getNode(nodeId);
        if (node) {
          totalConfidence += node.confidence || 0.5;
          if (node.researchStatus === 'researched') {
            researchedCount++;
          }
        }
      }
    }

    comp.nodeCount = nodeCount;
    comp.metadata = {
      avgConfidence: nodeCount > 0 ? totalConfidence / nodeCount : 0.5,
      researchProgress: nodeCount > 0 ? researchedCount / nodeCount : 0,
    };

    this.components.set(componentId, comp);
  }
}
