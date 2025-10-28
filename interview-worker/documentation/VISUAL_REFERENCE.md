# Interview Worker - Visual Architecture Reference

**Date:** October 27, 2025

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CANDIDATE BROWSER                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Interview UI                                                        │  │
│  │  ├─ Interview Question (text)                                      │  │
│  │  ├─ WebRTC Audio Input/Output                                     │  │
│  │  ├─ Real-time Transcript                                          │  │
│  │  ├─ Answer Submission (voice or text)                             │  │
│  │  ├─ Pause/Skip/End Interview Controls                             │  │
│  │  └─ No visible scoring or progress (to reduce pressure)           │  │
│  └──────────────────┬───────────────────────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────────────────────────┘
                      │ WebSocket
                      │ (Audio chunks + Transcripts)
         ┌────────────┴────────────┐
         │                         │
    ┌────▼──────────────┐  ┌──────▼─────────────┐
    │ Interview Worker  │  │ Assistant Worker   │
    │ (Port 3004)       │  │ (Port 3001)        │
    │                   │  │                    │
    │  ┌─────────────┐  │  │  ┌──────────────┐  │
    │  │ Controllers│  │  │  │  Controllers │  │
    │  │ ├─ Session │  │  │  │  ├─ Agents   │  │
    │  │ ├─ Question│  │  │  │  └─ Memories │  │
    │  │ └─ Report  │  │  │  └──────────────┘  │
    │  └────────────┘  │  │                    │
    │                  │  │  ┌──────────────┐  │
    │  ┌─────────────┐ │  │  │ Domain       │  │
    │  │ Application │ │  │  │ ├─ Agents    │  │
    │  │ ├─ Interview│ │  │  │ ├─ Memory    │  │
    │  │ ├─ Question │ │  │  │ ├─ Factories │  │
    │  │ ├─ Profile  │ │  │  │ └─ Services  │  │
    │  │ └─ Evaluate │ │  │  └──────────────┘  │
    │  └─────────────┘ │  │                    │
    │                  │  │  ┌──────────────┐  │
    │  ┌─────────────┐ │  │  │ Infrastructure
    │  │ Domain      │ │  │  │ ├─ Adapters  │  │
    │  │ ├─ Entities │ │  │  │ ├─ Repos    │  │
    │  │ ├─ Values   │ │  │  │ └─ Services  │  │
    │  │ ├─ Ports    │ │  │  └──────────────┘  │
    │  │ └─ Services │ │  │                    │
    │  └─────────────┘ │  │                    │
    │                  │  └────────────────────┘
    │  ┌─────────────┐ │
    │  │ Infrastructure
    │  │ ├─ Repos    │
    │  │ ├─ STT      │
    │  │ ├─ TTS      │
    │  │ └─ WebSocket│
    │  └─────────────┘
    │                  │
    └──────┬───────────┘
           │
           ├─────────────────────┬─────────────┬──────────────┐
           │                     │             │              │
       MongoDB             Google STT       Google TTS    Kafka (Events)
        (Sessions,        (Transcription)  (Speech Gen)   (Publish Results)
        Questions,
        Profiles,
        Reports)
```

---

## Interview Session Lifecycle

```
CANDIDATE JOINS
    ↓
[Session Created]
    ├─ Session ID: uuid
    ├─ Candidate ID: linked
    ├─ Interview ID: template
    └─ Start Time: now
    ↓
[Load Interview Template]
    ├─ Load selected questions
    ├─ Load resume (if provided)
    ├─ Generate system prompt (difficulty-aware)
    └─ Initialize candidate profile
    ↓
[Initialize Interview Agent]
    ├─ Create InterviewAgent instance
    ├─ Load Conversation Memory
    ├─ Load Candidate Profile Memory
    ├─ Set system prompt (Phase 1)
    └─ Connect WebSocket
    ↓
[INTERVIEW LOOP] ════════════════════════════════════════
    ↓
[Generate Question]
    ├─ LLM creates contextual question from template
    ├─ Elaborates based on difficulty
    └─ Possibly starts with resume question
    ↓
[Stream Question to Candidate]
    ├─ Send via WebSocket
    ├─ Agent speaks (TTS)
    └─ Show text in UI
    ↓
[Candidate Answers]
    ├─ Option A: Voice input → STT conversion
    ├─ Option B: Text input directly
    └─ Both stored in transcript
    ↓
[Analyze Response]
    ├─ LLM evaluates answer
    ├─ Scores quality (0-10)
    ├─ Identifies strengths/concerns
    ├─ Updates Candidate Profile
    └─ Decides: Follow-up? Next? Skip?
    ↓
[Decision Point]
    ├─ If Follow-up Needed (XML tagged):
    │   └─ Ask follow-up (doesn't count as new question)
    │
    ├─ If More Questions in Phase:
    │   └─ LOOP: Generate Question
    │
    ├─ If Phase Transition Triggered:
    │   ├─ Move to next phase
    │   ├─ Update system prompt
    │   └─ LOOP: Generate Question
    │
    └─ If Interview Complete:
        └─ Break loop → Finalize
    ↓
[END INTERVIEW LOOP] ════════════════════════════════════
    ↓
[Finalize Interview]
    ├─ Record end time
    ├─ Compile final candidate profile
    └─ Collect all responses
    ↓
[Call Evaluator LLM]
    ├─ Input: Full conversation + Profile
    ├─ Process: Score 0-100 + feedback
    └─ Output: Structured evaluation
    ↓
[Generate Report]
    ├─ Score breakdown
    ├─ Strengths/improvements
    ├─ Recommendations
    ├─ Candidate profile summary
    └─ Transcript link
    ↓
[Publish Events]
    ├─ Kafka: interview.completed
    ├─ Kafka: candidate.profile.final
    ├─ Store report in MongoDB
    └─ Send to candidate
    ↓
INTERVIEW COMPLETE
    └─ Candidate receives report immediately
```

---

## Interview Agent State Machine

```
START
  │
  ├─ Load config
  ├─ Load questions
  ├─ Load resume
  └─ Generate prompt
  │
  ↓
PHASE_1_START ──┐
  │              │
  ├─ Generate Q1 │ (Behavioral/Technical/Coding/etc)
  ├─ Wait answer │
  ├─ Analyze     │ (Can loop for follow-ups)
  ├─ Update prof │
  ├─ Generate Q2 │
  ├─ Wait answer │
  ├─ Analyze     │
  ├─ Update prof │
  └─ Generate QN │
  │              │
  └─ Check transition ─┐
                        │
  ↓                     │
PHASE_TRANSITION_CHECK  │
  │                     │
  ├─ Score > threshold? ├─ YES ─┐
  ├─ Time limit hit?    ├─ YES ─┤
  ├─ N questions asked? ├─ YES ─┤
  ├─ LLM says "move"?   ├─ YES ─┤
  └─ Default timeout?   ├─ YES ─┘
                        │
                        ├─ NO ─────┐
                                   │
  ┌──────────────────────────────┐ │
  │ More Questions in Same Phase?│ │
  │ Or Follow-ups Needed?        │─┘
  └──────────────────────────────┘
                  │
              ┌───┴───┐
              │       │
          YES │       │ NO
              │       │
              ↓       ↓
         NEXT_Q   PHASE_2_START (if exists)
          (loop)   or COMPLETE
              │       │
              └───┬───┘
                  │
                  ↓
          [All Phases Complete?]
                  │
              ┌───┴───┐
              │       │
             NO      YES
              │       │
              ↓       ↓
          (never   FINALIZE
           reached) ↓
               GENERATE_REPORT
                 ↓
               COMPLETE
```

---

## Question Selection Flow

```
RECRUITER CONFIGURES INTERVIEW
  │
  ├─ Selects interview type(s):
  │  ├─ Behavioral (1st)
  │  ├─ Technical (2nd)
  │  └─ Coding Challenge (3rd)
  │
  ├─ For each phase, selects:
  │  ├─ Number of questions (4-5)
  │  ├─ Preferred tags ["leadership", "communication"]
  │  ├─ Exclude tags ["collaboration"] (already asked)
  │  └─ Can add custom questions
  │
  └─ Sets difficulty: "senior"
     │
     ↓
QUESTION SELECTION ALGORITHM
  │
  ├─ For Behavioral phase:
  │  │
  │  ├─ Query: type=behavioral, tags contains ["leadership" OR "communication"]
  │  │         difficulty >= "mid", not in excludedTags
  │  │
  │  ├─ Results: [Q-lead-001, Q-comm-001, Q-lead-002, Q-comm-002, ...]
  │  │
  │  ├─ Select algorithm (1-2 per tag):
  │  │  ├─ 1 leadership question (Q-lead-001)
  │  │  ├─ 1 communication question (Q-comm-001)
  │  │  ├─ 1 leadership question (Q-lead-002)
  │  │  └─ + any custom questions
  │  │
  │  └─ Result: 4-5 diverse questions
  │
  ├─ For Technical phase:
  │  └─ Similar selection process
  │
  └─ For Coding phase:
     └─ Similar selection process
     │
     ↓
QUESTIONS LOADED FOR INTERVIEW
  │
  ├─ Interview Agent receives:
  │  ├─ Selected questions list
  │  ├─ Tags for each question
  │  ├─ Difficulty level
  │  └─ Instructions to elaborate
  │
  └─ Agent elaborates on each, asks follow-ups naturally
     (follow-ups don't use up question count)
```

---

## Data Flow: Candidate Profile Building

```
CANDIDATE ANSWERS QUESTION
  │
  ├─ Response text/audio captured
  ├─ STT converts if needed
  └─ Response saved to transcript
      │
      ↓
INTERVIEW AGENT ANALYZES
  │
  ├─ LLM receives:
  │  ├─ Question asked
  │  ├─ Candidate response
  │  ├─ Previous answers (context)
  │  └─ Resume (for fact-checking)
  │
  ├─ LLM analyzes for:
  │  ├─ Quality/correctness (0-10 score)
  │  ├─ Strengths demonstrated
  │  ├─ Concerns/gaps
  │  ├─ Resume alignment
  │  └─ Suggested follow-ups
  │
  └─ LLM returns structured analysis:
     {
       "score": 7,
       "strengths": ["clear thinking", "practical approach"],
       "concerns": ["limited testing knowledge"],
       "resumeFindings": {"claim": "...", "status": "verified"},
       "followupSuggested": ["Tell me about your testing..."],
       "sentiment": "positive"
     }
      │
      ↓
PROFILE UPDATE
  │
  ├─ Add observation to profile:
  │  {
  │    "timestamp": "2024-01-15T10:05:30Z",
  │    "phase": "behavioral",
  │    "observation": "Clear thinking, practical approach",
  │    "sentiment": "positive",
  │    "tags": ["problem-solving", "communication"]
  │  }
  │
  ├─ Update strengths list:
  │  {"skill": "Problem-Solving", "evidence": "...", "confidence": 0.9}
  │
  ├─ Add to concerns (if any):
  │  {"issue": "Limited testing knowledge", "severity": "medium"}
  │
  ├─ Add resume findings (if checked):
  │  {"claim": "...", "finding": "...", "status": "verified"}
  │
  ├─ Update assessment scores:
  │  {
  │    "technicalSkills": 7,
  │    "communicationClarity": 8,
  │    "problemSolving": 7
  │  }
  │
  └─ Persist to MongoDB
     │
     ↓
DECISION: WHAT TO FOLLOW UP ON?
  │
  ├─ If concerns identified:
  │  └─ Ask follow-up (wrapped in <followup> tags)
  │
  ├─ If score high:
  │  └─ Move to next question
  │
  ├─ If score low:
  │  └─ Ask more follow-ups to understand
  │
  └─ If time/questions limit:
     └─ Maybe skip follow-up, move on
      │
      ↓
PROFILE NOW UPDATED
  └─ Agent uses updated profile for next decision
     (harder questions if doing well, or dig deeper on concerns)
```

---

## Follow-Up System Flow

```
AGENT RESPONSE WITH FOLLOW-UPS

Main content:
"That's a great answer about your system design approach.
<followup id="q-002-followup-1">
I'm curious about your database choice. Why did you select PostgreSQL over MongoDB?
</followup>

You mentioned real-time updates as a constraint...
<followup id="q-002-followup-2">
How would you handle scenarios where write-heavy operations exceed your database capacity?
</followup>"

Response Parsing:
  ├─ Extract main content (outside tags)
  ├─ Extract follow-ups:
  │  ├─ questionId: "q-002-followup-1"
  │  ├─ text: "I'm curious about your database choice..."
  │  └─ sequence: 1
  │
  │  ├─ questionId: "q-002-followup-2"
  │  ├─ text: "How would you handle scenarios..."
  │  └─ sequence: 2
  │
  ├─ Question Counter:
  │  ├─ Primary questions asked: 2
  │  ├─ Follow-ups asked: 2 (THESE DON'T INCREMENT COUNTER)
  │  └─ Max follow-ups config: 3 (under limit, can ask more)
  │
  └─ Decision:
     ├─ Can ask more follow-ups? (2 < 3)
     ├─ Candidate answering well? (score 7/10)
     └─ Should move to next question? (probably yes)

STORED IN RESPONSE OBJECT:
{
  "questionId": "q-002",
  "responseText": "My approach was to use PostgreSQL...",
  "mainAnswerText": "That's a great answer... [without followup tags]",
  "followUps": [
    {
      "id": "q-002-followup-1",
      "text": "I'm curious about your database choice...",
      "sequence": 1,
      "score": 8
    },
    {
      "id": "q-002-followup-2",
      "text": "How would you handle scenarios...",
      "sequence": 2,
      "score": 6
    }
  ],
  "totalFollowUpsForQuestion": 2,
  "maxAllowed": 3,
  "canAskMore": true
}
```

---

## Report Generation Process

```
INTERVIEW COMPLETES
  │
  ├─ Compile:
  │  ├─ Full conversation history
  │  ├─ Candidate profile (observations, strengths, concerns, flags)
  │  ├─ Timeline of pauses/skips
  │  ├─ Resume findings
  │  └─ Interview metadata (duration, phases, etc)
  │
  └─ Prepare evaluator input
      │
      ↓
EVALUATOR LLM CALL (Simple, Single Call)
  │
  ├─ Send to LLM:
  │  {
  │    "prompt": "[System prompt asking for evaluation]",
  │    "context": {
  │      "conversationHistory": [...full transcript...],
  │      "candidateProfile": {...profile object...},
  │      "difficulty": "senior",
  │      "duration": 45,
  │      "pauseSkipTimeline": [...]
  │    }
  │  }
  │
  ├─ LLM evaluates:
  │  ├─ Overall score 0-100
  │  ├─ Per-phase scores (if configured)
  │  ├─ Strengths with evidence (3-5)
  │  ├─ Areas for improvement (3-5)
  │  ├─ Hiring recommendation
  │  ├─ Red/green flags
  │  └─ Summary paragraph
  │
  └─ LLM considers:
     ├─ Pauses (negative factor, feedback on preparation)
     ├─ Skips (negative factor, knowledge concerns)
     ├─ Resume discrepancies (if found)
     ├─ Overall consistency (lying/BS detection)
     └─ Alignment with difficulty level
      │
      ↓
EVALUATION RESULT RECEIVED
  │
  {
    "overallScore": 78,
    "perPhaseScores": {
      "behavioral": 82,
      "technical": 75,
      "coding": 72
    },
    "recommendation": "pass",
    "strengths": [
      "Strong system design thinking",
      "Clear communication of ideas",
      "Practical problem-solving approach"
    ],
    "areasForImprovement": [
      "Deeper knowledge of database optimization needed",
      "More experience with real-time systems recommended",
      "Practice with scalability patterns"
    ],
    "keyObservations": [
      "Candidate hesitated on follow-ups about testing",
      "Strong when discussing architecture",
      "One notable pause when discussing performance optimization"
    ],
    "pauseSkipFeedback": "2 pauses recorded (one 30s, one 45s). Consider practicing answers to technical questions before next interview.",
    "overallSummary": "Strong mid-level candidate with good fundamentals but some gaps in advanced technical areas. Suitable for senior role with training in scalability patterns."
  }
      │
      ↓
GENERATE FINAL REPORT
  │
  ├─ Compile:
  │  ├─ Score (out of 100): 78
  │  ├─ Recommendation: PASS
  │  ├─ Strengths (with evidence)
  │  ├─ Areas to Improve (with suggestions)
  │  ├─ Key Observations
  │  ├─ Resume Alignment
  │  ├─ Interview Timeline (phases, pauses, skips)
  │  ├─ Candidate Profile (concise summary)
  │  ├─ Transcript Link
  │  └─ Recording Link (if stored)
  │
  └─ Store in MongoDB:
     {
       "sessionId": "xxx",
       "candidateId": "yyy",
       "report": {...evaluation output...},
       "createdAt": "2024-01-15T11:00:00Z"
     }
      │
      ↓
DELIVER TO CANDIDATE
  │
  ├─ Send via email/UI
  ├─ Include: Score, feedback, suggestions
  └─ No hiring decision visible (recruiter only)
      │
      ↓
NOTIFY RECRUITER
  │
  ├─ New report available
  ├─ Quick summary (score + recommendation)
  └─ Link to full report
      │
      ↓
PUBLISH KAFKA EVENTS
  │
  ├─ enginedge.interview.session.completed
  ├─ enginedge.interview.session.report_generated
  └─ enginedge.interview.candidate.profile_final
      │
      ↓
DONE ✓
```

---

## Multi-User Concurrency

```
Interview Worker Serving Multiple Candidates

┌────────────────────────────────────────────────────────┐
│         Interview Worker (NestJS)                      │
│                                                        │
│  Session Manager (In-Memory + MongoDB)                │
│                                                        │
│  ├─ Session 001 (Candidate A)                         │
│  │  ├─ Interview Agent Instance 1                     │
│  │  ├─ Candidate Profile Memory 1                     │
│  │  ├─ WebSocket Connection 1                         │
│  │  ├─ Conversation History 1                         │
│  │  └─ Audio Buffer 1                                 │
│  │                                                    │
│  ├─ Session 002 (Candidate B)                         │
│  │  ├─ Interview Agent Instance 2                     │
│  │  ├─ Candidate Profile Memory 2                     │
│  │  ├─ WebSocket Connection 2                         │
│  │  ├─ Conversation History 2                         │
│  │  └─ Audio Buffer 2                                 │
│  │                                                    │
│  ├─ Session 003 (Candidate C)                         │
│  │  ├─ Interview Agent Instance 3                     │
│  │  ├─ Candidate Profile Memory 3                     │
│  │  ├─ WebSocket Connection 3                         │
│  │  ├─ Conversation History 3                         │
│  │  └─ Audio Buffer 3                                 │
│  │                                                    │
│  └─ Session 004 (Candidate D)                         │
│     ├─ Interview Agent Instance 4                     │
│     ├─ Candidate Profile Memory 4                     │
│     ├─ WebSocket Connection 4                         │
│     ├─ Conversation History 4                         │
│     └─ Audio Buffer 4                                 │
│                                                        │
│  Key:                                                  │
│  - Each session completely isolated                   │
│  - Async operations (no blocking)                     │
│  - NestJS request context per session                 │
│  - MongoDB transactions for consistency               │
│  - Automatic cleanup on completion (90 min timeout)   │
│                                                        │
└────────────────────────────────────────────────────────┘
         │                │                │
         │                │                │
    MongoDB         Google STT         Google TTS
    (Separate       (Rate-limited)     (Rate-limited)
   connections      Per candidate      Per candidate)
  per session)
```

---

## Document Navigation

- 📄 **COMPREHENSIVE_DESIGN.md** - Start here for full understanding
- 📄 **UPDATED_ARCHITECTURE.md** - Implementation-focused with code examples
- 📄 **CLARIFICATIONS_NEEDED.md** - 12 decisions to finalize
- 📄 **DESIGN_COMPLETE_SUMMARY.md** - Executive summary of all 4 docs
- 📄 **VISUAL_REFERENCE.md** - This document (diagrams and flows)

---

**Next Step:** Answer the 12 questions in `CLARIFICATIONS_NEEDED.md` and we're ready to code! 🚀
