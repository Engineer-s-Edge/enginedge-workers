# Interview Worker - Final Clarifications Needed

**Status:** Awaiting answers to finalize design  
**Date:** October 27, 2025

---

## 🎯 Priority 1: Question Bank Tagging (Critical for Implementation)

### Question 1: What should the tag categories be?

I need to finalize question tags so we can structure the question bank properly.

**Behavioral Interview Tags** (for Phase Type = "behavioral")
Please select/modify from this list:
- `collaboration` - Teamwork, working with others
- `conflict-resolution` - Handling disagreements
- `leadership` - Leading teams, taking charge
- `failure-handling` - Dealing with mistakes
- `learning` - Learning from experience
- `communication` - Explaining/presenting ideas
- `adaptability` - Handling change
- `initiative` - Taking action proactively
- `time-management` - Managing workload/priorities
- `stress-handling` - Under pressure situations
- `customer-focus` - Client/user empathy
- `problem-solving` - Solving problems creatively
- `achievement` - Results-oriented
- `decision-making` - Making tough calls

**Technical Interview Tags** (for Phase Type = "technical")
Please select/modify from this list:
- `system-design` - Designing systems
- `architecture` - High-level design decisions
- `databases` - DB design, queries, optimization
- `apis` - RESTful/GraphQL design
- `scalability` - Handling scale
- `performance` - Optimization, speed
- `security` - Security best practices
- `testing` - Testing strategies
- `debugging` - Troubleshooting
- `design-patterns` - OOP patterns, design principles
- `code-review` - Evaluating code quality
- `devops` - Infrastructure, CI/CD

**Coding Interview Tags** (for Phase Type = "coding")
Please select/modify from this list:
- `data-structures` - Arrays, trees, graphs, etc.
- `algorithms` - Sorting, searching, dynamic programming
- `complexity` - Big O, optimization
- `edge-cases` - Handling corner cases
- `code-quality` - Clean, readable code
- `problem-solving` - Approach and thinking

**Confirm:** Should these tags apply per phase type, or should they be global across all phases?

---

## 🎯 Priority 2: Scoring & Report Structure

### Question 2: How should scoring work?

Option A: **Single Overall Score (0-100)**
- One final score out of 100
- Evaluator LLM assigns based on full interview

Option B: **Per-Phase Scores**
- Score for each phase separately (e.g., Behavioral: 85, Technical: 72, Coding: 68)
- Overall score calculated from weighted average

Option C: **Skill-Based Scores**
- Score per skill demonstrated (e.g., Communication: 8/10, SystemDesign: 7/10, Leadership: 6/10)
- Overall from skill average

**My Recommendation:** Option B (Per-Phase Scores)
- Shows which areas the candidate struggled with
- More actionable feedback
- Aligns with phase weights in rubric
- Easy to understand

**Does this align with your vision?**

---

### Question 3: Hiring Recommendation

Should the final report include a hiring recommendation level?

```
Options:
A) Strong Pass (hire immediately)
B) Pass (good hire)
C) Borderline (need more info)
D) Weak Pass (might work, but concerns)
E) Fail (do not hire)
```

Plus auto-calculation: if score >= 75 → Pass, etc.

**Or just the score and let recruiters decide?**

---

### Question 4: Pass/Fail Threshold

Should interviews have a hard pass/fail threshold?

- Example: Score < 60 = Fail, 60-70 = Borderline, 70+ = Pass

**Or should this be company/job-specific?**

---

## 🎯 Priority 3: Candidate Profile Structure

### Question 5: Candidate Profile - What to Include?

**My Proposal** (I'll implement unless you modify):

```typescript
interface CandidateProfile {
  // Timeline of observations during interview
  observations: [
    {
      timestamp: "2024-01-15T10:05:30Z",
      phase: "behavioral",
      questionId: "q-001",
      observation: "Candidate talked around the question initially, then provided clear answer",
      sentiment: "positive",
      confidence: 0.85,
      tags: ["communication", "clarity"],
    },
    // ... more observations
  ],
  
  // Skills they demonstrated well
  strengths: [
    {
      skill: "System Design",
      evidence: "Discussed load balancing, database sharding, cache strategies",
      confidence: 0.9,
      phase: "technical",
    },
    // ...
  ],
  
  // Areas of concern
  concerns: [
    {
      issue: "Weak on testing practices",
      evidence: "When asked about testing, mentioned 'we don't really test much'",
      severity: "high",
      phase: "technical",
    },
    // ...
  ],
  
  // Resume-specific findings
  resumeNotes: [
    {
      claim: "5 years React experience",
      finding: "Validated - discussed recent React 18 features correctly",
      status: "verified",
    },
    {
      claim: "Led 10-person team",
      finding: "Described managing 3-4 interns, not 10-person team",
      status: "discrepancy",
    },
  ],
  
  // Questions the agent wanted to ask but ran out of time
  followUpSuggested: [
    {
      question: "Tell me about a time you had to make a decision without full information",
      phase: "behavioral",
      reason: "Candidate's answers suggest limited autonomy",
    },
  ],
  
  // Timeline events (pauses, skips, etc.)
  timeline: [
    { type: "phase-transition", from: "behavioral", to: "technical", time: "2024-01-15T10:15:00Z" },
    { type: "pause", duration: 45, reason: "candidate-requested", time: "2024-01-15T10:25:00Z" },
    { type: "skip", questionId: "q-008", reason: "candidate-elected", time: "2024-01-15T10:35:00Z" },
  ],
  
  // Patterns noticed
  redFlags: [
    "Glossed over lack of testing when pressed",
    "Wasn't familiar with industry standards",
  ],
  greenFlags: [
    "Quick thinker, adjusted approach mid-answer",
    "Honest about knowledge gaps",
  ],
}
```

**Is this level of detail what you want?**
**Should anything be added/removed?**

---

## 🎯 Priority 4: Resume Question Integration

### Question 6: How should resume questions be handled?

**My Proposal:**

Every interview agent system prompt includes:
```
"Throughout the interview, you should ask clarifying questions about the candidate's resume.
Focus on verifying claims and understanding their actual hands-on experience.
Difficulty level guide:
- junior: Ask 1-2 resume questions casually
- mid: Ask 3-4 resume questions, probe lightly on claims
- senior: Ask 5+ resume questions, probe discrepancies, verify depth of experience
- expert: Aggressively fact-check every major claim, challenge with deep technical questions"
```

**Questions about this:**
- Should resume questions have specific "slots" in the interview (e.g., one per phase)?
- Or should they be natural, woven throughout?
- Should the agent track which resume claims it has verified vs questioned?

---

## 🎯 Priority 5: Recruiter Dashboard

### Question 7: Do you want live recruiter monitoring?

**Option A: No Live Monitoring (Simplest)**
- Interviews are fully autonomous
- Recruiter only sees final report
- Faster to implement

**Option B: Live Read-Only Dashboard**
- Recruiter can watch interview progress real-time
- See candidate profile updating live
- See transcript as it happens
- Can't interfere

**Option C: Live with Remote Control**
- Recruiter can pause/resume interview
- Can ask agent to skip question or follow-up
- Can take notes

**Option D: Live with Co-Interviewer**
- Recruiter can jump in as co-interviewer
- Both agent and recruiter ask questions

**My Recommendation:** Start with Option A (simplest for MVP), can add B later.

**What's your preference?**

---

## 🎯 Priority 6: Multi-Tenancy & Company Support

### Question 8: Should platform support multiple companies?

**Option A: MVP - Single Company/Shared Resources (Simplest)**
- All users share same question banks
- All users share same interview templates
- All users share same scoring rubrics
- Focus: Get core system working

**Option B: Multi-Company - Isolated Question Banks**
- Each company has own question bank
- But shared interview templates/rubrics
- Medium complexity

**Option C: Full Isolation**
- Each company isolated: question banks, templates, rubrics, custom phase types
- High complexity

**My Recommendation:** Start with Option A (MVP), design with Option B in mind.

**What's your preference?**

---

## 🎯 Priority 7: Recording & Transcription

### Question 9: What should we do with audio/transcripts?

**Storage Options:**

A) **Store Everything in S3**
- Full audio recording + transcript + metadata
- Pro: Complete audit trail
- Con: Storage costs
- Retention: 1 year? 6 months?

B) **Store Only Transcripts**
- Text transcript in MongoDB
- Metadata (timestamps, speaker) in MongoDB
- Pro: Lower storage costs
- Con: Can't replay audio
- Retention: Forever? 2 years?

C) **Hybrid**
- Transcript in MongoDB (forever)
- Audio in S3 (6 months, then delete)
- Metadata in MongoDB

**My Recommendation:** Hybrid (Option C)
- Keeps interview data permanent for audit/reporting
- Reduces storage costs
- Offers replay for disputes

**Agree?**

---

## 🎯 Priority 8: During-Interview UX

### Question 10: What should candidate see during interview?

**Option A: Completely Blind**
- See agent question in text form
- Speak/type response
- Don't see their transcript
- Don't see any scoring or progress
- Most "interview-like"

**Option B: Real-Time Transcript**
- See agent question + agent speaking (audio)
- Type/speak response
- See their own transcript as they type
- Don't see score or progress
- More conversational

**Option C: Full Transparency**
- See transcript
- See current score updating
- See phase progress ("Phase 2 of 3")
- See how many questions left
- Could be stressful

**My Recommendation:** Option B (Real-Time Transcript)
- Feels natural
- Candidate can verify transcript
- Doesn't show scoring (less pressure)

**Preference?**

---

## 🎯 Priority 9: Follow-Up Tags

### Question 11: Should follow-ups have metadata?

When LLM uses `<followup>question-id</followup>` tag, should it also include:

```xml
<followup id="q-001" difficulty="senior" type="clarification">
  "Could you elaborate on what you mean by real-time data?"
</followup>
```

Or just simple format:
```xml
<followup>q-001</followup>
```

**This affects how we track and score follow-ups.**

---

## 🎯 Priority 10: Pause Tracking Detail

### Question 12: How to handle pauses?

Configuration options:

```typescript
interface PauseConfig {
  pauseAllowed: boolean;  // Can candidate pause?
  pauseThreshold: number;  // Seconds before we record it (e.g., 30 seconds)
  maxPauseDuration: number;  // Max pause length (e.g., 600 seconds = 10 min)
  pauseNoticeThreshold: number;  // Warning when approaching max (e.g., 450 sec)
}
```

**Questions:**
- Should very short pauses (< 5 seconds) be tracked at all?
- Should pauses within a response (e.g., "thinking") be treated differently than "candidate steps away"?
- Should there be a max pause duration, or unlimited?

---

## 📋 Summary of What I'm Waiting For

| # | Topic | Options | Impact |
|---|-------|---------|--------|
| 1 | Question Tags | Select/modify tag lists | Question Bank schema |
| 2 | Scoring Type | Single score vs per-phase | Report structure |
| 3 | Hiring Recommendation | Yes/No, auto-calculated? | Report template |
| 4 | Pass/Fail Threshold | Hard threshold vs flexible | Report logic |
| 5 | Profile Content | Accept proposal or modify | MongoDB schema |
| 6 | Resume Questions | Natural or slotted? | Agent prompt |
| 7 | Recruiter Dashboard | None / Read-only / Control / Co-interview | Backend/Frontend scope |
| 8 | Multi-Tenancy | MVP / Isolated / Full | Database design |
| 9 | Recording Storage | S3 audio / Transcript only / Hybrid | Infrastructure |
| 10 | Candidate UX | Blind / Transcript visible / Full transparency | Frontend implementation |
| 11 | Follow-up Format | Simple / Detailed tags | Response parsing |
| 12 | Pause Configuration | Thresholds / handling | State machine |

---

## ⏭️ Next Step

Once you answer these 12 questions, I will:

1. ✅ Finalize MongoDB schemas
2. ✅ Create TypeScript interfaces
3. ✅ Define Interview Agent prompts with examples
4. ✅ Outline WebSocket protocol specifics
5. ✅ Create API endpoint specifications
6. ✅ Update implementation checklist
7. ✅ Ready for coding!

**Please respond to as many as you can, or let me know if you want me to make executive decisions on any (I'll implement what makes the most sense).**
