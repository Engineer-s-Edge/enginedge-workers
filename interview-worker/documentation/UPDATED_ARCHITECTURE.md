# Interview Worker - Updated Architecture Based on Requirements

**Date:** October 27, 2025  
**Status:** 🟡 Pending Final Clarifications

---

## Core Architecture Updated

### 1. Question Bank System

#### Question Entity

```typescript
interface Question {
  id: string;
  type: 'behavioral' | 'technical' | 'coding' | 'case-study' | 'system-design' | 'custom';
  
  // The question text
  text: string;
  
  // Tags for categorization (prevents repetitive question selection)
  tags: string[];  // e.g., ["collaboration", "leadership", "communication"]
  
  // Metadata
  difficulty: 'junior' | 'mid' | 'senior' | 'expert';
  category: string;
  version: number;
  
  // Source
  createdBy: string;
  sourceType: 'system' | 'company' | 'custom-user';
  
  // Visibility
  isPublic: boolean;
  companyId?: string;  // If company-specific
  
  createdAt: Date;
  updatedAt: Date;
}

interface QuestionBank {
  id: string;
  companyId?: string;
  
  // Organized by phase type
  behavioral: Question[];
  technical: Question[];
  coding: Question[];
  caseStudy: Question[];
  systemDesign: Question[];
  custom: Question[];
  
  metadata: {
    totalQuestions: number;
    tagDistribution: Map<string, number>;
    lastUpdated: Date;
  };
}
```

#### Question Selection Algorithm

```typescript
/**
 * When recruiter configures interview phase:
 * 
 * 1. They specify:
 *    - Phase type (behavioral, technical, etc.)
 *    - Number of questions (e.g., 4)
 *    - Tags to include (e.g., ["collaboration", "leadership"])
 *    - Tags to exclude (e.g., to avoid repetition)
 * 
 * 2. System selects:
 *    - 1-2 questions per tag if possible
 *    - Ensures diversity (no 15 similar questions)
 *    - Respects difficulty level of interview
 * 
 * 3. LLM gets:
 *    - Selected questions
 *    - Instructions to elaborate and ask follow-ups
 *    - Context about which questions to prioritize
 */
interface PhaseQuestionSelection {
  phaseId: string;
  phaseType: string;
  
  // Configuration
  questionCount: number;  // Total questions for phase
  preferredTags: string[];  // Tags user wants
  excludedTags?: string[];  // Tags to avoid
  
  // What we actually selected
  selectedQuestions: {
    questionId: string;
    text: string;
    tags: string[];
    difficulty: string;
  }[];
  
  // Custom questions user added
  customQuestions: {
    id: string;
    text: string;
    tags: string[];
  }[];
}
```

---

### 2. Interview Phase Configuration (Updated)

#### InterviewPhase Config

```typescript
interface InterviewPhase {
  id: string;
  type: 'behavioral' | 'technical' | 'coding' | 'case-study' | 'system-design' | 'custom';
  order: number;
  
  // Questions for this phase
  questions: PhaseQuestionSelection;
  
  // Timing & Transitions
  transitionConfig: {
    strategy: 'automatic' | 'threshold-based' | 'manual';
    
    // For automatic strategy: LLM decides based on conversation flow
    // For threshold-based strategy:
    timeLimit?: number;  // minutes
    scoreThreshold?: number;  // e.g., 70+
    questionCount?: number;  // Ask N questions then move
    
    // Fallback: if none of above triggers
    maxDuration: number;  // absolute max before forced transition
  };
  
  // Follow-up behavior
  followUpConfig: {
    maxFollowUpsPerQuestion: number;  // e.g., 3
    // Difficulty determines how many follow-ups are asked
    // junior: 0-1 follow-ups per question
    // mid: 1-2 follow-ups
    // senior: 2-3 follow-ups
    // expert: unlimited (as many as agent deems necessary)
  };
  
  // System prompt for this phase
  systemPrompt?: string;  // Can be custom or system-provided
  
  // Resume question config
  resumeQuestionConfig: {
    shouldAskAboutResume: boolean;  // Always true per your requirement
    expectedCount: number;  // Target # of resume questions for this phase
    // Difficulty affects aggressiveness
  };
  
  // Scoring weight for this phase
  scoringWeight: number;  // 0-1, total must = 1 across all phases
}
```

---

### 3. Interview Agent Prompts (Template-Based)

#### System Prompt Architecture

```typescript
/**
 * Interview Agent System Prompt is DYNAMIC based on:
 * - Current phase
 * - Difficulty level
 * - Custom user prompt
 * - Resume context
 * 
 * Structure:
 * 1. Role definition (interviewer)
 * 2. Persona (aggressive vs helpful based on difficulty)
 * 3. Phase-specific instructions
 * 4. Question list and elaboration instructions
 * 5. Resume fact-checking instructions
 * 6. Follow-up guidelines
 * 7. Candidate profiling instructions
 * 8. Response parsing format (follow-up tags)
 */

interface InterviewAgentSystemPrompt {
  // Base role
  roleDefinition: string;
  // "You are a professional interviewer conducting a [difficulty] level interview for a [job-title] position."
  
  // Interviewer persona
  persona: string;
  // For difficulty="expert": "You are skeptical and probe deeply. Trust the candidate's word initially, but verify claims with follow-up questions."
  // For difficulty="junior": "You are supportive and helpful. Trust the candidate and help them succeed."
  
  // Phase-specific context
  phaseContext: string;
  // "You are now in the Behavioral Interview phase. Your goal is to understand the candidate's soft skills..."
  
  // Questions to ask
  questionInstructions: string;
  // "You have these 4 questions to explore. Elaborate on each one, ask natural follow-ups (using <followup> tags), and explore the candidate's thinking. Don't ask the question verbatim - make it conversational."
  
  // Resume instructions
  resumeInstructions: string;
  // "The candidate's resume claims [X]. Throughout this phase, ask 2-3 questions to verify/understand this claim. Be [aggressive/supportive] in your probing based on difficulty level."
  
  // Follow-up format
  followUpFormat: string;
  // "When asking a follow-up question, wrap it in <followup>question-id</followup> tags. Follow-ups don't count as separate questions. Max 3 follow-ups per question."
  
  // Profiling instructions
  profilingInstructions: string;
  // "As the candidate answers, build your understanding of them. Notice: strengths, concerns, areas that conflict with resume, red flags, green flags. This will be used to build their profile."
  
  // Transition instructions (if using automatic strategy)
  transitionInstructions?: string;
  // "After exploring these questions, assess if the candidate's level matches the [difficulty] expectation. If they seem ahead/behind, prepare to transition."
  
  // Custom user prompt (optional)
  customPrompt?: string;
  // User-provided instructions override/extend above
}
```

#### Prompt Generation Function

```typescript
/**
 * Generates system prompt for Interview Agent
 * Called when interview session starts
 */
async generateInterviewAgentPrompt(
  phase: InterviewPhase,
  difficulty: 'junior' | 'mid' | 'senior' | 'expert',
  resume: CandidateResume,
  customPrompt?: string,
): Promise<InterviewAgentSystemPrompt>
```

---

### 4. Follow-Up System with XML Tags

#### Follow-Up Format

```typescript
/**
 * LLM uses XML-style tags to wrap follow-up questions
 * This prevents follow-ups from counting as "new questions"
 */

// Interview Agent Response Example:
`That's an interesting approach! I notice you mentioned using React hooks. 
<followup id="q-001-followup-1">
Could you elaborate on why you chose hooks over class components in that specific scenario?
</followup>

Let me probe into that a bit more to understand your reasoning...
<followup id="q-001-followup-2">
When you say "more readable", what specific aspects made it more readable? Can you give an example?
</followup>`

// Response Parsing:
interface ParsedInterviewResponse {
  mainContent: string;  // Everything outside <followup> tags
  
  followUps: {
    questionId: string;  // e.g., "q-001-followup-1"
    text: string;  // The follow-up question
    sequence: number;  // 1, 2, 3...
  }[];
  
  // Tracking for phase:
  primaryQuestionIndex: number;  // Which main question was answered
  followUpCount: number;  // How many follow-ups in this response
}
```

---

### 5. Candidate Profile - Live Tracking

#### Enhanced CandidateProfile Entity

```typescript
interface CandidateProfile {
  sessionId: string;
  candidateId: string;
  
  // Phase-by-phase observations
  phases: {
    [phaseId: string]: PhaseProfile;
  };
  
  // Overall assessments
  overallAssessments: {
    technicalSkills: number;      // 0-10 (updated per phase)
    softSkills: number;
    communicationClarity: number;
    problemSolvingApproach: number;
    cultureFit: number;
  };
  
  // Observations logged during interview
  observations: ProfileObservation[];
  
  // Structured findings
  strengths: StrengthEntry[];
  concerns: ConcernEntry[];
  
  // Resume verification
  resumeFindings: ResumeFinding[];
  
  // Timeline of events
  timeline: TimelineEvent[];
  
  // Flags
  redFlags: string[];
  greenFlags: string[];
  
  // Last update timestamp
  lastUpdatedAt: Date;
}

interface PhaseProfile {
  phaseId: string;
  phaseName: string;
  startTime: Date;
  endTime?: Date;
  
  // Per-phase tracking
  questionsAnswered: number;
  followUpsAsked: number;
  phaseScore?: number;  // Calculated after phase ends
  
  // Phase-specific observations
  observations: string[];
}

interface ProfileObservation {
  id: string;
  timestamp: Date;
  phaseId: string;
  questionId: string;
  
  observation: string;  // What was observed
  sentiment: 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative';
  confidence: number;  // 0-1
  
  // Categorization
  tags: string[];  // Skill tags, concern tags, etc.
  type: 'strength' | 'concern' | 'neutral-note' | 'resume-related';
}

interface ResumeFinding {
  claim: string;  // What's on resume
  finding: string;  // What was found
  status: 'verified' | 'discrepancy' | 'unverified' | 'contradiction';
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high';  // For discrepancies
}

interface TimelineEvent {
  type: 'phase-transition' | 'pause' | 'skip' | 'question-completed' | 'followup-asked';
  timestamp: Date;
  phaseId?: string;
  questionId?: string;
  duration?: number;  // For pauses
  reason?: string;  // "candidate-requested", "system", "timeout"
}
```

---

### 6. Pause & Skip Tracking

#### Configuration

```typescript
interface PauseAndSkipConfig {
  // Pause settings
  pauseAllowed: boolean;
  pauseRecordingThreshold: number;  // Seconds (e.g., 30) - pauses over this are recorded
  maxPauseDuration?: number;  // Optional: max pause length
  pauseWarningThreshold?: number;  // Warn when approaching max
  
  // Skip settings
  skipAllowed: boolean;
  maxSkipsPerPhase?: number;  // Optional: limit skips
  
  // Impact on report
  trackSkipsInReport: boolean;  // Always true
  trackPausesInReport: boolean;  // Always true
  considerInEvaluation: boolean;  // Evaluator LLM factors this in
}
```

#### Recording Pause/Skip Events

```typescript
interface PauseEvent {
  type: 'pause';
  timestamp: Date;
  duration: number;  // seconds
  reason: 'candidate-requested' | 'timeout-warning' | 'technical-issue';
  recordInReport: boolean;  // If duration > threshold
}

interface SkipEvent {
  type: 'skip';
  timestamp: Date;
  questionId: string;
  reason: 'candidate-elected' | 'time-limit-reached';
  recordInReport: boolean;  // Always true
}
```

---

### 7. Evaluator LLM Call (Separate Simple Call)

#### Final Evaluation Service

```typescript
/**
 * Called AFTER interview completes
 * Simple LLM call (no agent orchestration)
 * Reads full context and generates report
 */

interface EvaluationInput {
  // Full conversation transcript
  conversationHistory: Array<{
    role: 'candidate' | 'agent' | 'system';
    message: string;
    timestamp: Date;
  }>;
  
  // Candidate profile built during interview
  candidateProfile: CandidateProfile;
  
  // Metadata
  difficulty: 'junior' | 'mid' | 'senior' | 'expert';
  phases: string[];  // Phase names
  duration: number;  // Total interview duration in minutes
  
  // Candidate resume (for context)
  resumeText?: string;
}

interface EvaluationOutput {
  // Scoring
  overallScore: number;  // 0-100
  perPhaseScores?: {
    [phaseName: string]: number;  // 0-100 per phase
  };
  
  // Recommendation
  recommendation: 'strong-pass' | 'pass' | 'borderline' | 'weak-pass' | 'fail';
  recommendationRationale: string;
  
  // Feedback
  strengths: {
    title: string;
    description: string;
    evidence: string;
  }[];
  
  areasForImprovement: {
    title: string;
    description: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  
  // Specific observations
  keyObservations: string[];
  
  // Pause/skip consideration
  pauseSkipFeedback?: string;
  
  // If applicable
  resumeDiscrepancies?: {
    claim: string;
    finding: string;
    concern: string;
  }[];
  
  // Summary
  overallSummary: string;  // 1-2 paragraph summary
}

interface InterviewReport {
  sessionId: string;
  candidateId: string;
  interviewId: string;
  
  // Core evaluation
  evaluation: EvaluationOutput;
  
  // Metadata
  createdAt: Date;
  duration: number;  // minutes
  phasesSCompleted: string[];
  
  // Candidate profile
  candidateProfile: CandidateProfile;
  
  // Full transcript
  transcript: string;
  
  // Recording info (if applicable)
  recordingUrl?: string;
  recordingDuration?: number;
}
```

#### Evaluator Prompt Template

```typescript
const EVALUATOR_PROMPT = `
You are an expert hiring manager evaluating a completed interview.

Interview Details:
- Difficulty Level: ${difficulty}
- Phases Completed: ${phases.join(', ')}
- Total Duration: ${duration} minutes
- Pauses/Skips Noted: ${timeline.filter(e => ['pause', 'skip'].includes(e.type)).length} events

You have the following inputs:
1. Full conversation transcript
2. Candidate profile (observations, strengths, concerns, flags)
3. Resume (if provided)

Your task:
1. Review all inputs holistically
2. Score the candidate 0-100 considering:
   - Technical competency (if technical phase)
   - Communication and clarity
   - Problem-solving approach
   - Cultural fit signals
   - Preparation and professionalism
   - Resume alignment
   - Consistency of claims
3. Provide balanced feedback:
   - 2-3 genuine strengths with evidence
   - 2-3 areas for improvement with specific suggestions
   - Key observations that distinguish this candidate
4. Make hiring recommendation:
   - Strong Pass: Clear hire, exceeds expectations
   - Pass: Good fit, meets expectations
   - Borderline: Has potential but some concerns
   - Weak Pass: Could work but significant concerns
   - Fail: Not a fit for this role
5. If pauses/skips noted, factor into feedback:
   - Pauses might indicate nervousness, thinking time, or lack of preparation
   - Skips might indicate lack of knowledge, overconfidence, or pressure

Provide output as JSON with structure defined in EvaluationOutput interface.
`;
```

---

### 8. Recording & Transcription Strategy (Recommendation)

#### Hybrid Storage Approach

```typescript
interface InterviewRecording {
  sessionId: string;
  
  // Transcript (PERMANENT - stored in MongoDB)
  transcript: {
    text: string;  // Full text transcript
    createdAt: Date;
    
    // Timestamps for each speaker turn
    turns: {
      speaker: 'candidate' | 'agent';
      text: string;
      startTime: number;  // seconds from start
      endTime: number;
      confidence?: number;  // For candidate speech-to-text
    }[];
  };
  
  // Audio (TEMPORARY - stored in S3, deleted after retention period)
  audio?: {
    s3Url: string;
    format: 'mp3' | 'wav' | 'opus';
    duration: number;  // seconds
    uploadedAt: Date;
    retentionUntil: Date;  // Calculated from retention policy
    
    // Metadata
    sampleRate: number;
    channels: number;
  };
  
  // Metadata (PERMANENT - MongoDB)
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    audioProvider: 'google' | 'azure' | 'aws';
    sttProvider: 'google' | 'azure' | 'aws';
    ttsProvider: 'google' | 'azure' | 'aws';
    hasAudioFile: boolean;
    transcriptConfidence: number;  // Average confidence of STT
  };
  
  // Status tracking
  processingStatus: 'pending' | 'in-progress' | 'complete' | 'failed';
  processingErrors?: string[];
}
```

#### Retention Policy

```typescript
// Configuration
interface RecordingRetentionPolicy {
  // How long to keep audio files before deletion
  audioRetentionDays: number;  // e.g., 180 days (6 months)
  
  // How long to keep transcripts
  transcriptRetentionDays: number;  // e.g., -1 (forever)
  
  // How long to keep full reports
  reportRetentionDays: number;  // e.g., -1 (forever)
  
  // Automatic cleanup job
  enableAutoCleanup: boolean;
  cleanupSchedule: string;  // Cron expression
}
```

---

### 9. Candidate UX During Interview (Recommendation)

#### Visibility Options

```typescript
interface CandidateUIConfig {
  // What candidate sees during interview
  showAgentQuestion: boolean;  // Always true
  showRealTimeTranscript: boolean;  // Show candidate's spoken/typed text as it appears
  showAgentTranscript: boolean;  // Show agent's responses in text form
  showScore: boolean;  // Show running score? (recommended: false)
  showPhaseProgress: boolean;  // Show "Phase 2 of 3"? (recommended: false to reduce pressure)
  showTimer: boolean;  // Show time remaining? (recommended: false)
}

// My Recommendation:
const RECOMMENDED_UI_CONFIG: CandidateUIConfig = {
  showAgentQuestion: true,
  showRealTimeTranscript: true,  // Candidate can see their response being transcribed
  showAgentTranscript: true,  // Candidate can see agent's question in text
  showScore: false,  // No pressure during interview
  showPhaseProgress: false,  // Fewer distractions
  showTimer: false,  // Less anxiety
};
```

---

### 10. Multi-Tenancy Recommendation

#### MVP Approach (No Company Isolation)

For the initial implementation, I recommend **Option A: Shared Resources**

```typescript
// All users/companies share:
// - Same question banks
// - Same interview templates library
// - Same scoring rubrics
// - Same phase types

// BUT we design with future isolation in mind:
// - Questions have optional `companyId` field
// - Interviews have optional `companyId` field
// - Filter queries include `companyId` when present

// Future: When you want multi-tenancy:
// 1. Add `companyId` requirement
// 2. Update all filters to scope by company
// 3. Add company admin endpoints
```

---

## Summary: Updated Architecture

| Component | Status | Notes |
|-----------|--------|-------|
| **Question Bank** | ✅ Designed | Tags-based selection, 1-2 per type |
| **Phase Configuration** | ✅ Designed | Transition strategies, follow-up limits |
| **Interview Agent** | 🟡 Awaiting | Custom prompts, dual memory |
| **Follow-up System** | ✅ Designed | XML tags, configurable limits |
| **Candidate Profile** | ✅ Designed | Live tracking, phase-based |
| **Pause/Skip Tracking** | ✅ Designed | Recording threshold configurable |
| **Evaluator LLM** | ✅ Designed | Simple call post-interview |
| **Recording/Transcription** | ✅ Designed | Hybrid (transcripts forever, audio 6mo) |
| **Candidate UX** | ✅ Designed | Real-time transcript, no scoring display |
| **Multi-Tenancy** | ✅ Designed | MVP: shared, future-proof for isolation |

---

## What's Still Pending

See `CLARIFICATIONS_NEEDED.md` for the 12 remaining questions that will finalize:

1. Question tag categories
2. Scoring structure (per-phase vs single)
3. Pass/fail thresholds
4. Candidate profile detail level
5. Resume question integration
6. Recruiter dashboard requirements
7. Company isolation scope
8. Recording storage decisions
9. Candidate UI visibility
10. Follow-up tag metadata
11. Pause handling details
12. Phase transition details

**Once these 12 are answered, we're ready to implement.**
