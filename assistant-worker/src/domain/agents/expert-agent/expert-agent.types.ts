/**
 * Expert Agent - Type Definitions
 *
 * Defines types for multi-phase research with exploration,
 * analysis, and synthesis capabilities
 */

/**
 * Research phases
 */
export enum ResearchPhase {
  EXPLORATION = 'exploration',
  ANALYSIS = 'analysis',
  SYNTHESIS = 'synthesis',
  COMPLETE = 'complete',
}

/**
 * Source credibility score
 */
export enum SourceCredibility {
  HIGHLY_TRUSTED = 5,
  TRUSTED = 4,
  NEUTRAL = 3,
  QUESTIONABLE = 2,
  UNRELIABLE = 1,
}

/**
 * Research source
 */
export interface ResearchSource {
  id: string;
  url: string;
  title: string;
  author?: string;
  publishDate?: Date;
  content: string;
  credibilityScore?: SourceCredibility;
  evaluationNotes?: string;
}

/**
 * Topic to explore
 */
export interface ResearchTopic {
  id: string;
  query: string;
  category?: string;
  priority?: number;
  status: 'pending' | 'in-progress' | 'completed';
}

/**
 * Evidence entry
 */
export interface EvidenceEntry {
  id: string;
  sourceId: string;
  topicId?: string;
  claim: string;
  supportingText: string;
  qualityScore: number; // 0-100
  contradicts?: string[]; // IDs of contradictory evidence
  tags?: string[];
}

/**
 * Contradiction between evidence
 */
export interface Contradiction {
  id: string;
  evidenceId1: string;
  evidenceId2: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
}

/**
 * Result of a single research phase
 */
export interface PhaseResult {
  phase: ResearchPhase;
  startTime: Date;
  endTime: Date;
  duration: number;
  itemsProcessed: number;
  success: boolean;
  details: Record<string, unknown>;
}

/**
 * Expert agent state
 */
export interface ExpertAgentState {
  researchPhase: ResearchPhase;
  topics: readonly ResearchTopic[];
  sources: readonly ResearchSource[];
  evidence: readonly EvidenceEntry[];
  contradictions: readonly Contradiction[];
  phaseResults: readonly PhaseResult[];
  synthesisNotes?: string;
  finalReport?: ResearchReport;
  currentTopicIndex: number;
}

/**
 * Research report
 */
export interface ResearchReport {
  id: string;
  title: string;
  abstract: string;
  topics: ResearchTopic[];
  keyFindings: string[];
  evidence: EvidenceEntry[];
  contradictions: Contradiction[];
  conclusions: string;
  recommendations?: string;
  generatedAt: Date;
  sourceCount: number;
  evidenceCount: number;
  confidence: number; // 0-100
}

/**
 * Exploration result
 */
export interface ExplorationResult {
  queriesGenerated: number;
  sourcesFound: number;
  documentsCollected: number;
  duration: number;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  sourcesEvaluated: number;
  evidenceExtracted: number;
  contradictionsFound: number;
  averageQuality: number;
  duration: number;
}

/**
 * Synthesis result
 */
export interface SynthesisResult {
  argumentsBuilt: number;
  conclusionsDrawn: string[];
  reportGenerated: boolean;
  reportLength: number;
  duration: number;
}

/**
 * Complete research result
 */
export interface ResearchResult {
  status: 'success' | 'partial' | 'failed';
  report: ResearchReport;
  explorationResult: ExplorationResult;
  analysisResult: AnalysisResult;
  synthesisResult: SynthesisResult;
  totalDuration: number;
  phasesCompleted: ResearchPhase[];
}

/**
 * State update for streaming research
 */
export interface ExpertStateUpdate {
  type:
    | 'phase_started'
    | 'topic_explored'
    | 'source_found'
    | 'source_evaluated'
    | 'evidence_extracted'
    | 'contradiction_found'
    | 'synthesis_started'
    | 'conclusion_drawn'
    | 'report_generated'
    | 'phase_completed'
    | 'research_completed';
  timestamp: Date;
  phase: ResearchPhase;
  details: Record<string, unknown>;
  // StateUpdate compat fields
  state: string;
  agent_id: string;
  data: Record<string, unknown>;
}
