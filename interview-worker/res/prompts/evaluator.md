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
