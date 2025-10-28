# 🤖 Agent Handoff - What to Build

**To:** Coding Agents  
**From:** Design Phase  
**Date:** October 27, 2025  
**Status:** 🟢 READY TO BUILD

---

## 📦 Your Mission

Build the **Interview Worker** - a practice platform where candidates conduct AI-powered mock interviews to prepare for real jobs.

**Key point:** This is NOT production hiring. It's practice/feedback for candidates.

---

## 📋 Start Here - Complete Reading Order

1. **THIS FILE** (5 min) - Overview and what to build
2. **IMPLEMENTATION_GUIDE.md** (2-3 hours) - Everything you need:
   - Domain entities (copy these)
   - MongoDB schemas (use these)
   - API endpoints (build these)
   - 9 implementation phases (follow this)
   - Tool implementations (code these)
   - Todo checklist (tick these off)
3. **VISUAL_REFERENCE.md** (30 min) - Look at diagrams if needed
4. **COMPREHENSIVE_DESIGN.md** (optional) - Deep feature details

---

## 🎯 What You're Building

A microservice on port 3004 that:

1. **Manages Interviews**
   - Recruiter creates interview (5 phases max)
   - Each phase has config (duration, difficulty, type)
   - Question bank selected per phase

2. **Runs Sessions**
   - Candidate starts interview
   - Agent asks questions (one per phase)
   - Candidate answers (voice or text)
   - Agent takes notes (candidate profile)
   - Pauses/skips are tracked

3. **Tracks Profile**
   - Live: strengths, concerns, adaptability
   - Resume: verified, questioned, deep-dived
   - Key insights: what recruiter would see

4. **Evaluates Interview**
   - After completion, separate LLM call
   - Generates score (0-100)
   - Generates feedback
   - Stores report

5. **Returns Results**
   - Candidate gets: report + transcript + score
   - No scoring visible during interview

---

## 🏗️ Architecture (Copy This)

```
┌─────────────────────────────────────────┐
│        INFRASTRUCTURE LAYER             │
│  (Controllers, WebSocket, DTOs)         │
├─────────────────────────────────────────┤
│        APPLICATION LAYER                │
│  (Services, Use Cases, Business Logic)  │
├─────────────────────────────────────────┤
│        DOMAIN LAYER (Pure)              │
│  (Entities, Value Objects, Ports)       │
└─────────────────────────────────────────┘
```

Same pattern as Assistant Worker.

---

## 🗂️ What Entities to Create

**6 main entities to implement:**

1. `Interview` - Configuration template
2. `InterviewSession` - Active interview instance
3. `InterviewQuestion` - Question library items
4. `InterviewResponse` - Candidate answers
5. `CandidateProfile` - Live observations
6. `InterviewReport` - Final assessment

See **IMPLEMENTATION_GUIDE.md** for full schemas (copy them).

---

## 🗄️ MongoDB Collections

Create these 7 collections (schemas in IMPLEMENTATION_GUIDE.md):

1. `interviews` - Interview templates
2. `interview_sessions` - Active sessions
3. `questions` - Question bank
4. `interview_responses` - Answers + followups
5. `candidate_profiles` - Live observations
6. `transcripts` - Full conversation logs
7. `interview_reports` - Final reports

---

## 🔌 New Agent Type to Add (in Assistant Worker)

Create `InterviewAgent` class:
- Extends `BaseAgent`
- Has `ConversationBufferMemory` (whole conversation)
- Has `CandidateProfileMemory` (observations)
- 4 tool calls:
  - `append_observation(category, text)` - Add to profile
  - `recall_profile()` - Get current profile
  - `get_followup_count(questionId)` - Count followups
  - `check_followup_limit(questionId)` - Enforce limit

---

## 📡 API You'll Build

**30+ REST endpoints** (see IMPLEMENTATION_GUIDE.md for full list):

```
POST   /interviews              → Create interview
GET    /interviews/:id          → Get interview
PATCH  /interviews/:id          → Update interview

POST   /sessions                → Start interview
GET    /sessions/:sessionId     → Get session
POST   /sessions/:sessionId/pause
POST   /sessions/:sessionId/resume
POST   /sessions/:sessionId/submit-response
GET    /sessions/:sessionId/profile
GET    /sessions/:sessionId/report
GET    /sessions/:sessionId/transcript

GET    /questions               → List questions
POST   /questions               → Add question
GET    /questions/:id           → Get question
```

Plus WebSocket for real-time events.

---

## 🛠️ 9 Implementation Phases

Each phase is 1 week of work:

```
Week 1  → Phase 1: Core Infrastructure
          • Entities, MongoDB, Repositories, Controllers

Week 2  → Phase 2: Question Bank System
          • Question tagging, selection algorithm, CRUD

Week 3  → Phase 3: Interview State Machine
          • Sessions, transitions, state tracking

Week 4  → Phase 4: Candidate Profiling
          • Profile building, observations, recall

Week 5-6 → Phase 5: Interview Agent
          • New agent type in Assistant Worker, tools, memory

Week 7-8 → Phase 6: Speech & Voice
          • STT, TTS, WebSocket audio streaming

Week 9  → Phase 7: Evaluator & Reporting
          • LLM evaluation, scoring, report generation

Week 10 → Phase 8: Multi-User Concurrency
          • Session isolation, load testing

Week 11 → Phase 9: Polish & Integration
          • Error handling, E2E tests, optimization
```

Each phase has a TODO list in IMPLEMENTATION_GUIDE.md.

---

## 📝 Prompt Files You Need to Create

Create these in `interview-worker/prompts/`:

```
prompts/
├── easy.md       # Supportive, helpful interviewer
├── medium.md     # Balanced, constructive
├── hard.md       # Challenging, rigorous
└── evaluator.md  # For final assessment
```

Agent gets ONE of these. Never sees the others.

---

## 🎯 Critical Design Decisions (Already Made)

### Question Tagging
- `behavioral` - Experience questions
- `tech-trivia` - Quick knowledge
- `system-design` - Architecture questions
- `coding` - Leetcode-category based
- Resume questions allowed except in coding sections

### Scoring
- Per-phase scores (behavioral, technical, coding)
- Overall 0-100
- Arbitrary but required for feedback

### Profile Building
- Tool calls: `append_observation()` and `recall_profile()`
- Fields: strengths, concerns, resume findings, adaptability, etc.
- Built during interview, shown to candidate after

### Pause/Skip
- NO limits on pause time
- Can pause anytime
- Can skip any question
- All tracked but not penalized

### Recording
- Transcripts to MongoDB ✅
- Audio files NEVER ❌

### Candidate Visibility
- Blind during interview ✅
- See score/feedback after ✅

### No Hiring Decisions
- No pass/fail ❌
- No recommendations ❌
- Just feedback ❌

---

## 🚀 Tech Stack

- **Framework:** NestJS + TypeScript
- **Database:** MongoDB + Mongoose
- **Messaging:** Kafka (for events)
- **LLM:** OpenAI or Anthropic
- **Speech:** Google Cloud or Azure Speech
- **Real-time:** WebSocket
- **Testing:** Jest

---

## ✅ Verification Checklist

Before each phase, verify:

```
Phase 1:
□ All 6 entities created
□ MongoDB schemas indexed
□ Repositories working
□ DTOs typed correctly

Phase 2:
□ Question bank has 50+ questions
□ Tags are correct
□ Selection algorithm prevents repetition
□ CRUD endpoints work

Phase 3:
□ Session state machine tested
□ Transitions work correctly
□ Pause/resume/skip work

Phase 4:
□ Profile builds with observations
□ Append/recall tools work
□ Profile persists

Phase 5:
□ InterviewAgent registered
□ Tool calls execute
□ Memory systems work

Phase 6:
□ STT working
□ TTS working
□ WebSocket audio streams

Phase 7:
□ Evaluator LLM calls work
□ Scores generated
□ Reports generated in <1 min

Phase 8:
□ 5+ concurrent interviews without interference
□ No race conditions
□ Sessions isolated

Phase 9:
□ All errors handled gracefully
□ E2E tests pass
□ Performance acceptable
```

---

## 🎓 Key Mental Model

**This is practice, not production:**

```
Company Hiring System:        Interview Practice Tool:
├─ Hire/No-Hire             ├─ Feedback only
├─ Pass/Fail                ├─ No decisions
├─ Recruiter decides         ├─ Candidate decides
├─ Sensitive data            ├─ Candidate reviews
└─ Prod quality              └─ Learning tool
```

---

## 📞 If You Get Stuck

1. Check **IMPLEMENTATION_GUIDE.md** (it has everything)
2. Look at diagrams in **VISUAL_REFERENCE.md**
3. Read feature details in **COMPREHENSIVE_DESIGN.md**
4. Check code examples in **UPDATED_ARCHITECTURE.md**

---

## 🎬 Ready? Start Here

1. Read **IMPLEMENTATION_GUIDE.md** (2-3 hours)
2. Start **Phase 1** (entities + MongoDB)
3. Follow the TODO list for each phase
4. Verify after each phase
5. Move to next phase

---

## 📦 Deliverables After All 9 Phases

You'll have:
- ✅ Interview Worker microservice (port 3004)
- ✅ 30+ REST endpoints + WebSocket
- ✅ MongoDB persistence
- ✅ Interview Agent in Assistant Worker
- ✅ Speech I/O support
- ✅ Profile building + recall
- ✅ Evaluator LLM integration
- ✅ Report generation
- ✅ Multi-user support
- ✅ Comprehensive tests
- ✅ Error handling
- ✅ Production-ready code

---

## 🚀 Let's Go

Open **IMPLEMENTATION_GUIDE.md** and start **Phase 1**.

Everything you need is there.

Good luck! 🎯
