# ✅ All 12 Clarifications - RESOLVED

**Date:** October 27, 2025  
**Status:** All answers finalized, design updated

---

## 1. Question Tag Categories ✅

**RESOLVED:** Split technical into `tech-trivia` and `system-design`

**Final Tags:**

| Category | Subcategories |
|----------|----------------|
| **Behavioral** | experience-based questions |
| **Tech-Trivia** | concepts, definitions, quick recalls |
| **System-Design** | architecture, scalability, trade-offs |
| **Coding** | Leetcode categories (arrays, tree, graph, etc.) |

**Resume Questions:**
- Allowed in: behavioral + tech-trivia + system-design
- NOT allowed in: coding sections

---

## 2. Scoring Structure ✅

**RESOLVED:** Option B - Per-phase scores

**Implementation:**
```json
{
  "overall": 0-100,
  "byPhase": {
    "behavioral": 0-100,
    "technical": 0-100,
    "coding": 0-100
  }
}
```

**Note:** Score is arbitrary but required for feedback.

---

## 3. Hiring Recommendations ✅

**RESOLVED:** NONE

This is a **PRACTICE tool**, not production hiring.
- NO "Pass/Fail"
- NO recommendation levels
- NO hiring decisions
- Just score + feedback

---

## 4. Pass/Fail Threshold ✅

**RESOLVED:** NO THRESHOLD

This is a **PRACTICE tool**, not a decision system.
- NO scoring-based decisions
- Candidate decides if they did well
- Just feedback

---

## 5. Candidate Profile Enhancement ✅

**RESOLVED:** Tool-based with detailed fields

**Profile has:**
- `strengths[]` - What went well
- `concerns[]` - Areas to improve
- `resumeFindings{}` - Verified, questioned, deep-dived
- `adaptability` - How they handled hard questions
- `communicationStyle` - How they explained solutions
- `interviewFlow{}` - Pauses, skips, duration
- `keyInsights` - Recruiter-like summary

**Built via two tool calls:**
1. `append_observation(category, text)` - Add to profile
2. `recall_profile()` - Get current profile (maintain context)

---

## 6. Prompts are First-Class Citizens ✅

**RESOLVED:** User controls ALL behavior

**How it works:**
- Separate prompt files per difficulty (easy, medium, hard, custom)
- Agent gets ONE prompt (selected difficulty or custom)
- Agent does NOT know about other difficulties
- Agent organically handles everything from prompt
- Prompt specifies: "Don't ask resume in coding sections"
- Prompt specifies: "Append observations as you go"

**Agent NEVER:**
- Makes hiring decisions
- Knows about difficulty levels
- Violates prompt instructions

---

## 7. Recruiter Dashboard ✅

**RESOLVED:** NONE

This is a **PRACTICE tool**, not a service.
- NO live monitoring
- NO recruiter access
- NO real-time dashboards

**What IS available:**
- Candidate sees their reports
- Candidate can export transcript

---

## 8. Multi-Tenancy ✅

**RESOLVED:** Single-user per session

This is a **PRACTICE tool**, not multi-tenant.
- One user per session
- No company-level access
- No cross-user analytics

---

## 9. Recording Storage ✅

**RESOLVED:** Transcripts to MongoDB, NO audio

**Store:**
- ✅ Full transcript (text) in MongoDB
- ✅ Metadata (duration, pauses, skips)

**Do NOT Store:**
- ❌ Audio files (never)
- ❌ Video files (never)

---

## 10. Candidate UI Visibility ✅

**RESOLVED:** Completely blind to scoring

**Candidate SEES:**
- Transcript
- Questions asked
- Code submission panels (for coding questions)
- Drag-drop system design (for sys-des)

**Candidate DOES NOT SEE:**
- Real-time scoring
- Agent evaluation
- Progress bar
- Performance hints

**After Interview:**
- Final score (0-100)
- Detailed feedback
- Observations/insights
- Areas to improve

---

## 11. Follow-up Tracking ✅

**RESOLVED:** By question ID with limit

**Format:**
```typescript
{
  type: "followup",
  followupForQuestionId: string,
  text: string,
  depth: number // How many followups for this question
}
```

**Enforcement:**
- Count per `questionId`
- Enforce limit (e.g., max 3 per question)
- Limit set in prompt or config

---

## 12. Pause/Skip Configuration ✅

**RESOLVED:** Infinite pause, always allowed

**Pause Rules:**
- ✅ Can pause anytime
- ✅ NO maximum duration (hardcoded infinity)
- ✅ NO notice threshold
- Reason: Candidate needs washroom break, etc.

**Skip Rules:**
- ✅ Can skip any question
- ✅ Recorded in transcript
- ✅ Considered in feedback

**Configuration:**
```typescript
{
  pauseConfig: {
    allowPause: true,
    maxPauseDuration: null, // Infinity
    pauseNoticeThreshold: null
  },
  skipConfig: {
    allowSkip: true
  }
}
```

---

## 🎯 Summary of Changes from Original Design

| Item | Original Design | New Design | Why |
|------|-----------------|-----------|-----|
| **Purpose** | Production hiring | Practice tool | Clarification |
| **Question Tags** | Single "technical" | Split to tech-trivia + sys-design | More granular |
| **Hiring Decisions** | Pass/Fail/Recommendation | None | Practice, not hiring |
| **Scoring** | Arbitrary but deliberated | Arbitrary + per-phase | Simpler feedback |
| **Dashboard** | Recruiter monitoring | None | Practice tool |
| **Multi-Tenancy** | Shared or isolated | Single-user per session | Practice tool |
| **Recording** | Transcript + audio 6mo | Transcript only (forever) | No audio storage |
| **Candidate UI** | Hidden scoring initially | Completely blind until end | Better focus |
| **Profile Building** | Service-based | Tool-call based | Agent control |
| **Prompts** | Generated | First-class files (user-provided) | User controls behavior |
| **Pause Limit** | Configurable threshold | None (infinite) | Real-life needs |
| **Follow-up Tracking** | By depth | By question ID + depth | Better enforcement |

---

## 🚀 Impact on Implementation

### Simplified (Faster to Build):
- ❌ Remove all hiring logic (pass/fail, thresholds, etc.)
- ❌ Remove recruiter dashboards
- ❌ Remove multi-tenancy complexity
- ❌ Remove audio storage/retrieval

### Enhanced (More Detailed):
- ✅ Richer candidate profile (more fields)
- ✅ Better follow-up tracking (by question ID)
- ✅ Flexible prompts (user-provided files)
- ✅ Profile tool calls (append + recall)

### Same/Unchanged:
- ✅ Hexagonal architecture
- ✅ WebSocket for real-time interaction
- ✅ MongoDB persistence
- ✅ Speech I/O support
- ✅ State machine for sessions
- ✅ LLM-based evaluation

---

## 📋 Implementation Priority

### Must-Have (Block implementation):
1. ✅ Question tagging (behavioral, tech-trivia, sys-design, coding)
2. ✅ Candidate profile with tool calls
3. ✅ Prompts as user-provided files
4. ✅ Transcript-only storage (no audio)
5. ✅ Pause/skip with no limits

### Nice-to-Have:
- Drag-drop for system design (frontend)
- Code panels for coding questions (frontend)
- Advanced profile insights
- Analytics/reporting

---

## 📍 Which Document to Give Coding Agents?

**PRIMARY:** `IMPLEMENTATION_GUIDE.md`
- Everything they need to build
- Complete schemas, APIs, entities
- 9 phases with deliverables
- Tool implementations
- Verification checklist

**REFERENCE:**
- `COMPREHENSIVE_DESIGN.md` - Feature details
- `VISUAL_REFERENCE.md` - Flow diagrams
- `UPDATED_ARCHITECTURE.md` - More implementation examples

**Skip:**
- This file (for your records)
- CLARIFICATIONS_NEEDED.md (old, all resolved)
- INDEX.md (for navigation only)

---

## 🎓 Key Mental Model for Agents

> This is a **practice platform for candidates to prepare for interviews**.
> 
> - User = Candidate (not company)
> - Interview config = Practice scenario
> - Agent = Practice interviewer
> - Profile = Candidate's learning insights
> - Report = Feedback for improvement
> 
> NOT: Autonomous hiring system, production decision tool, multi-tenant service

---

**Status:** 🟢 READY TO IMPLEMENT  
**Handed to Coding Agents:** IMPLEMENTATION_GUIDE.md + supporting docs  
**Build Time:** ~9 weeks (9 phases, 1 week each)
