# 🚀 Interview Worker - Implementation Guide

**For:** Coding Agents  
**Status:** Ready to Build (Post-Clarifications)  
**Date:** October 27, 2025

---

## 📋 CRITICAL PIVOT: This is a PRACTICE Tool, Not Production Hiring

**WHAT THIS IS:**
- 🎓 Interview practice platform for candidates
- 📊 Self-assessment and feedback
- 🔄 Repeat interviews, track improvement
- 💡 Custom interview configurations

**WHAT THIS IS NOT:**
- ❌ Production hiring system
- ❌ Recruiter decision-making tool
- ❌ Company integration platform
- ❌ Multi-tenant SaaS (single user/candidate per session)

**Impact on Design:**
- No recruiter dashboards or monitoring
- No hiring pass/fail decisions
- No score thresholds for decisions
- Focus entirely on candidate learning

---

## ✅ FINAL CLARIFICATIONS (All Answered)

### 1. Question Tag Categories ✅

**Coding Questions:**
- Use Leetcode category tags: `arrays`, `dynamic-programming`, `tree`, `graph`, `string`, `heap`, `stack`, `linked-list`, etc.
- Reference: https://leetcode.com/problemset/all/
- NOT full Leetcode questions—just category tags in question bank

**Technical Questions - SPLIT INTO TWO:**
- `tech-trivia`: Quick knowledge (concepts, definitions, recalls)
- `system-design`: Architecture (scalability, design patterns, trade-offs)

**Behavioral Questions:**
- `behavioral`: Experience-based ("Tell me about a time...")

**Resume Questions:**
- Can appear in: behavioral + tech-trivia + system-design
- NOT in coding sections (prompt enforces)

**Question Bank Schema:**
```typescript
{
  questionId: string;
  category: "tech-trivia" | "system-design" | "behavioral" | "coding";
  subcategory?: string; // "arrays", "conflict-resolution", etc.
  difficulty: "easy" | "medium" | "hard";
  tags?: string[];
  question: string;
  expectedDuration?: number; // minutes
}
```

---

### 2. Scoring ✅ (Option B Approved)

**Score Structure:**
```typescript
{
  overall: 0-100, // Arbitrary but required for feedback
  byPhase: {
    behavioral?: 0-100,
    technical?: 0-100,
    coding?: 0-100
  },
  timestamp: Date
}
```

**Why arbitrary?** Feedback is what matters. Score is just a number.

---

### 3. No Hiring Recommendations ✅

This is a PRACTICE tool. NO hiring decisions.
- No "Pass/Fail"
- No "Strong Pass/Weak Pass"
- Just feedback

---

### 4. No Pass/Fail Threshold ✅

This is a PRACTICE tool. NO scoring-based decisions.
- No threshold checking
- Just feedback + score
- Candidate decides if they did well

---

### 5. Candidate Profile - Enhanced ✅

**Candidate Profile needs Tool Calls:**

The interview agent MUST have two tool calls:
1. `append_observation(category, text)` - Add to profile
2. `recall_profile()` - Get previous observations (don't lose context)

**Profile Schema:**
```typescript
{
  candidateSessionId: string;
  observations: {
    strengths: string[]; // "Clear communication", "Strong system design thinking"
    concerns: string[]; // "Struggled with edge cases", "Need to work on..."
    resumeFindings: {
      verified: string[]; // Confirmed from resume
      questioned: string[]; // Doesn't match resume
      deepDived: string[]; // Strong areas to explore more
    };
    adaptability: string; // How they responded to hard questions
    communicationStyle: string; // How they explained solutions
    interviewFlow: {
      pausedAt: string[]; // What topics
      skippedQuestions: number;
      pauseDuration: number; // total seconds
    };
    keyInsights: string; // Recruiter-like summary
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Goal:** Detailed enough that candidate reads it later and learns.

---

### 6. Prompts are KING ✅

**Critical:** User controls ALL behavior through prompts.

**How it works:**
```typescript
type DifficultyPrompt = {
  level: "easy" | "medium" | "hard" | "custom";
  systemPrompt: string; // Full prompt file
  instructions: {
    interviwerPersonality: string;
    difficultyModifier: string;
    followupStrategy: string;
    resumeIntegration: string;
  };
  customPrompt?: string; // User can override
}
```

**Key Rules:**
- Agent gets ONE prompt (the selected difficulty or custom)
- Agent does NOT know about other difficulties (no cheating)
- Agent organically handles resume questions from prompt instructions
- Prompt controls what to ask, how to follow up, when to advance
- Prompt specifies: "Don't ask resume questions in coding sections"

**Example Prompt Fragment:**
```
You are conducting a ${difficulty} technical interview.

Interview Section: System Design
Duration: 45 minutes
${pauseInstruction}

Important: Do NOT ask resume questions in this section.
If candidate mentions experience, note it for later.

For this ${difficulty} level:
- Ask about design trade-offs and scalability
- ${customPersonality || 'Be helpful and supportive'}

Use tool call 'append_observation' to track insights as you go.
```

**Agent workflow:**
1. Gets prompt (difficulty-based or custom)
2. Never sees other prompts
3. Follows prompt instructions organically
4. Uses tool calls to build profile
5. Never makes scoring decisions (evaluator does)

---

### 7. No Recruiter Dashboard ✅

This is a PRACTICE tool. NO live monitoring.
- No dashboard endpoints
- No real-time recruiter access
- Interview is private candidate workspace

**What IS available:**
- Candidate sees their own reports/feedback
- Candidate can export transcript
- That's it

---

### 8. Not Multi-Tenant ✅

This is a PRACTICE tool for individual candidates.
- One user per session
- No company-level views
- No cross-user analytics

---

### 9. Recording: Transcripts Only ✅

**What we store:**
- Full transcript (text) in MongoDB ✅
- Metadata (duration, pauses, skips, followups) ✅

**What we DON'T store:**
- Audio files ✅ (NEVER)
- Video files ✅ (NEVER)

**Transcript Storage:**
```typescript
{
  sessionId: string;
  messages: Array<{
    timestamp: Date;
    speaker: "candidate" | "agent";
    text: string;
    type: "user-input" | "voice-transcription" | "agent-response" | "followup";
    followupForQuestionId?: string; // Link to question if followup
  }>;
}
```

---

### 10. Candidate UI: Completely Blind ✅

Candidate sees:
- ✅ Transcript (what was said)
- ✅ Questions asked (what topics covered)
- ✅ Code submission panels (for coding questions)
- ✅ Drag-drop system design (for sys-des questions)

Candidate does NOT see:
- ❌ Scoring in real-time
- ❌ Agent evaluation/thinking
- ❌ Progress bar
- ❌ Any hints about performance

**After interview completes:**
- ✅ Final feedback report
- ✅ Score (0-100)
- ✅ Observations/insights
- ✅ Areas to improve

---

### 11. Follow-up Tracking by Question ID ✅

**Follow-up Format:**
```typescript
{
  type: "followup",
  followupForQuestionId: string; // Link to original question
  text: string;
  depth: number; // How many follow-ups for this question
}
```

**Implementation:**
- Count follow-ups per `questionId`
- Enforce limit (e.g., max 3 follow-ups per question)
- Limit set in prompt or interview config

**Why?** Prevent endless follow-ups on one question.

---

### 12. Pause/Skip Configuration ✅

**Pause Rules:**
- Candidate can pause anytime
- NO maximum pause duration (hardcoded infinity ✅)
- NO pause notice threshold
- Reason: "What if they need to go to washroom?"

**Skip Rules:**
- Candidate can skip any question
- Recorded in transcript
- Evaluator considers in feedback

**Configuration:**
```typescript
{
  pauseConfig: {
    allowPause: true; // Always true
    maxPauseDuration: null; // No limit (infinity)
    pauseNoticeThreshold: null; // No threshold
  },
  skipConfig: {
    allowSkip: true;
    maxSkips: null; // Or limit if desired, but no default
  }
}
```

---

## 📐 Architecture Overview (Hexagonal)

```
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Controllers  │  WebSocket  │  Repositories │  DTOs  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│              APPLICATION LAYER                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Services: Interview, Question, Profile, Evaluator   │  │
│  │ Use Cases: StartInterview, SubmitResponse, etc.      │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                DOMAIN LAYER (Pure)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Entities: Interview, Session, Question, Response    │  │
│  │ Value Objects: Config, Rubric, PauseConfig          │  │
│  │ Ports/Interfaces: IRepository, ILLM, ISTTService    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Domain Entities

### Interview
```typescript
{
  id: string;
  title: string;
  description?: string;
  phases: InterviewPhase[];
  config: InterviewConfig;
  rubric: ScoringRubric;
  createdAt: Date;
  updatedAt: Date;
}
```

### InterviewPhase
```typescript
{
  phaseId: string;
  type: "behavioral" | "technical" | "coding" | "system-design";
  duration: number; // minutes
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  promptOverride?: string; // Custom prompt
  config: PhaseConfig;
}
```

### InterviewSession
```typescript
{
  sessionId: string;
  interviewId: string;
  candidateId: string;
  currentPhase: number;
  currentQuestion?: string;
  status: "in-progress" | "paused" | "completed" | "abandoned";
  startedAt: Date;
  completedAt?: Date;
  pausedCount: number;
  totalPauseDuration: number; // seconds
  skippedQuestions: string[];
}
```

### CandidateProfile
```typescript
{
  profileId: string;
  sessionId: string;
  observations: {
    strengths: string[];
    concerns: string[];
    resumeFindings: {
      verified: string[];
      questioned: string[];
      deepDived: string[];
    };
    adaptability: string;
    communicationStyle: string;
    interviewFlow: {
      pausedAt: string[];
      skippedQuestions: number;
      pauseDuration: number;
    };
    keyInsights: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### InterviewResponse
```typescript
{
  responseId: string;
  sessionId: string;
  questionId: string;
  candidateResponse: string;
  followups?: Array<{
    followupForQuestionId: string;
    text: string;
    depth: number;
    candidateResponse: string;
  }>;
  skipped: boolean;
  submittedAt: Date;
}
```

### InterviewReport
```typescript
{
  reportId: string;
  sessionId: string;
  score: {
    overall: 0-100;
    byPhase: {
      behavioral?: 0-100;
      technical?: 0-100;
      coding?: 0-100;
    };
  };
  feedback: string; // From evaluator LLM
  observations: CandidateProfile['observations'];
  transcript: Transcript;
  generatedAt: Date;
}
```

---

## 🗄️ MongoDB Schemas

### interviews
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  phases: [{
    phaseId: String,
    type: String, // "behavioral", "technical", etc.
    duration: Number,
    difficulty: String,
    questionCount: Number,
    promptOverride: String
  }],
  config: Object,
  rubric: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### interview_sessions
```javascript
{
  _id: ObjectId,
  sessionId: String,
  interviewId: String,
  candidateId: String,
  currentPhase: Number,
  currentQuestion: String,
  status: String,
  startedAt: Date,
  completedAt: Date,
  pausedCount: Number,
  totalPauseDuration: Number,
  skippedQuestions: [String]
}
```

### candidate_profiles
```javascript
{
  _id: ObjectId,
  sessionId: String,
  observations: {
    strengths: [String],
    concerns: [String],
    resumeFindings: {
      verified: [String],
      questioned: [String],
      deepDived: [String]
    },
    adaptability: String,
    communicationStyle: String,
    interviewFlow: {
      pausedAt: [String],
      skippedQuestions: Number,
      pauseDuration: Number
    },
    keyInsights: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### questions
```javascript
{
  _id: ObjectId,
  questionId: String,
  category: String, // "tech-trivia", "system-design", "behavioral", "coding"
  subcategory: String, // "arrays", "conflict-resolution", etc.
  difficulty: String,
  tags: [String],
  question: String,
  expectedDuration: Number
}
```

### interview_responses
```javascript
{
  _id: ObjectId,
  responseId: String,
  sessionId: String,
  questionId: String,
  candidateResponse: String,
  followups: [{
    followupForQuestionId: String,
    text: String,
    depth: Number,
    candidateResponse: String
  }],
  skipped: Boolean,
  submittedAt: Date
}
```

### transcripts
```javascript
{
  _id: ObjectId,
  sessionId: String,
  messages: [{
    timestamp: Date,
    speaker: String, // "candidate", "agent"
    text: String,
    type: String, // "user-input", "voice-transcription", "agent-response", "followup"
    followupForQuestionId: String
  }]
}
```

### interview_reports
```javascript
{
  _id: ObjectId,
  reportId: String,
  sessionId: String,
  score: {
    overall: Number,
    byPhase: {
      behavioral: Number,
      technical: Number,
      coding: Number
    }
  },
  feedback: String,
  observations: Object,
  generatedAt: Date
}
```

---

## 🔌 Interview Agent (in Assistant Worker)

### New Agent Type

**Location:** `assistant-worker/src/core/agents/interview-agent.ts`

```typescript
export class InterviewAgent extends BaseAgent {
  // Dual memory
  conversationMemory: ConversationBufferMemory; // Whole conversation
  candidateProfileMemory: CandidateProfileMemory; // Observations + insights

  // Tool calls
  async appendObservation(category: string, text: string): Promise<void> {
    // Add to profile
  }

  async recallProfile(): Promise<CandidateProfile> {
    // Get current profile (maintain context)
  }

  async getFollowupCount(questionId: string): Promise<number> {
    // How many followups for this question
  }

  async submitResponse(response: InterviewResponse): Promise<void> {
    // Save response to database
  }
}
```

### System Prompt Generation

```typescript
async getSystemPrompt(
  phase: InterviewPhase,
  profile: CandidateProfile,
  customPrompt?: string
): Promise<string> {
  if (customPrompt) {
    return customPrompt;
  }

  const difficultyPrompt = await loadPrompt(phase.difficulty);
  
  // Template substitution
  return difficultyPrompt
    .replace("${difficulty}", phase.difficulty)
    .replace("${phaseType}", phase.type)
    .replace("${resumeContext}", profile.resumeFindings || "")
    .replace("${previousObservations}", profile.keyInsights || "");
}
```

---

## 🛠️ Tool Implementations (Interview Agent)

### Tool 1: append_observation

```typescript
async appendObservation(category: string, text: string): Promise<void> {
  // Called by agent to add insight
  const profile = await candidateProfileService.getProfile(sessionId);
  
  if (category === "strengths") {
    profile.observations.strengths.push(text);
  } else if (category === "concerns") {
    profile.observations.concerns.push(text);
  } else if (category === "keyInsights") {
    profile.observations.keyInsights += "\n" + text;
  }
  
  await candidateProfileService.update(profile);
}
```

### Tool 2: recall_profile

```typescript
async recallProfile(): Promise<CandidateProfile> {
  // Agent calls this to remember what it wrote
  const profile = await candidateProfileService.getProfile(sessionId);
  
  return {
    strengths: profile.observations.strengths,
    concerns: profile.observations.concerns,
    resumeFindings: profile.observations.resumeFindings,
    keyInsights: profile.observations.keyInsights
  };
}
```

### Tool 3: get_followup_count

```typescript
async getFollowupCount(questionId: string): Promise<number> {
  const responses = await responseRepository.findBySessionAndQuestion(
    sessionId,
    questionId
  );
  
  return responses.followups?.length || 0;
}
```

### Tool 4: check_followup_limit

```typescript
async checkFollowupLimit(questionId: string): Promise<boolean> {
  const count = await getFollowupCount(questionId);
  const maxFollowups = 3; // Or from config
  
  return count < maxFollowups;
}
```

---

## 📡 API Endpoints (REST)

### Interview Setup
- `POST /interviews` - Create interview
- `GET /interviews/:id` - Get interview
- `PATCH /interviews/:id` - Update interview

### Interview Sessions
- `POST /sessions` - Start interview
- `GET /sessions/:sessionId` - Get session
- `POST /sessions/:sessionId/pause` - Pause
- `POST /sessions/:sessionId/resume` - Resume
- `POST /sessions/:sessionId/submit-response` - Submit answer

### Questions
- `GET /questions` - List questions (filter by category/difficulty)
- `POST /questions` - Add question
- `GET /questions/:id` - Get question

### Candidate Profile
- `GET /sessions/:sessionId/profile` - Get profile
- `GET /sessions/:sessionId/profile/recall` - Recall current observations

### Reports
- `GET /sessions/:sessionId/report` - Get final report

### Transcripts
- `GET /sessions/:sessionId/transcript` - Get transcript

---

## 🔊 WebSocket Events

```typescript
// Client → Server
"submit_response" → { sessionId, questionId, response }
"pause" → { sessionId }
"resume" → { sessionId }
"skip_question" → { sessionId, questionId }
"agent_tool_call" → { toolName, args }

// Server → Client
"agent_message" → { text, type }
"followup_available" → { followupCount, maxAllowed }
"phase_complete" → { nextPhase }
"interview_complete" → { reportReady }
"error" → { message }
```

---

## 📊 Evaluator Service

**After interview completes:**

```typescript
async evaluateInterview(sessionId: string): Promise<InterviewReport> {
  const session = await sessionRepository.find(sessionId);
  const transcript = await transcriptRepository.find(sessionId);
  const responses = await responseRepository.findBySession(sessionId);
  const profile = await candidateProfileService.getProfile(sessionId);
  
  // Call evaluator LLM
  const evaluatorPrompt = buildEvaluatorPrompt(session, transcript, profile);
  const evaluation = await llmService.complete(evaluatorPrompt);
  
  // Parse evaluation into scores
  const scores = parseScores(evaluation);
  
  return {
    reportId: generateId(),
    sessionId,
    score: scores,
    feedback: evaluation.feedback,
    observations: profile.observations,
    generatedAt: new Date()
  };
}
```

**Evaluator Prompt Template:**
```
You are an expert interview evaluator.

INTERVIEW TRANSCRIPT:
${transcript}

CANDIDATE PROFILE (Built during interview):
${profile}

INTERVIEW CONFIGURATION:
${config}

TASK:
1. Evaluate overall performance (0-100)
2. Score each phase (0-100)
3. Provide specific feedback
4. Identify strengths and areas to improve

Output JSON:
{
  "overall": 0-100,
  "byPhase": { "behavioral": 0-100, ... },
  "feedback": "string",
  "strengths": ["list"],
  "improvements": ["list"]
}
```

---

## 🚀 Implementation Roadmap (9 Phases)

### Phase 1: Core Infrastructure (Week 1)
**Deliverable:** Domain entities, MongoDB schemas, base repositories

- [ ] Create domain entities (Interview, Session, Response, etc.)
- [ ] Create MongoDB schemas and indexes
- [ ] Create repository interfaces (IInterviewRepository, etc.)
- [ ] Create MongoDB repository implementations
- [ ] Setup NestJS app structure (controllers, services)
- [ ] Create DTOs (StartInterviewDTO, SubmitResponseDTO, etc.)

**Tests:** Unit tests for repositories, DTOs

---

### Phase 2: Question Bank System (Week 2)
**Deliverable:** Question bank with tagging and selection

- [ ] Create question bank schema
- [ ] Implement question repository
- [ ] Create question selection algorithm (by category/difficulty)
- [ ] Create QuestionService
- [ ] Implement filtering (e.g., "Get 2 tech-trivia, 1 system-design")
- [ ] Create REST endpoints for question CRUD

**Tests:** Unit tests for selection algorithm, integration tests for endpoints

---

### Phase 3: Interview State Machine (Week 3)
**Deliverable:** Session lifecycle, phase transitions, state tracking

- [ ] Create session state machine
- [ ] Implement StartInterview use case
- [ ] Implement PauseInterview use case
- [ ] Implement ResumeInterview use case
- [ ] Implement SkipQuestion use case
- [ ] Create SessionService
- [ ] REST endpoints: /sessions, /pause, /resume, /skip

**Tests:** State machine tests, use case tests

---

### Phase 4: Candidate Profiling (Week 4)
**Deliverable:** Live profile building with observations

- [ ] Create CandidateProfile entity
- [ ] Implement profile repository
- [ ] Create CandidateProfileService
- [ ] Implement profile update logic
- [ ] Add "append_observation" capability
- [ ] Add "recall_profile" capability
- [ ] REST endpoints: GET profile, recall profile

**Tests:** Profile building tests, profile recall tests

---

### Phase 5: Interview Agent in Assistant Worker (Week 5-6)
**Deliverable:** New agent type with dual memory and tools

- [ ] Create InterviewAgent class (extends BaseAgent)
- [ ] Implement ConversationBufferMemory for agent
- [ ] Implement CandidateProfileMemory
- [ ] Add tool: append_observation
- [ ] Add tool: recall_profile
- [ ] Add tool: get_followup_count
- [ ] Add tool: check_followup_limit
- [ ] System prompt generation with template substitution
- [ ] Register agent in factory
- [ ] Integration tests with actual LLM calls

**Tests:** Agent behavior tests, tool call tests, memory tests

---

### Phase 6: Speech & Voice (Week 7-8)
**Deliverable:** STT/TTS support, WebSocket real-time audio

- [ ] Create STT adapter (Google/Azure Speech)
- [ ] Create TTS adapter
- [ ] Setup WebSocket handler for real-time audio
- [ ] Implement audio streaming to/from client
- [ ] Add speech-to-text in interview flow
- [ ] Add text-to-speech fallback
- [ ] Transcript generation from audio
- [ ] WebSocket endpoints for audio events

**Tests:** STT/TTS service tests, WebSocket integration tests

---

### Phase 7: Evaluator & Reporting (Week 9)
**Deliverable:** LLM evaluation, score generation, report output

- [ ] Create Evaluator LLM service
- [ ] Build evaluator prompt templates
- [ ] Implement evaluation algorithm
- [ ] Parse LLM output into structured scores
- [ ] Create ReportService
- [ ] Generate final report
- [ ] REST endpoint: GET /report

**Tests:** Evaluation logic tests, report generation tests

---

### Phase 8: Multi-User Concurrency (Week 10)
**Deliverable:** Session isolation, no cross-session interference

- [ ] Verify session isolation in memory
- [ ] Verify session isolation in database
- [ ] Load test: 5+ concurrent interviews
- [ ] Test concurrent pause/resume
- [ ] Test transcript consistency under load
- [ ] Test profile building under concurrent updates

**Tests:** Concurrency tests, load tests, race condition tests

---

### Phase 9: Polish & Integration (Week 11)
**Deliverable:** Error handling, E2E tests, performance optimization

- [ ] Error handling for all endpoints
- [ ] Retry logic for LLM calls
- [ ] Graceful degradation (STT fails → text input)
- [ ] E2E tests: full interview flow
- [ ] Performance optimization (caching, indexes)
- [ ] Documentation (API docs, setup guide)
- [ ] Security review (no data leaks, CORS, auth)

**Tests:** E2E tests, security tests, performance benchmarks

---

## 📦 What Coding Agents Need (Complete Handoff)

### Documents to Reference:
1. **THIS FILE** - Implementation Guide (everything to build)
2. `COMPREHENSIVE_DESIGN.md` - Feature details, edge cases
3. `VISUAL_REFERENCE.md` - State machines, flow diagrams
4. `UPDATED_ARCHITECTURE.md` - Additional implementation details

### What They Build:
1. **Phase 1:** Domain + Persistence (entities, MongoDB, repos)
2. **Phase 2:** Question system (tagging, selection, CRUD)
3. **Phase 3:** Session management (state machine, transitions)
4. **Phase 4:** Profile building (observations, insights)
5. **Phase 5:** Interview Agent (in Assistant Worker)
6. **Phase 6:** Voice support (STT, TTS, WebSocket)
7. **Phase 7:** Evaluation (LLM, scoring, reports)
8. **Phase 8:** Concurrency (isolation, load testing)
9. **Phase 9:** Polish (errors, E2E, perf)

### Key Config Files They'll Need:
```typescript
// interview-worker/.env
MONGODB_URI=mongodb://...
LLM_PROVIDER=openai|anthropic
LLM_API_KEY=...
STT_PROVIDER=google|azure
TTS_PROVIDER=google|azure
KAFKA_BROKERS=...

// interview-worker/src/config/interview.config.ts
export const INTERVIEW_CONFIG = {
  phases: {
    behavioral: { duration: 30, questionCount: 2 },
    technical: { duration: 20, questionCount: 2 },
    coding: { duration: 45, questionCount: 1 },
  },
  scoring: {
    byPhase: true,
    weights: { behavioral: 0.3, technical: 0.3, coding: 0.4 }
  },
  followups: {
    maxPerQuestion: 3,
    allowSkip: true,
    allowPause: true
  }
};

// interview-worker/src/config/prompts/difficulty.config.ts
export const PROMPTS = {
  easy: fs.readFileSync('./prompts/easy.md', 'utf-8'),
  medium: fs.readFileSync('./prompts/medium.md', 'utf-8'),
  hard: fs.readFileSync('./prompts/hard.md', 'utf-8'),
};
```

### Prompt Files They'll Create:
```
interview-worker/
├── prompts/
│   ├── easy.md       # Supportive, helpful interviewer
│   ├── medium.md     # Balanced, constructive
│   ├── hard.md       # Challenging, rigorous
│   └── evaluator.md  # For final assessment
```

---

## ✅ Verification Checklist

Before calling implementation done:
- [ ] All 6 domain entities persist in MongoDB
- [ ] Session state machine handles all transitions
- [ ] Question selection prevents repetition
- [ ] Candidate profile builds with append/recall
- [ ] Interview Agent integrates with Assistant Worker
- [ ] Speech input/output works (with text fallback)
- [ ] Evaluator LLM generates scores
- [ ] Report generates in <1 minute
- [ ] 5+ concurrent interviews work without interference
- [ ] All endpoints documented
- [ ] E2E test covers full interview flow

---

## 🎯 Success Criteria

Interview Worker is successful when:
- ✅ Candidate has natural conversation (speech or text)
- ✅ Interview adapts to difficulty level
- ✅ Profile builds automatically (no manual notes)
- ✅ Report generates immediately after
- ✅ Multiple interviews work simultaneously
- ✅ Candidate can pause/skip anytime
- ✅ Feedback is specific and actionable
- ✅ Transcript is accurate and complete

---

## 📞 Questions for Coding Agents?

If anything is unclear:
1. Check this guide first (it has everything)
2. Review `COMPREHENSIVE_DESIGN.md` for feature details
3. Check `VISUAL_REFERENCE.md` for flow diagrams
4. Ask for clarification (with specific section reference)

---

**Created:** October 27, 2025  
**For:** Coding Agent Handoff  
**Status:** 🟢 READY TO BUILD
