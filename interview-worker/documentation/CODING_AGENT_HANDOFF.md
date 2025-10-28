# 🎯 CODING AGENT - DEFINITIVE HANDOFF DOCUMENT

**Date:** October 27, 2025  
**Status:** ✅ READY TO BUILD  
**Audience:** Coding Agents (This is your spec)

---

## YOUR JOB

Build the Interview Worker - a practice platform where candidates do mock interviews to prepare for real jobs.

**Time Estimate:** ~9 weeks (1 week per phase)  
**Difficulty:** Medium (hexagonal architecture, but proven patterns)  
**Key Constraint:** This is a PRACTICE tool, NOT production hiring

---

## 📖 READING ORDER (MANDATORY)

1. **This document** (5 min) - Overview
2. **IMPLEMENTATION_GUIDE.md** (2-3 hours) - Everything you need
3. Start coding **Phase 1**

That's it. Everything is in IMPLEMENTATION_GUIDE.md.

---

## 🎯 MISSION STATEMENT

Create a NestJS microservice (port 3004) that:

1. **Accepts interview configurations** (recruiter sets up phases/questions)
2. **Runs interview sessions** (agent asks questions, candidate answers)
3. **Tracks candidate profile** (observations, strengths, concerns build live)
4. **Generates reports** (score + feedback after completion)
5. **Returns results** (candidate gets transcript + score + insights)

**Output:** Candidate gets report to learn from. NO hiring decisions.

---

## 🏗️ WHAT YOU'RE BUILDING

### Service Details
- **Port:** 3004
- **Framework:** NestJS + TypeScript
- **Database:** MongoDB (7 collections)
- **Messaging:** Kafka (for events)
- **LLM:** OpenAI or Anthropic
- **Speech:** Google Cloud or Azure Speech API

### Main Components
1. **Interview Manager** - CRUD for interview templates
2. **Question Bank** - Library with tagging (behavioral, tech-trivia, system-design, coding)
3. **Session Manager** - Active interview sessions, state machine
4. **Interview Agent** - New agent in Assistant Worker (dual memory)
5. **Evaluator** - LLM that scores interviews post-completion
6. **Profile Builder** - Live observations during interview

---

## 🗂️ ENTITIES (Copy These)

You'll create 6 main entities:

```typescript
Interview {
  title, phases[], config, rubric
}

InterviewSession {
  interviewId, candidateId, status, currentPhase, pauses, skips
}

InterviewQuestion {
  category, subcategory, difficulty, tags, question
}

InterviewResponse {
  sessionId, questionId, candidateResponse, followups[]
}

CandidateProfile {
  strengths[], concerns[], resumeFindings{}, adaptability, insights
}

InterviewReport {
  score{overall, byPhase{}}, feedback, observations
}
```

See IMPLEMENTATION_GUIDE.md for complete schemas.

---

## 📡 WHAT YOU'LL BUILD

### 9 Implementation Phases (1 week each)

```
Week 1:  Phase 1  → Core Infrastructure (entities, DB, repos, DTOs)
Week 2:  Phase 2  → Question Bank (tagging, selection, CRUD)
Week 3:  Phase 3  → Session State Machine (lifecycle, transitions)
Week 4:  Phase 4  → Candidate Profiling (observations, recall tools)
Week 5:  Phase 5  → Interview Agent (in Assistant Worker + tools)
Week 6:  Phase 6  → Speech & Voice (STT, TTS, WebSocket)
Week 7:  Phase 7  → Evaluator (LLM, scoring, reports)
Week 8:  Phase 8  → Concurrency (session isolation, load test)
Week 9:  Phase 9  → Polish (errors, E2E tests, optimization)
```

Each phase has a TODO list in IMPLEMENTATION_GUIDE.md.

---

## 🎓 CRITICAL MENTAL MODEL

### What This IS:
✅ Practice platform (candidate learns)  
✅ Feedback tool (score + insights)  
✅ Self-assessment (candidate reviews own progress)  

### What This IS NOT:
❌ Production hiring system  
❌ Recruiter decision tool  
❌ Pass/fail system  
❌ Multi-tenant SaaS  

**This changes everything.** No hiring logic, no dashboards, no multi-tenant complexity.

---

## 🔑 KEY DECISIONS (Already Made)

### Question Tags
- `behavioral` - Experience questions
- `tech-trivia` - Quick knowledge
- `system-design` - Architecture questions
- `coding` - Leetcode categories (arrays, tree, graph, etc.)
- Resume questions NOT in coding sections

### Candidate Profile
- Built with TWO custom hardcoded tools the agent can call:
  - `append_observation(category, text)` - Add insight
  - `recall_profile()` - Get what was written so far
- Fields: strengths, concerns, resume findings, adaptability, insights

### Prompts
- User provides custom prompt files and some are premade (easy.md, medium.md, hard.md, custom.md)
- Agent gets ONE prompt (doesn't know about others or other difficulties)
- Prompt controls ALL behavior when it comes to deciding what question comes next(not code logic)

### Recording
- ✅ Transcripts to MongoDB (forever)
- ❌ NO audio files (never)

### Pause/Skip
- ✅ Can pause anytime (NO TIME LIMIT)
- ✅ Can skip any question
- Both tracked but maybe penalized in final report / feedback

### Scoring
- Per-phase (behavioral, technical, coding) + overall (0-100)
- Arbitrary but required for feedback
- NO pass/fail thresholds

---

## 📋 YOUR CHECKLIST

### Before Starting:
- [ ] Read this document (5 min)
- [ ] Read IMPLEMENTATION_GUIDE.md (2-3 hours)
- [ ] Understand hexagonal architecture
- [ ] Know where Entities vs Services go
- [ ] Know MongoDB schema structure

### For Each Phase:
- [ ] Read phase description in IMPLEMENTATION_GUIDE.md
- [ ] Do the TODOs in order
- [ ] Run verification checklist
- [ ] Move to next phase

### Before Calling "Done":
- [ ] All entities persist in MongoDB ✅
- [ ] Session state machine works ✅
- [ ] Profile builds with tool calls ✅
- [ ] Interview Agent in Assistant Worker ✅
- [ ] Speech works (with text fallback) ✅
- [ ] Evaluator generates reports ✅
- [ ] 5+ concurrent interviews work ✅
- [ ] All E2E tests pass ✅

---

## 🚀 START HERE

1. Open `IMPLEMENTATION_GUIDE.md`
2. Read the "Architecture Overview" section
3. Understand the 6 entities
4. Start with the MongoDB schema section
5. Begin Phase 1: Core Infrastructure

IMPLEMENTATION_GUIDE.md has:
- All schemas (copy them)
- All entities (copy them)
- All APIs (build them)
- All phases (9 weeks of work)
- All verification steps
- All success criteria

**Everything is there. No other document needed to build.**

---

## 🎬 Ready?

Go to `interview-worker/documentation/IMPLEMENTATION_GUIDE.md` and start Phase 1.

You have everything you need.

🚀 Let's build this!
