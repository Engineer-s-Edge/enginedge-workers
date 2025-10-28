# Interview Worker - Comprehensive Design Document

**Date:** October 27, 2025  
**Status:** ✅ FINALIZED (All Clarifications Resolved)  
**Version:** 1.0 (Production Ready)

> **Purpose:** This document defines the complete technical specification for the Interview Worker. It serves as a blueprint that even a less experienced developer can follow to implement this feature.
>
> **CRITICAL:** This is a **PRACTICE TOOL** for candidates to prepare for interviews, NOT a production hiring system. See IMPLEMENTATION_GUIDE.md for current implementation details.

---

## 📋 Table of Contents

1. [Executive Overview](#executive-overview)
2. [Architecture Foundation](#architecture-foundation)
3. [Core Domain Model](#core-domain-model)
4. [Interview Agent (New Agent Type)](#interview-agent-new-agent-type)
5. [Interview Flow & State Machine](#interview-flow--state-machine)
6. [Candidate Memory & Profiling System](#candidate-memory--profiling-system)
7. [Speech & Voice Integration](#speech--voice-integration)
8. [Multi-User Concurrency](#multi-user-concurrency)
9. [Integration with Assistant Worker](#integration-with-assistant-worker)
10. [API Endpoints & WebSocket](#api-endpoints--websocket)
11. [Kafka Events](#kafka-events)
12. [Configuration & Extensibility](#configuration--extensibility)
13. [Implementation Checklist](#implementation-checklist)
14. [Questions for Clarification](#questions-for-clarification)

---

## Executive Overview

### What the Interview Worker Does

The Interview Worker is a specialized NestJS service that orchestrates **dynamic, multi-modal practice interviews** with candidates. This is a PRACTICE TOOL for candidate interview preparation, not production hiring. It:

- **Configurable Interview Flows**: Users configure interview phases (behavioral, technical, system-design, coding) that candidates practice
- **Natural Conversation**: Uses real-time voice/speech-to-text, LLM-powered questions, and text-to-speech responses
- **Live Profiling**: Builds a live "Candidate Profile" tracking observations, strengths, concerns, and resume findings
- **Hyper-Flexible**: Every aspect configurable (difficulty, prompts, question sources, etc.)
- **Multi-Candidate Support**: Handles multiple concurrent practice interviews without interference
- **Feedback Focused**: Produces detailed feedback reports for candidate learning, NOT hiring decisions

### NOT What This Is

❌ Production hiring system  
❌ Recruiter decision tool  
❌ Company integration platform  
❌ Multi-tenant SaaS service

### Key Differentiators

| Feature | Description |
|---------|-------------|
| **Configurable Difficulty** | Same interview template with easy/medium/hard/custom prompts |
| **Candidate Profile** | Memory system tracking strengths, concerns, resume alignment, key insights |
| **Voice-First** | Native speech support (both directions) with text fallback |
| **Tool-Based Profile** | Agent uses tool calls (append, recall) to build profile organically |
| **Prompt-Driven Behavior** | User provides prompts that control agent behavior entirely (not hiring decisions) |

---

## Architecture Foundation

### Hexagonal Architecture (Ports & Adapters)

The Interview Worker follows strict hexagonal architecture principles:

```
┌─────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE                     │
│  (Controllers, External Services, Adapters)         │
│  ├── HTTP Controllers (REST endpoints)              │
│  ├── WebSocket Handler (real-time voice)            │
│  ├── External Adapters (LLM, Speech APIs)          │
│  └── Persistence (MongoDB repositories)             │
└─────────────────────────────────────────────────────┘
              ↕ (Dependency Injection)
┌─────────────────────────────────────────────────────┐
│                   APPLICATION                        │
│  (Use Cases, Orchestration, Business Logic)         │
│  ├── Interview Use Cases                            │
│  │   ├── StartInterview                             │
│  │   ├── SubmitResponse                             │
│  │   ├── AnalyzeResponse                            │
│  │   └── GenerateReport                             │
│  ├── Interview Agent Service                        │
│  ├── Candidate Profiling Service                    │
│  └── Interview State Machine                        │
└─────────────────────────────────────────────────────┘
              ↕ (Dependency Inversion)
┌─────────────────────────────────────────────────────┐
│                     DOMAIN                           │
│  (Pure Business Logic, Independent)                 │
│  ├── Entities                                       │
│  │   ├── Interview                                  │
│  │   ├── InterviewSession                           │
│  │   ├── Candidate                                  │
│  │   ├── CandidateProfile                           │
│  │   ├── InterviewQuestion                          │
│  │   └── InterviewResponse                          │
│  ├── Value Objects                                  │
│  │   ├── InterviewConfig                            │
│  │   ├── CandidateScore                             │
│  │   ├── InterviewState                             │
│  │   └── CandidateProfileEntry                      │
│  ├── Ports (Interfaces)                             │
│  │   ├── IInterviewRepository                       │
│  │   ├── ICandidateRepository                       │
│  │   ├── ILLMProvider                               │
│  │   ├── ISpeechToText                              │
│  │   ├── ITextToSpeech                              │
│  │   ├── IInterviewAgentFactory                     │
│  │   └── IMessageBroker                             │
│  └── Services (Domain Services)                     │
│      ├── InterviewStateMachine                      │
│      ├── CandidateProfileBuilder                    │
│      └── ResponseEvaluator                          │
└─────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Domain Layer (Pure Business Logic)**
- Interview and candidate entities
- Candidate profiling logic
- Interview state transitions
- Response evaluation rules
- No external dependencies (except through ports/interfaces)

**Application Layer (Orchestration)**
- Interview workflows (start, submit answer, analyze, finish)
- Interview agent service
- Use cases that coordinate domain services
- Request/response transformations
- Business transaction handling

**Infrastructure Layer (External Concerns)**
- HTTP REST controllers
- WebSocket for real-time communication
- MongoDB repositories
- LLM provider adapters (OpenAI, Anthropic, etc.)
- Speech service adapters (Google Speech-to-Text, Azure, etc.)
- Kafka for inter-service communication

---

## Core Domain Model

### Main Entities

#### 1. **Interview Entity**
```typescript
/**
 * Represents the interview template/configuration
 * Can be reused across multiple sessions
 */
interface Interview {
  id: string;
  createdBy: string;  // User/Recruiter ID
  name: string;
  description: string;
  
  // Interview configuration
  config: InterviewConfig;
  
  // Interview flow definition
  phases: InterviewPhase[];  // Ordered list of phases
  
  // Difficulty level affects questioning approach
  difficulty: 'junior' | 'mid' | 'senior' | 'expert' | 'custom';
  
  // Scoring rubric
  scoringRubric: ScoringRubric;
  
  // Optional: resume file for reference context
  resumeUrl?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2. **InterviewPhase**
```typescript
/**
 * A phase is a section of the interview
 * Can be Behavioral, Technical, CodingChallenge, etc.
 */
interface InterviewPhase {
  id: string;
  type: 'behavioral' | 'technical' | 'coding' | 'case-study' | 'system-design' | 'custom';
  order: number;
  
  // Phase-specific config
  phaseConfig: {
    duration?: number;  // minutes
    numQuestions?: number;
    questionSources?: string[];  // IDs of question banks or external sources
    followUpStrategy?: 'aggressive' | 'moderate' | 'minimal';
    autoTransition?: boolean;  // Auto move to next phase?
    transitionTrigger?: 'time' | 'score' | 'manual' | 'automatic';
  };
  
  // Prompts for the agent in this phase
  systemPrompt: string;
  contextInstructions?: string;
  
  scoringWeight: number;  // 0-1, total must = 1 across phases
}
```

#### 3. **InterviewSession Entity**
```typescript
/**
 * Represents an actual running interview with a candidate
 * One interview template can have multiple sessions
 */
interface InterviewSession {
  id: string;
  interviewId: string;  // Template reference
  candidateId: string;
  
  // Session state
  status: 'scheduled' | 'in-progress' | 'paused' | 'completed' | 'failed' | 'cancelled';
  
  // Timing
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Current state during interview
  currentPhaseIndex: number;
  currentQuestionIndex: number;
  
  // The live candidate profile (built during interview)
  candidateProfile: CandidateProfile;
  
  // All questions and responses
  responses: InterviewResponse[];
  
  // Scores per phase and overall
  scores: Map<string, number>;  // phaseId -> score
  overallScore?: number;
  
  // Metadata
  userId: string;  // User who created this session
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4. **Candidate Entity**
```typescript
/**
 * Candidate profile - basic information
 */
interface Candidate {
  id: string;
  
  // Basic info
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  
  // Career info
  yearsOfExperience?: number;
  currentRole?: string;
  targetRole?: string;
  skills?: string[];
  
  // History
  previousInterviews?: string[];  // Interview IDs
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5. **CandidateProfile Entity** (CRITICAL - LIVE DURING INTERVIEW)
```typescript
/**
 * Live profile built DURING the interview
 * Tracks interviewer's observations, concerns, follow-ups, etc.
 * Special memory system for the Interview Agent
 */
interface CandidateProfile {
  sessionId: string;
  candidateId: string;
  
  // Core observations
  observations: ProfileObservation[];
  
  // Structured tracking
  strengths: StrengthEntry[];
  concerns: ConcernEntry[];
  followUpQuestions: FollowUpEntry[];
  reasoningNotes: ReasoningNote[];
  
  // Running assessment
  currentAssessment: {
    technicalSkills: number;      // 0-10
    communicationSkills: number;   // 0-10
    cultureFit: number;            // 0-10
    professionalMaturity: number;   // 0-10
    problemSolving: number;        // 0-10
  };
  
  // Flags
  redFlags: string[];
  greenFlags: string[];
  questionsAboutResume?: string[];
  
  // Metadata
  createdAt: Date;
  lastUpdatedAt: Date;
}

interface ProfileObservation {
  timestamp: Date;
  phase: string;
  questionId: string;
  observation: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;  // 0-1
}

interface StrengthEntry {
  skill: string;
  evidence: string;  // Quote or observation
  confidence: number;
}

interface ConcernEntry {
  issue: string;
  evidence: string;
  severity: 'low' | 'medium' | 'high';
}

interface FollowUpEntry {
  question: string;
  reason: string;
  suggestedTiming: 'now' | 'next-phase' | 'end-of-interview';
}

interface ReasoningNote {
  topic: string;
  note: string;
  timestamp: Date;
}
```

#### 6. **InterviewResponse Entity**
```typescript
/**
 * Represents a question-answer pair during the interview
 */
interface InterviewResponse {
  id: string;
  sessionId: string;
  questionId: string;
  
  // The question asked
  question: string;
  
  // Candidate's response (can be audio transcript or text)
  responseText: string;
  responseAudioUrl?: string;
  
  // Analysis
  score: number;  // 0-10 or 0-100 depending on rubric
  feedback: string;
  strengths: string[];
  improvements: string[];
  
  // Metadata
  answerTime: number;  // seconds
  timestamp: Date;
  llmModel: string;  // Which LLM did the analysis
}
```

### Value Objects

#### InterviewConfig
```typescript
interface InterviewConfig {
  maxDuration: number;  // total minutes
  allowedLanguages: string[];  // 'en', 'es', 'fr', etc.
  voiceEnabled: boolean;
  videoEnabled: boolean;
  recordingEnabled: boolean;
  allowCandidateBreaks: boolean;
  breakDurationMin: number;
  breakDurationMax: number;
  
  // Flexibility
  strictMode: boolean;  // If false, can skip questions
  allowGoing Back: boolean;
  
  // Notification settings
  notificationEmail: string;
  notifyOnCompletion: boolean;
}

interface ScoringRubric {
  categories: ScoringCategory[];
  weights: Map<string, number>;  // category -> weight
  passThreshold: number;  // 0-100
  highlightThreshold: number;  // Score to highlight as excellent
}

interface ScoringCategory {
  name: string;
  description: string;
  criteria: string[];
  maxScore: number;
}
```

---

## Interview Agent (New Agent Type)

### Overview

The **Interview Agent** is a new agent type that lives in the **Assistant Worker** but is specialized for conducting interviews. It differs from other agent types:

| Aspect | Other Agents | Interview Agent |
|--------|-------------|-----------------|
| **Interaction Style** | Reasoning chains, tool use | Natural conversation |
| **Memory Type** | Conversation buffer | Dual memory: Conversation + Candidate Profile |
| **I/O** | Text primarily | Voice + Text |
| **Awareness** | Task-focused | Candidate-focused (profiling) |
| **Adaptivity** | Follows tools/functions | Adapts to candidate (difficulty, follow-ups) |
| **Duration** | Variable, task-dependent | Typically 30-60 min fixed |

### Interview Agent Architecture

#### In Assistant Worker (main-node/src/features/assistants/)

1. **InterviewAgentType** (new file)
   ```typescript
   export class InterviewAgent extends BaseAgent {
     // Specialized for interviews
     // Uses dual memory system
     // Handles voice input/output
     // Builds candidate profile
   }
   ```

2. **InterviewAgentFactory** (new file in agent-config-factory.service.ts)
   ```typescript
   // Register in AgentFactory
   createInterviewAgent(config: InterviewAgentConfig): BaseAgent
   ```

3. **AgentTypeRegistry** (modified)
   - Add `'interview'` to supported agent types
   - Route interview requests to InterviewAgent

4. **Memory System** (modified for dual memory)
   - Primary: `ConversationBufferMemory` (normal conversation history)
   - Secondary: `CandidateProfileMemory` (special memory for candidate profiling)
   - Both feeds into the agent's context

#### Key Interview Agent Capabilities

```typescript
/**
 * The Interview Agent should:
 * 
 * 1. Generate Questions
 *    - Based on phase type and difficulty
 *    - Contextually aware of previous answers
 *    - Can follow up on specific topics
 * 
 * 2. Analyze Responses
 *    - Score the answer (0-10)
 *    - Identify strengths/weaknesses
 *    - Flag concerns or follow-up needs
 *    - Update candidate profile
 * 
 * 3. Build Candidate Profile
 *    - Track observations
 *    - Maintain strengths/concerns lists
 *    - Flag red flags or green flags
 *    - Suggest follow-ups
 * 
 * 4. Adapt Questioning
 *    - Adjust difficulty based on performance
 *    - Follow up on weak areas
 *    - Move to next phase based on performance
 * 
 * 5. Generate Real-time Feedback
 *    - Provide immediate feedback on answer quality
 *    - Suggest improvements
 *    - Give encouragement
 * 
 * 6. Produce Final Report
 *    - Summarize candidate profile
 *    - Overall scoring
 *    - Hiring recommendation
 *    - Detailed observations
 */
```

### Interview Agent State Flow

```
┌─────────────────────┐
│  INITIAL_SETUP      │ → Load interview template, candidate resume
└────────────┬────────┘
             ↓
┌─────────────────────┐
│  PHASE_TRANSITION   │ → Move to next phase, set system prompt
└────────────┬────────┘
             ↓
┌─────────────────────┐
│  GENERATE_QUESTION  │ → LLM generates contextual question
└────────────┬────────┘
             ↓
┌─────────────────────┐
│  AWAIT_RESPONSE     │ → Wait for candidate answer (voice or text)
└────────────┬────────┘
             ↓
┌─────────────────────┐
│  TRANSCRIBE         │ → Convert speech to text (if needed)
└────────────┬────────┘
             ↓
┌─────────────────────┐
│  ANALYZE_RESPONSE   │ → Score, extract insights, update profile
└────────────┬────────┘
             ↓
┌─────────────────────┐
│  DECISION_POINT     │ → More questions in phase? Follow-up? Next phase?
└────────┬────────────┘
         ├─ MORE_QUESTIONS → GENERATE_QUESTION
         ├─ FOLLOW_UP → GENERATE_FOLLOWUP
         ├─ NEXT_PHASE → PHASE_TRANSITION
         └─ COMPLETE → GENERATE_REPORT
         
┌─────────────────────┐
│  GENERATE_REPORT    │ → Final candidate profile, scores, recommendation
└────────────┬────────┘
             ↓
┌─────────────────────┐
│  COMPLETED          │ → Interview finished, save results
└─────────────────────┘
```

---

## Interview Flow & State Machine

### Interview Configuration Phase (Before Interview Starts)

User (recruiter) configures interview:

```typescript
{
  // Which phases to include and in what order
  phases: [
    {
      type: 'behavioral',
      order: 1,
      numQuestions: 5,
      followUpStrategy: 'moderate'
    },
    {
      type: 'technical',
      order: 2,
      numQuestions: 4,
      followUpStrategy: 'aggressive'
    },
    {
      type: 'coding',
      order: 3,
      numQuestions: 2,
      autoTransition: false
    }
  ],
  
  // Difficulty level affects agent behavior
  difficulty: 'senior',
  
  // Voice settings
  voiceEnabled: true,
  acceptedLanguages: ['en-US', 'en-GB'],
  
  // Time limits
  maxDuration: 60,
  
  // Scoring
  scoringRubric: { ... }
}
```

### Runtime State Machine

```
CREATED
  ↓
INVITED (interview link sent to candidate)
  ├─ Cancel → CANCELLED
  ├─ Candidate Joins → IN_PROGRESS
  │
  └─ IN_PROGRESS
      ├─ Phase 1: Behavioral Questions
      │   └─ Q1, Q2, Q3, Q4, Q5 + Follow-ups
      ├─ Phase 2: Technical Questions
      │   └─ Q1, Q2, Q3, Q4 + Follow-ups
      ├─ Phase 3: Coding Challenge
      │   └─ Q1, Q2 + Follow-ups
      ├─ Candidate Pauses → PAUSED
      │   └─ Candidate Resumes → IN_PROGRESS
      │
      ↓
COMPLETED
  ├─ Generate Report
  └─ Available for Review

FAILED (unexpected error during interview)
```

### Question Generation Strategy

**For each phase:**

1. **Initial Questions** (scripted or generated)
   - Based on phase type
   - Difficulty-adjusted
   - May reference resume

2. **Adaptive Follow-ups**
   - Agent analyzes responses
   - Identifies gaps or weak areas
   - Generates contextual follow-ups
   - Follow-up intensity depends on `followUpStrategy`

3. **Decision Logic**
   - If score is low → More follow-ups or repeat topic
   - If score is high → Move to next topic
   - Difficulty adjustment based on performance

---

## Candidate Memory & Profiling System

### The Dual Memory Concept

The Interview Agent maintains TWO memories:

```
┌─────────────────────────────────────────────────────────┐
│             Interview Agent Memory System                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. CONVERSATION MEMORY (Standard)                      │
│     ├─ Q: "Tell me about your experience with React"  │
│     └─ A: "I've been using React for 5 years..."      │
│                                                         │
│  2. CANDIDATE PROFILE MEMORY (New - Interview-Specific) │
│     ├─ Strengths                                        │
│     │  └─ "Strong React knowledge, explains well"      │
│     ├─ Concerns                                         │
│     │  └─ "Weak on testing, glossed over unit tests"   │
│     ├─ Follow-ups Needed                               │
│     │  └─ "Ask about testing approach in next phase"   │
│     ├─ Observations                                    │
│     │  └─ "Candidates was nervous but got more      │
│     │      comfortable as interview progressed"        │
│     └─ Reasoning Notes                                │
│        └─ "Resume claims 5yr React, but answers      │
│           suggest 2-3 years of real-world use"        │
└─────────────────────────────────────────────────────────┘
```

### Candidate Profile Building Process

```
┌──────────────────────────────────────────────────────────┐
│  Candidate gives answer to question                      │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  Interview Agent analyzes response with special prompt   │
│  (asks: what are strengths? concerns? follow-ups?)       │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  LLM returns analysis structured for profile:            │
│  {                                                       │
│    strengths: [...],                                    │
│    concerns: [...],                                     │
│    followUpQuestions: [...],                            │
│    reasoningNotes: [...],                               │
│    score: 7,                                            │
│    flags: { red: [], green: ["clear communicator"] }    │
│  }                                                       │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  Profile is updated in memory and persisted:            │
│  ├─ Add to strengths list                              │
│  ├─ Add to concerns list                               │
│  ├─ Add follow-up questions                            │
│  ├─ Update running assessment scores                   │
│  ├─ Add observation timestamp                          │
│  └─ Persist to MongoDB                                 │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  Agent uses updated profile for next decision:           │
│  ├─ Next question harder/easier based on performance?   │
│  ├─ Follow-up on this topic or move ahead?              │
│  ├─ Add note to "questions about resume"?               │
│  └─ Adjust overall assessment                           │
└──────────────────────────────────────────────────────────┘
```

### Profile-Driven Agent Behavior

The agent's behavior adapts based on the profile:

```typescript
// Example: Agent deciding how to proceed after Q1

if (candidateProfile.concerns.length > 3) {
  // Multiple concerns → ask more follow-ups (aggressive mode)
  nextAction = 'FOLLOW_UP_AGGRESSIVE';
} else if (candidateProfile.latestScore > 8) {
  // High score → move forward quickly
  nextAction = 'NEXT_QUESTION';
} else if (difficulty === 'senior' && latestScore < 6) {
  // Senior-level expected but low score → deep dive
  nextAction = 'FOLLOW_UP_AGGRESSIVE';
} else {
  // Standard progression
  nextAction = 'NEXT_QUESTION';
}
```

### Difficulty Modes Impact on Profiling

The same interview template can behave differently based on difficulty:

| Difficulty | Profile Behavior | Follow-up Strategy | Scoring |
|------------|------------------|-------------------|---------|
| **junior** | Relaxed, encouraging | Minimal follow-ups | Lenient scoring |
| **mid** | Balanced | Moderate follow-ups | Standard scoring |
| **senior** | Nitpicky, detailed | Aggressive follow-ups | Strict scoring |
| **expert** | Ultra-detailed | Very aggressive | Very strict |

---

## Speech & Voice Integration

### Requirements

1. **Speech-to-Text (STT)**
   - Real-time transcription of candidate's voice
   - Language support (configurable)
   - Streaming vs batch
   - Timeout if candidate goes silent too long

2. **Text-to-Speech (TTS)**
   - Agent speaks questions to candidate
   - Natural, conversational tone
   - Adjustable speed/pitch
   - Optional: emotion/emphasis

3. **Voice Quality**
   - Echo cancellation
   - Noise reduction
   - VAD (Voice Activity Detection)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Candidate (Browser)                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  WebRTC / WebAudio API                           │  │
│  │  ├─ Capture audio                                │  │
│  │  ├─ Local echo cancellation                      │  │
│  │  └─ Send via WebSocket                           │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────┬─────────────────────────────────┘
                       ↓ WebSocket
        ┌──────────────────────────────────┐
        │   Interview Worker               │
        │   WebSocket Handler              │
        │                                  │
        │  ┌────────────────────────────┐ │
        │  │ Audio Buffer               │ │
        │  └──────────────┬─────────────┘ │
        │                 ↓               │
        │  ┌────────────────────────────┐ │
        │  │ STT Service (Google/Azure) │ │ → Transcript text
        │  └──────────────┬─────────────┘ │
        │                 ↓               │
        │  ┌────────────────────────────┐ │
        │  │ Interview Agent            │ │
        │  │ (analyzes & responds)      │ │
        │  └──────────────┬─────────────┘ │
        │                 ↓               │
        │  ┌────────────────────────────┐ │
        │  │ TTS Service (Google/Azure) │ │ ← Agent response text
        │  └──────────────┬─────────────┘ │
        │                 ↓               │
        │  ┌────────────────────────────┐ │
        │  │ Audio Stream               │ │
        │  └──────────────┬─────────────┘ │
        └──────────────────┼───────────────┘
                           ↓ WebSocket
        ┌──────────────────────────────────┐
        │  Candidate receives audio        │
        │  Plays through speaker/headset   │
        └──────────────────────────────────┘
```

### Ports & Adapters for Speech

**Ports (Interfaces in Domain):**
```typescript
ISpeechToTextProvider {
  transcribe(audioStream: Stream): Promise<string>;
  transcribeWithMetadata(audioStream: Stream): Promise<TranscriptionResult>;
}

ITextToSpeechProvider {
  synthesize(text: string, options?: SynthesisOptions): Promise<AudioStream>;
}
```

**Adapters (Implementations in Infrastructure):**
```typescript
// Google Speech-to-Text Adapter
GoogleSpeechToTextAdapter implements ISpeechToTextProvider

// Azure Speech-to-Text Adapter
AzureSpeechToTextAdapter implements ISpeechToTextProvider

// Google Text-to-Speech Adapter
GoogleTextToSpeechAdapter implements ITextToSpeechProvider

// Azure Text-to-Speech Adapter
AzureTextToSpeechAdapter implements ITextToSpeechProvider
```

### WebSocket Protocol

```typescript
// Client → Server (Candidate speaking)
{
  type: 'audio_chunk',
  sessionId: 'xxx',
  audioData: Base64EncodedBytes,
  timestamp: 1234567890
}

// Server → Client (Agent response)
{
  type: 'agent_response',
  sessionId: 'xxx',
  text: "That's a great answer. Let me follow up...",
  audioUrl: "https://...",  // Pre-generated audio
  nextAction: 'awaiting_response'
}

// Server → Client (Transcription for feedback)
{
  type: 'transcription',
  sessionId: 'xxx',
  transcript: "I worked with React for three years...",
  confidence: 0.95
}
```

---

## Multi-User Concurrency

### Requirement

Multiple candidates can interview simultaneously without interference.

### Implementation Strategy

```
┌─────────────────────────────────────────────────────────┐
│              Interview Worker Service                   │
│                                                         │
│  Session Manager                                       │
│  ├─ SessionID1 → Interview Session Context            │
│  ├─ SessionID2 → Interview Session Context            │
│  ├─ SessionID3 → Interview Session Context            │
│  └─ SessionID4 → Interview Session Context            │
│                                                         │
│  Each session has isolated:                            │
│  ├─ Interview Agent instance                          │
│  ├─ Candidate Profile memory                          │
│  ├─ WebSocket connection                              │
│  ├─ Audio buffer                                       │
│  ├─ State machine                                      │
│  └─ Conversation history                              │
└─────────────────────────────────────────────────────────┘
```

### Key Implementation Points

1. **Session Isolation**
   - Each session has unique ID
   - Own MongoDB session for data
   - Own Interview Agent instance (or thread-safe pool)
   - Separate memory contexts

2. **Resource Management**
   - Session timeout (e.g., 90 minutes)
   - Auto-cleanup on completion
   - Prevent memory leaks from hung sessions
   - Rate limiting per user

3. **NestJS Thread/Async Handling**
   - Async/await throughout
   - No blocking operations
   - Leverage NestJS request context isolation
   - Use AsyncLocalStorage if needed for session context

4. **Database Concurrency**
   - MongoDB transactions for consistency
   - Optimistic locking on responses
   - Atomic updates to candidate profile
   - Connection pooling

---

## Integration with Assistant Worker

### What Changes in Assistant Worker

**1. New Agent Type: InterviewAgent**

```typescript
// File: main-node/src/features/assistants/domain/agents/interview/
// - interview.agent.ts (new)
// - interview-agent-factory.ts (new)
// - interview-agent-config.ts (new)

// Modifications:
// - agent.service.ts: Register 'interview' type
// - agent-config-factory.service.ts: Add InterviewAgentFactory
// - base.agent.ts: Add support for voice I/O (if not already there)
```

**2. Enhanced Agent Factory**

```typescript
// In agent-config-factory.service.ts

getAgentConfig(agentType: string): BaseAgentConfig {
  switch(agentType) {
    case 'react':
      return new ReActAgentConfig();
    case 'graph':
      return new GraphAgentConfig();
    case 'expert':
      return new ExpertAgentConfig();
    case 'genius':
      return new GeniusAgentConfig();
    case 'collective':
      return new CollectiveAgentConfig();
    case 'interview':  // NEW
      return new InterviewAgentConfig();
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

createAgentInstance(agentType: string, config: any): BaseAgent {
  const agentConfig = this.getAgentConfig(agentType);
  
  switch(agentType) {
    case 'interview':  // NEW
      return new InterviewAgent(config, this.llmProvider, this.memoryService);
    // ... other cases
  }
}
```

**3. Voice Support in Base Agent (if needed)**

```typescript
// base.agent.ts modifications

// Add methods for voice I/O
abstract handleVoiceInput(audio: AudioStream): Promise<string>;
abstract synthesizeVoiceOutput(text: string): Promise<AudioStream>;

// Or implement in InterviewAgent specifically
```

**4. Dual Memory System**

```typescript
// New memory type for interviews
// Could extend existing ConversationBufferMemory
// Or create IInterviewMemory with both conversation + profile memory

class InterviewAgentMemory extends ConversationBufferMemory {
  private candidateProfileMemory: CandidateProfile;
  
  // Methods for profile manipulation
  addProfileObservation(obs: ProfileObservation): void;
  updateStrengths(strength: StrengthEntry): void;
  addConcern(concern: ConcernEntry): void;
  // etc.
}
```

**5. System Prompts & Instructions**

```typescript
// New file: main-node/src/features/assistants/infrastructure/prompts/interview-prompts.ts

export const INTERVIEW_AGENT_SYSTEM_PROMPT = `
You are an expert interviewer conducting a ${difficulty} level interview.

Current Phase: ${phase}
Candidate: ${candidateInfo}
Interview Progress: ${progress}

Your responsibilities:
1. Ask clear, contextual questions
2. Listen actively to responses
3. Identify strengths and concerns
4. Build a comprehensive candidate profile
5. Follow up when appropriate
6. Maintain a professional yet conversational tone
7. Track time and pace appropriately

After each answer, analyze:
- Quality of response (technical accuracy, communication clarity)
- Gaps or concerns
- Follow-up needs
- How well it aligns with resume/expectations

Update your understanding of the candidate continuously.
`;

export const BEHAVIORAL_PHASE_PROMPT = `...`;
export const TECHNICAL_PHASE_PROMPT = `...`;
export const CODING_CHALLENGE_PROMPT = `...`;
// etc.
```

**6. API Endpoints (Assistant Worker exposes)**

```typescript
// New in AssistantController

@Post('/interview-agents')
createInterviewAgent(@Body() config: InterviewAgentConfig): Promise<Agent> {
  // Creates and returns interview agent instance
}

@Post('/interview-agents/:id/voice-input')
submitVoiceInput(@Param('id') id: string, @Body() audio: AudioData): Promise<void> {
  // Submits audio from candidate
}

@Get('/interview-agents/:id/status')
getInterviewAgentStatus(@Param('id') id: string): Promise<InterviewAgentStatus> {
  // Returns current state, candidate profile, scores, etc.
}

@Delete('/interview-agents/:id')
completeInterviewAgent(@Param('id') id: string): Promise<InterviewReport> {
  // Finalizes interview, generates report
}
```

---

## API Endpoints & WebSocket

### REST API (Interview Worker)

```typescript
// Interview Management
POST   /interviews                    // Create interview template
GET    /interviews                    // List templates
GET    /interviews/:id                // Get template
PUT    /interviews/:id                // Update template
DELETE /interviews/:id                // Delete template

// Interview Sessions
POST   /sessions                       // Create new session
GET    /sessions/:id                   // Get session details
GET    /sessions/:id/status            // Get current status
POST   /sessions/:id/pause             // Pause interview
POST   /sessions/:id/resume            // Resume interview
POST   /sessions/:id/cancel            // Cancel interview
GET    /sessions/:id/candidate-profile // Get live profile
GET    /sessions/:id/report            // Generate final report
DELETE /sessions/:id                   // Delete session

// Question Bank
POST   /question-banks                 // Create question bank
GET    /question-banks                 // List banks
GET    /question-banks/:id/questions   // Get questions

// Utility
GET    /health                         // Health check
GET    /metrics                        // Prometheus metrics
```

### WebSocket (Real-time Communication)

```typescript
// WebSocket endpoint: ws://localhost:3004/interviews/:sessionId

// Establish connection
{
  action: 'init',
  sessionId: 'xxx',
  candidateId: 'yyy',
  token: 'auth-token'
}

// Subscribe to events
{
  action: 'subscribe',
  event: 'agent_response' | 'transcription' | 'status' | 'score_update'
}

// Submit voice audio chunk
{
  action: 'audio_chunk',
  audioData: Base64String,
  timestamp: 1234567890
}

// Submit text response (if not voice)
{
  action: 'text_response',
  text: "My response to the question...",
  timestamp: 1234567890
}

// Request next question
{
  action: 'next_question'
}

// Mark candidate ready
{
  action: 'candidate_ready'
}
```

---

## Kafka Events

### Topics Published by Interview Worker

```yaml
enginedge.interview.session.created:
  data:
    sessionId: string
    candidateId: string
    interviewId: string
    startedAt: timestamp

enginedge.interview.session.phase_transition:
  data:
    sessionId: string
    phaseId: string
    phaseName: string
    questionsAnswered: number

enginedge.interview.session.question_answered:
  data:
    sessionId: string
    questionId: string
    answerTime: number
    score: number

enginedge.interview.session.profile_updated:
  data:
    sessionId: string
    candidateProfile: CandidateProfile

enginedge.interview.session.completed:
  data:
    sessionId: string
    finalScore: number
    hiringRecommendation: string
    completedAt: timestamp

enginedge.interview.session.failed:
  data:
    sessionId: string
    error: string
    failedAt: timestamp
```

### Topics Consumed by Interview Worker

```yaml
# (None initially, Interview Worker is mostly a producer)
```

---

## Configuration & Extensibility

### Environment Variables

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/enginedge_interview

# LLM Providers
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Speech Services
GOOGLE_SPEECH_API_KEY=...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...

# Kafka
KAFKA_BROKERS=localhost:9092

# Interview Worker
PORT=3004
NODE_ENV=development
LOG_LEVEL=debug

# Voice/Audio
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
AUDIO_ENCODING=LINEAR16

# Timeouts
SESSION_TIMEOUT_MINUTES=90
QUESTION_ANSWER_TIMEOUT_SECONDS=600

# Features
ENABLE_VOICE=true
ENABLE_REAL_TIME_SCORING=true
ENABLE_CANDIDATE_PROFILE=true
```

### Interview Configuration File Format

```json
{
  "name": "Senior Full-Stack Engineer Interview",
  "description": "3-phase interview for full-stack positions",
  "difficulty": "senior",
  "maxDuration": 60,
  "phases": [
    {
      "id": "behavioral-1",
      "type": "behavioral",
      "order": 1,
      "config": {
        "duration": 15,
        "numQuestions": 4,
        "followUpStrategy": "moderate"
      },
      "systemPrompt": "You are conducting a behavioral interview...",
      "scoringWeight": 0.25
    },
    {
      "id": "technical-1",
      "type": "technical",
      "order": 2,
      "config": {
        "duration": 30,
        "numQuestions": 5,
        "followUpStrategy": "aggressive"
      },
      "systemPrompt": "You are conducting a technical interview...",
      "scoringWeight": 0.50
    },
    {
      "id": "coding-1",
      "type": "coding",
      "order": 3,
      "config": {
        "duration": 15,
        "numQuestions": 1,
        "followUpStrategy": "minimal"
      },
      "systemPrompt": "The candidate will solve a coding problem...",
      "scoringWeight": 0.25
    }
  ],
  "scoringRubric": { ... }
}
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure (Week 1-2)

- [ ] Interview Worker scaffold
  - [ ] Domain module with entities
  - [ ] Application module with services
  - [ ] Infrastructure module with controllers
  - [ ] MongoDB repository setup
  
- [ ] Domain Entities
  - [ ] Interview entity
  - [ ] InterviewSession entity
  - [ ] Candidate entity
  - [ ] CandidateProfile entity
  - [ ] InterviewResponse entity
  - [ ] Value objects (InterviewConfig, ScoringRubric, etc.)

- [ ] Interview Repositories
  - [ ] Interview repository
  - [ ] InterviewSession repository
  - [ ] Candidate repository

- [ ] Basic Controller
  - [ ] POST /interviews (create)
  - [ ] GET /interviews (list)
  - [ ] GET /interviews/:id (get)

- [ ] Tests
  - [ ] Entity tests
  - [ ] Repository tests
  - [ ] Controller tests

### Phase 2: Interview State Machine (Week 2-3)

- [ ] State Machine Implementation
  - [ ] Interview session states
  - [ ] State transitions
  - [ ] Phase transitions
  
- [ ] Question Management
  - [ ] Question generation service
  - [ ] Question bank integration
  - [ ] Difficulty-based question selection

- [ ] Response Processing
  - [ ] Response submission handling
  - [ ] Response analysis pipeline
  - [ ] Scoring logic

### Phase 3: Candidate Profiling (Week 3-4)

- [ ] Candidate Profile Memory
  - [ ] Profile entity implementation
  - [ ] Profile observation tracking
  - [ ] Strength/concern tracking
  - [ ] Follow-up question tracking

- [ ] Profile Building Service
  - [ ] Profile updates from responses
  - [ ] Profile query/retrieval
  - [ ] Profile persistence

- [ ] Interview Agent Integration (in Assistant Worker)
  - [ ] Create InterviewAgent class
  - [ ] Dual memory system
  - [ ] Profile building prompts

### Phase 4: Speech & Voice Integration (Week 4-5)

- [ ] Speech-to-Text Service
  - [ ] Google STT adapter
  - [ ] Azure STT adapter (optional)
  - [ ] Audio chunking/buffering
  - [ ] Transcription result processing

- [ ] Text-to-Speech Service
  - [ ] Google TTS adapter
  - [ ] Azure TTS adapter (optional)
  - [ ] Audio stream generation
  - [ ] Voice synthesis options

- [ ] WebSocket Handler
  - [ ] WebSocket connection management
  - [ ] Audio chunk reception
  - [ ] Response transmission
  - [ ] Session state management over WebSocket

- [ ] Audio Utilities
  - [ ] Audio encoding/decoding
  - [ ] VAD (voice activity detection)
  - [ ] Echo cancellation setup

### Phase 5: Interview Agent (Week 5-6)

- [ ] In Assistant Worker (main-node)
  - [ ] Create InterviewAgent class
  - [ ] Register in AgentFactory
  - [ ] Interview-specific system prompts
  - [ ] Interview memory management
  - [ ] Voice I/O support in base agent

- [ ] Interview-Specific Prompts
  - [ ] Behavioral phase prompts
  - [ ] Technical phase prompts
  - [ ] Coding challenge prompts
  - [ ] Follow-up prompts
  - [ ] Analysis/profiling prompts
  - [ ] Report generation prompts

- [ ] Integration Points
  - [ ] Interview Worker ↔ Assistant Worker communication
  - [ ] Shared memory formats
  - [ ] Agent lifecycle hooks

### Phase 6: API & WebSocket (Week 6-7)

- [ ] REST API Completion
  - [ ] All CRUD endpoints
  - [ ] Session lifecycle endpoints
  - [ ] Report generation
  - [ ] Question bank management

- [ ] WebSocket Protocol
  - [ ] Connection initialization
  - [ ] Audio streaming protocol
  - [ ] Event subscription/publishing
  - [ ] Real-time status updates

- [ ] Error Handling
  - [ ] Audio errors
  - [ ] Session timeout handling
  - [ ] Network interruption recovery

### Phase 7: Multi-User Concurrency (Week 7)

- [ ] Session Management
  - [ ] Session isolation
  - [ ] Concurrent session handling
  - [ ] Session cleanup

- [ ] Resource Management
  - [ ] Memory limits per session
  - [ ] Connection pooling
  - [ ] Rate limiting

- [ ] Testing
  - [ ] Concurrent session tests
  - [ ] Load testing
  - [ ] Resource leak detection

### Phase 8: Kafka Integration (Week 8)

- [ ] Event Publishing
  - [ ] Session created event
  - [ ] Phase transition event
  - [ ] Question answered event
  - [ ] Profile updated event
  - [ ] Session completed event

- [ ] Event Consumers
  - [ ] (None initially, or integration with other workers)

- [ ] Dead Letter Queue
  - [ ] Failed event handling
  - [ ] Retry logic

### Phase 9: Final Integration & Polish (Week 8-9)

- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Error handling review
- [ ] Security review
- [ ] Deployment setup

---

## Questions for Clarification - UPDATED WITH ANSWERS

### ✅ ANSWERED

**1. Question Selection & Elaboration**
- ✅ **Question Bank Approach**: Users select 1-2 questions per "type" from extensive question bank
- ✅ **Question Tags**: Questions need tags to prevent repetitive questions (e.g., behavioral phase can't have 15 similar collaboration questions)
- ✅ **LLM Elaboration**: LLM sees selected questions and elaborates/asks contextual follow-ups about them
- ✅ **Custom Questions**: Users can input their own custom questions
- **📌 NEED TAG CATEGORIES**: What should the question tags be? Examples:
  - **Behavioral Tags**: `collaboration`, `conflict-resolution`, `leadership`, `failure-handling`, `learning-from-mistakes`, `communication`, `adaptability`, `initiative`, `teamwork`, `time-management`, `stress-handling`?
  - **Technical Tags**: `system-design`, `architecture`, `databases`, `apis`, `scalability`, `debugging`, `performance`, `testing`, `security`, `design-patterns`?
  - **Coding Tags**: `data-structures`, `algorithms`, `complexity`, `edge-cases`, `problem-solving`, `code-quality`?

**2. Difficulty-Based Interviewer Personas & Prompts**
- ✅ **Persona Variations**: Interviewer behavior changes by difficulty
  - Relaxed/Helpful: Trust answers, help candidate succeed
  - Aggressive/Interrogator: Probe deeply, fact-check claims, look for inconsistencies
- ✅ **Custom Prompts**: Users can enter CUSTOM system prompts when defining interview
- ✅ **Resume in Prompts**: Every prompt must specify LLM should ask resume questions
- ✅ **Difficulty-Driven Resume Depth**:
  - Junior: Light resume verification, trust claims
  - Senior/Expert: Deep fact-checking, probe claims, verify experience consistency

**3. Question Thresholds & Natural Transitions**
- ✅ **Hybrid Approach**: 
  - LLM can naturally decide to move on based on conversation flow
  - OR use configurable thresholds (time, score, question-count)
  - Both should be options per phase
  - Config example: `transitionStrategy: 'automatic' | 'threshold-based'` with fallbacks

**4. Follow-up System (XML-style Tags)**
- ✅ **Tag Format**: `<followup>question-id</followup>` or similar XML wrapping
- ✅ **Behavior**: Follow-ups don't count as separate questions (don't increment question counter)
- ✅ **Configurable Limits**: Max follow-ups per question (e.g., max 3) - configurable per phase
- ✅ **Difficulty-Driven**: Difficult prompts specify "dig deeper, ask more follow-ups"
- ✅ **Custom Prompt Integration**: Users specify follow-up strategies in custom prompts
- **📌 CLARIFICATION**: Should follow-ups also be tagged with difficulty level? (e.g., `<followup-difficulty>senior</followup-difficulty>`)

**5. Final Report & Scoring**
- ✅ **Report Components**:
  - Score out of 100
  - Comprehensive feedback (strengths, areas to improve, specific examples)
  - Generated via separate evaluator LLM call
- ✅ **Evaluator Input**: Simple, non-agentic call with:
  - Full conversation history
  - Candidate profile memory (observations, concerns, strengths, flags)
  - Pauses/skips events
- ✅ **Evaluator Prompt**: Reads all context and provides balanced feedback
- **📌 CLARIFICATIONS**:
  - Should score be single 0-100 or broken down by skill/phase?
  - Should there be hiring recommendation (Strong Pass / Pass / Borderline / Weak Pass / Fail)?
  - Should interview have pass/fail threshold (e.g., 70+ = Pass)?

**6. Candidate Profile Content (Concise but Complete)**
- ✅ **Principle**: Concise summary, not full conversation log
- **📌 MY PROPOSAL** (please validate):
  - **Observations**: List of key observations with phase/timestamp/sentiment
  - **Strengths**: Skills demonstrated with evidence quotes
  - **Concerns**: Issues identified with severity and evidence
  - **Resume Notes**: Discrepancies or validations found
  - **Follow-ups Suggested**: Questions agent wanted to ask but didn't have time
  - **Timeline Events**: Pauses > X seconds, skips, phase transitions
  - **Red/Green Flags**: Specific concerns or positive signals
  - **Total Size**: ~2-3 pages of summary (not full transcript)

**7. Resume Context & Fact-Checking**
- ✅ **Resume Access**: LLM has resume context at interview start
- ✅ **Fact-Checking**: LLM asks about resume at own discretion
- ✅ **Every Prompt**: Every interview agent prompt must specify to ask resume questions
- ✅ **Difficulty-Driven Depth**:
  - Junior: "Verify experience mentioned in resume"
  - Expert: "Probe inconsistencies in resume claims, verify technical depth"

**8. Pause & Skip Tracking**
- ✅ **Pause Behavior**: Candidates can pause; pauses > X configurable seconds recorded
- ✅ **Skip Behavior**: Candidates can skip questions; recorded in report
- ✅ **Evaluator Considers**: Pauses/skips factored into feedback generation
- ✅ **Negative Feedback**: Pauses/skips get negative feedback with improvement pointers
- ✅ **No Mid-Interview Penalty**: Pauses/skips DON'T affect agent behavior or scoring during interview
- **📌 CLARIFICATION**: Should short pauses (< configured threshold) also be tracked but not reported?

**9. Live Recruiter Dashboard & Monitoring**
- **❓ CLARIFICATION NEEDED**: Do you want:
  - Option A: Fully autonomous interviews, recruiter only sees final report
  - Option B: Recruiter can watch live (see candidate profile updating real-time)
  - Option C: Recruiter can watch + pause/resume interview remotely
  - Option D: Recruiter can watch + join as co-interviewer mid-interview

**10. Multi-Tenancy & Company Isolation**
- **❓ CLARIFICATION NEEDED**: Should platform support:
  - Option A: MVP - All companies share same question bank, scoring rubrics, interview templates
  - Option B: Multiple companies with isolated question banks per company
  - Option C: Full isolation - Different scoring rubrics, allowed phase types per company
  - Option D: Company-specific custom phase types

**11. Recording & Transcription (ANSWERED)**
- ✅ **Full Transcription**: Yes, entire conversation transcripted
- ✅ **Candidate Input**:
  - Type responses into chat box
  - OR dictate via TTS/voice, transcriber converts
  - OR live voice chat with audio recording alongside LLM response
- ✅ **Audio Handling**: LLM provider may give audio stream automatically
- **📌 CLARIFICATIONS**:
  - Store full audio or just transcript + metadata?
  - Storage location (S3, local)?
  - Retention period?

**12. Candidate Feedback Timing (ANSWERED)**
- ✅ **No Immediate Feedback**: Candidate sees nothing during interview
- ✅ **Candidate Control**: Can end at any time without penalty
- ✅ **Post-Interview Report**: Gets full feedback immediately after (evaluator call + profile summary)
- **📌 CLARIFICATION**: Should candidate see:
  - Real-time transcript as they speak?
  - Or completely blind during interview?

---

---

## 🎯 NEXT SECTIONS - TO BE ADDED AFTER CLARIFICATIONS

### Question Bank & Tagging System (TBD)
- Extensive question library with tag-based selection
- Tag categories to define
- Schema for storing questions with tags

### Question Selection Algorithm (TBD)
- How to pick 1-2 questions per type without repetition
- Validation logic to prevent similar questions

### Interview Agent Prompts (TBD)
- System prompt templates per phase
- Difficulty-based prompt variations
- Custom prompt injection
- XML follow-up tag handling

### Evaluator LLM Call (TBD)
- Separate evaluation workflow
- Input: conversation history + candidate profile
- Output: structured feedback + score

### Candidate Profile Structure (TBD)
- My proposal for concise-but-complete profile
- MongoDB schema for profile
- Real-time profile update flow

### Phase Transition Logic (TBD)
- Natural vs threshold-based transitions
- Configurable transition triggers

### Recording & Transcription (TBD)
- Audio storage strategy
- Transcript generation
- Retention policies

---

## Questions for Clarification - UPDATED WITH ANSWERS

### ✅ ANSWERED

**1. Question Selection & Elaboration**
- ✅ **Question Bank Approach**: Users select 1-2 questions per "type" from extensive question bank
- ✅ **Question Tags**: Questions need tags to prevent repetitive questions (e.g., behavioral phase can't have 15 similar collaboration questions)
- ✅ **LLM Elaboration**: LLM sees selected questions and elaborates/asks contextual follow-ups about them
- ✅ **Custom Questions**: Users can input their own custom questions
- **📌 NEED TAG CATEGORIES**: What should the question tags be? Examples:
  - **Behavioral Tags**: `collaboration`, `conflict-resolution`, `leadership`, `failure-handling`, `learning-from-mistakes`, `communication`, `adaptability`, `initiative`, `teamwork`, `time-management`, `stress-handling`?
  - **Technical Tags**: `system-design`, `architecture`, `databases`, `apis`, `scalability`, `debugging`, `performance`, `testing`, `security`, `design-patterns`?
  - **Coding Tags**: `data-structures`, `algorithms`, `complexity`, `edge-cases`, `problem-solving`, `code-quality`?

**2. Difficulty-Based Interviewer Personas & Prompts**
- ✅ **Persona Variations**: Interviewer behavior changes by difficulty
  - Relaxed/Helpful: Trust answers, help candidate succeed
  - Aggressive/Interrogator: Probe deeply, fact-check claims, look for inconsistencies
- ✅ **Custom Prompts**: Users can enter CUSTOM system prompts when defining interview
- ✅ **Resume in Prompts**: Every prompt must specify LLM should ask resume questions
- ✅ **Difficulty-Driven Resume Depth**:
  - Junior: Light resume verification, trust claims
  - Senior/Expert: Deep fact-checking, probe claims, verify experience consistency

**3. Question Thresholds & Natural Transitions**
- ✅ **Hybrid Approach**: 
  - LLM can naturally decide to move on based on conversation flow
  - OR use configurable thresholds (time, score, question-count)
  - Both should be options per phase
  - Config example: `transitionStrategy: 'automatic' | 'threshold-based'` with fallbacks

**4. Follow-up System (XML-style Tags)**
- ✅ **Tag Format**: `<followup>question-id</followup>` or similar XML wrapping
- ✅ **Behavior**: Follow-ups don't count as separate questions (don't increment question counter)
- ✅ **Configurable Limits**: Max follow-ups per question (e.g., max 3) - configurable per phase
- ✅ **Difficulty-Driven**: Difficult prompts specify "dig deeper, ask more follow-ups"
- ✅ **Custom Prompt Integration**: Users specify follow-up strategies in custom prompts
- **📌 CLARIFICATION**: Should follow-ups also be tagged with difficulty level? (e.g., `<followup-difficulty>senior</followup-difficulty>`)

**5. Final Report & Scoring**
- ✅ **Report Components**:
  - Score out of 100
  - Comprehensive feedback (strengths, areas to improve, specific examples)
  - Generated via separate evaluator LLM call
- ✅ **Evaluator Input**: Simple, non-agentic call with:
  - Full conversation history
  - Candidate profile memory (observations, concerns, strengths, flags)
  - Pauses/skips events
- ✅ **Evaluator Prompt**: Reads all context and provides balanced feedback
- **📌 CLARIFICATIONS**:
  - Should score be single 0-100 or broken down by skill/phase?
  - Should there be hiring recommendation (Strong Pass / Pass / Borderline / Weak Pass / Fail)?
  - Should interview have pass/fail threshold (e.g., 70+ = Pass)?

**6. Candidate Profile Content (Concise but Complete)**
- ✅ **Principle**: Concise summary, not full conversation log
- **📌 MY PROPOSAL** (please validate):
  - **Observations**: List of key observations with phase/timestamp/sentiment
  - **Strengths**: Skills demonstrated with evidence quotes
  - **Concerns**: Issues identified with severity and evidence
  - **Resume Notes**: Discrepancies or validations found
  - **Follow-ups Suggested**: Questions agent wanted to ask but didn't have time
  - **Timeline Events**: Pauses > X seconds, skips, phase transitions
  - **Red/Green Flags**: Specific concerns or positive signals
  - **Total Size**: ~2-3 pages of summary (not full transcript)

**7. Resume Context & Fact-Checking**
- ✅ **Resume Access**: LLM has resume context at interview start
- ✅ **Fact-Checking**: LLM asks about resume at own discretion
- ✅ **Every Prompt**: Every interview agent prompt must specify to ask resume questions
- ✅ **Difficulty-Driven Depth**:
  - Junior: "Verify experience mentioned in resume"
  - Expert: "Probe inconsistencies in resume claims, verify technical depth"

**8. Pause & Skip Tracking**
- ✅ **Pause Behavior**: Candidates can pause; pauses > X configurable seconds recorded
- ✅ **Skip Behavior**: Candidates can skip questions; recorded in report
- ✅ **Evaluator Considers**: Pauses/skips factored into feedback generation
- ✅ **Negative Feedback**: Pauses/skips get negative feedback with improvement pointers
- ✅ **No Mid-Interview Penalty**: Pauses/skips DON'T affect agent behavior or scoring during interview
- **📌 CLARIFICATION**: Should short pauses (< configured threshold) also be tracked but not reported?

**9. Live Recruiter Dashboard & Monitoring**
- **❓ CLARIFICATION NEEDED**: Do you want:
  - Option A: Fully autonomous interviews, recruiter only sees final report
  - Option B: Recruiter can watch live (see candidate profile updating real-time)
  - Option C: Recruiter can watch + pause/resume interview remotely
  - Option D: Recruiter can watch + join as co-interviewer mid-interview

**10. Multi-Tenancy & Company Isolation**
- **❓ CLARIFICATION NEEDED**: Should platform support:
  - Option A: MVP - All companies share same question bank, scoring rubrics, interview templates
  - Option B: Multiple companies with isolated question banks per company
  - Option C: Full isolation - Different scoring rubrics, allowed phase types per company
  - Option D: Company-specific custom phase types

**11. Recording & Transcription (ANSWERED)**
- ✅ **Full Transcription**: Yes, entire conversation transcripted
- ✅ **Candidate Input**:
  - Type responses into chat box
  - OR dictate via TTS/voice, transcriber converts
  - OR live voice chat with audio recording alongside LLM response
- ✅ **Audio Handling**: LLM provider may give audio stream automatically
- **📌 CLARIFICATIONS**:
  - Store full audio or just transcript + metadata?
  - Storage location (S3, local)?
  - Retention period?

**12. Candidate Feedback Timing (ANSWERED)**
- ✅ **No Immediate Feedback**: Candidate sees nothing during interview
- ✅ **Candidate Control**: Can end at any time without penalty
- ✅ **Post-Interview Report**: Gets full feedback immediately after (evaluator call + profile summary)
- **📌 CLARIFICATION**: Should candidate see:
  - Real-time transcript as they speak?
  - Or completely blind during interview?

