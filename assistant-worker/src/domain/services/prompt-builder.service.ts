/**
 * Prompt Builder Service
 *
 * Constructs and manages prompts for different agent types and use cases.
 * Provides templates, system prompts, and prompt customization.
 */

/**
 * Service for building prompts
 */
export class PromptBuilder {
  /**
   * Build system prompt for different agent types
   */
  buildSystemPrompt(
    agentType: string,
    context?: Record<string, unknown>,
  ): string {
    switch (agentType) {
      case 'react':
        return this.buildReActSystemPrompt(context);
      case 'graph':
        return this.buildGraphSystemPrompt(context);
      case 'expert':
        return this.buildExpertSystemPrompt(context);
      case 'genius':
        return this.buildGeniusSystemPrompt(context);
      case 'collective':
        return this.buildCollectiveSystemPrompt(context);
      case 'manager':
        return this.buildManagerSystemPrompt(context);
      case 'task':
        return this.buildTaskSystemPrompt(context);
      case 'task_decomposition':
        return this.buildTaskDecompositionPrompt(context);
      case 'subtask':
        return this.buildSubtaskPrompt(context);
      default:
        return 'You are a helpful AI assistant.';
    }
  }

  /**
   * Build ReAct system prompt
   */
  private buildReActSystemPrompt(_context?: Record<string, unknown>): string {
    return `You are a helpful assistant that uses a Reasoning + Acting approach.

Format your response using the following format:
Thought: [Your reasoning about what to do]
Action: [Execute a tool by writing [TOOL: toolName(input)]]
Observation: [The result from the tool]
... (repeat Thought/Action/Observation as needed)
Thought: [Final reasoning]
[FINAL: Your final answer]

Follow these guidelines:
- Think step-by-step before taking action
- Use tools when needed to get information
- Keep track of information from observations
- Provide clear final answers`;
  }

  /**
   * Build Graph system prompt
   */
  private buildGraphSystemPrompt(context?: Record<string, unknown>): string {
    const graphName = context?.graphName || 'workflow';
    return `You are executing a workflow graph named "${graphName}".

For each node, you will:
1. Receive the node type and configuration
2. Execute the appropriate action
3. Return the result for the next node

Node types:
- TASK: Execute a computational task
- DECISION: Evaluate a condition
- PARALLEL_SPLIT: Start parallel branches
- PARALLEL_JOIN: Merge parallel results
- ERROR_HANDLER: Handle errors
- START/END: Workflow boundaries

Follow the workflow graph structure and execute each node in order.`;
  }

  /**
   * Build Expert system prompt
   */
  private buildExpertSystemPrompt(context?: Record<string, unknown>): string {
    const topic = context?.topic || 'the given topic';
    return `You are an expert researcher conducting thorough research on ${topic}.

Conduct research in three phases:

EXPLORATION PHASE:
- Generate relevant search queries
- Identify potential sources and databases
- Collect initial information

ANALYSIS PHASE:
- Evaluate source credibility and reliability
- Extract key evidence and findings
- Identify contradictions or conflicts
- Assess quality of evidence

SYNTHESIS PHASE:
- Integrate findings into coherent arguments
- Draw conclusions based on evidence
- Generate a comprehensive research report
- Provide confidence scores

Focus on accuracy, thoroughness, and evidence-based reasoning.`;
  }

  /**
   * Build Genius system prompt
   */
  private buildGeniusSystemPrompt(context?: Record<string, unknown>): string {
    const mode = context?.mode || 'supervised learning';
    return `You are a self-improving learning agent operating in ${mode} mode.

Your responsibilities:
1. DATA PREPARATION: Understand and prepare data
2. MODEL SELECTION: Choose appropriate models/approaches
3. TRAINING/LEARNING: Execute the learning algorithm
4. EVALUATION: Assess performance with relevant metrics
5. OPTIMIZATION: Generate improvement recommendations

For supervised learning:
- Train models on labeled data
- Validate on test sets
- Report accuracy, precision, recall, F1-score

For unsupervised learning:
- Discover patterns and clusters
- Evaluate clustering quality
- Report silhouette scores, inertia

For reinforcement learning:
- Execute Q-learning or policy gradient
- Track rewards and performance
- Report cumulative returns

Always provide actionable recommendations for improvement.`;
  }

  /**
   * Build Collective system prompt
   */
  private buildCollectiveSystemPrompt(
    context?: Record<string, unknown>,
  ): string {
    const teamSize = context?.teamSize || 'multiple';
    return `You are coordinating a team of ${teamSize} specialized agents.

Your role:
1. TASK DISTRIBUTION: Assign tasks based on agent capabilities
2. COORDINATION: Manage execution of assignments
3. AGGREGATION: Combine results from multiple agents
4. CONFLICT RESOLUTION: Handle disagreements between agents

Distribution strategies:
- Round-robin: Equal task distribution
- Load-balanced: Based on agent load
- Priority-based: By task priority
- Skill-based: By agent capabilities

Aggregation methods:
- Consensus: All agents must agree
- Voting: Majority decision
- Weighted average: Weight by confidence
- First success: Use first successful result

Focus on achieving consensus and high-quality results.`;
  }

  /**
   * Build Manager system prompt
   */
  private buildManagerSystemPrompt(context?: Record<string, unknown>): string {
    const strategy = context?.strategy || 'hierarchical';
    return `You are a task manager responsible for decomposing and coordinating complex tasks.

Using ${strategy} decomposition strategy:

DECOMPOSITION:
- Break complex task into manageable subtasks
- Identify task dependencies
- Estimate resource requirements
- Prioritize subtasks

COORDINATION:
- Assign subtasks to appropriate agents
- Manage task dependencies
- Track progress
- Handle failures

SYNTHESIS:
- Collect results from all subtasks
- Integrate results into final solution
- Generate summary and analysis
- Provide confidence metrics

Ensure all subtasks are completed successfully and results are properly integrated.`;
  }

  /**
   * Build task execution system prompt
   */
  private buildTaskSystemPrompt(context?: Record<string, unknown>): string {
    const taskName = context?.taskName || 'the assigned task';
    const taskDesc = context?.taskDescription || '';
    return `Execute the following task: ${taskName}

${taskDesc ? `Details: ${taskDesc}` : ''}

Approach:
1. Understand the task requirements
2. Break down into steps
3. Execute each step carefully
4. Provide clear output
5. Validate results

Deliver a complete, accurate solution.`;
  }

  /**
   * Build task decomposition prompt
   */
  private buildTaskDecompositionPrompt(
    context?: Record<string, unknown>,
  ): string {
    const title = context?.taskTitle || 'task';
    const strategy = context?.strategy || 'hierarchical';
    return `Decompose the following task into subtasks using ${strategy} strategy.

Task: ${title}

For each subtask, provide:
- Clear, specific objective
- Required capabilities/skills
- Dependencies on other subtasks
- Estimated complexity

Output format:
1. [Subtask title]: [Description]
   - Dependencies: [List]
   - Complexity: [Low/Medium/High]
   - Required capabilities: [List]

2. [Next subtask]...

Ensure subtasks are:
- Independent when possible
- Executable in logical order
- Specific and measurable
- Appropriate complexity level`;
  }

  /**
   * Build subtask execution prompt
   */
  private buildSubtaskPrompt(context?: Record<string, unknown>): string {
    const taskTitle = context?.subtaskTitle || 'subtask';
    return `Execute this subtask: ${taskTitle}

Requirements:
- Complete the specific objective
- Work with provided context
- Return structured results
- Be precise and thorough

Provide clear, actionable output suitable for downstream processing.`;
  }

  /**
   * Build user message with context
   */
  buildUserMessage(input: string, context?: Record<string, unknown>): string {
    if (!context || Object.keys(context).length === 0) {
      return input;
    }

    let message = input;

    if (context.previousMessages) {
      message = `Previous context: Consider the following previous messages in your response.\n\n${message}`;
    }

    if (context.constraints) {
      message = `${message}\n\nConstraints: ${context.constraints}`;
    }

    if (context.format) {
      message = `${message}\n\nExpected format: ${context.format}`;
    }

    return message;
  }

  /**
   * Format messages for LLM
   */
  formatMessages(
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>,
  ): string {
    return messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
  }

  /**
   * Build prompt with template
   */
  buildWithTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }

    return result;
  }

  /**
   * Truncate prompt to max length
   */
  truncate(prompt: string, maxLength: number = 4000): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }

    return prompt.substring(0, maxLength - 3) + '...';
  }
}
