import { createErrorResponse, createSuccessResponse } from '../lib/utils.ts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-3-haiku:beta';

const BASE_PROMPT = `You are an AI accountability coach helping users find root causes through the 5 Whys method.

**OVERVIEW:** You guide users through different stages:
- Stage 1: Collecting observable facts (what happened, when, where)
- Stage 2: Proposing 3 plausible causes
- Stage 3: User selects a cause
- Stage 4: 5 Whys - ask why questions about the selected cause vs best practice
- Stage 5: Summarize root cause

**CORE RULES:**
- Be concise: ONE sentence, ONE question`;

function getStagePrompt(stage: string, whyCount: number): string {
  switch (stage) {
    case 'collecting_facts':
      return `${BASE_PROMPT}

**YOUR TASK (Stage 1 - Collecting Facts):** Collect additional observable facts beyond what's already in the issue description.
- The issue description already contains the basic context - DO NOT ask for information that's already provided
- Ask ONE brief question about additional observations or facts (what was observed, when, where, who, context)
- Accept all factual statements from the user
- Continue collecting until the user explicitly indicates they have nothing else to add (e.g., "that's all", "nothing else", "ready to proceed", "no more facts")
- ONLY after the user indicates they're done, automatically present 3 plausible causes`;
    
    case 'proposing_causes':
      return `${BASE_PROMPT}

**YOUR TASK (Stage 2 - Proposing Causes):** Present 3 plausible causes that fit the facts.
- List them clearly (numbered 1, 2, 3)
- MUST END with: "Do these match your thoughts? If not, what else could it be based on?"
- Be concise`;
    
    case 'selecting_cause':
      return `${BASE_PROMPT}

**YOUR TASK (Stage 3 - Selecting Cause):** User selected one of the 3 plausible causes (1, 2, or 3).

Review the conversation to identify WHICH cause they selected.

If the selected cause is a deviation from best practice, ask why best practice was not applied in this situation:

**Why #1:** Why did we choose [the observed action, e.g., a temporary patch] instead of [the best practice, e.g., using a union fitting]?

Select the most relevant explanation:
1. **Urgency/operational pressure:** Was the need for immediate restoration prioritized over following correct procedures?
2. **Resource constraints:** Was the correct part, tool, or material unavailable at the time of repair?
3. **Process/policy gap:** Was the team unclear on the SOP, lacking training, or was the company policy not enforced—leading to improvisation?

(If you have another explanation, please specify.)

If the selected cause IS the best practice, acknowledge it and ask for factors that ensured best practice was followed.

CRITICAL:  
- Reference the precise selected cause from previous stages.
- DO NOT change topic or introduce unrelated causes.
- ALWAYS frame the question in terms of why best practice was or wasn't applied.
- Stop after providing the question and three options.
`;
    case 'five_whys':
      return `${BASE_PROMPT}

**YOUR TASK (Stage 4 - 5 Whys):** The user just provided an answer about why something happened.

Ask: **Why #X:** Why did [what actually happened] instead of [what best practice would be]?

1. [First explanation from their perspective]
2. [Second explanation from their perspective]
3. [Third explanation from their perspective]

CRITICAL: 
- Identify BEST PRACTICE for the situation, then ask why actual practice differed
- Keep it simple and from their perspective
- STOP after the 3 options
- Ask exactly 5 why questions total, then summarize root cause`;
    
    case 'root_cause_identified':
      return `${BASE_PROMPT}

**YOUR TASK (Stage 5 - Root Cause):** Summarize the root cause.
- Review the 5 whys completed
- State what the root cause is based on the chain of whys
- Keep it brief and actionable`;
    
    default:
      return BASE_PROMPT;
  }
}

export async function handleFiveWhysChat(params: any) {
  try {
    const { messages, stage, why_count, issue_description } = params;

    // Validate required parameters
    if (!messages || !Array.isArray(messages)) {
      return createErrorResponse('Missing or invalid messages array', 'VALIDATION_ERROR');
    }

    if (!stage) {
      return createErrorResponse('Missing stage parameter', 'VALIDATION_ERROR');
    }

    // Get API key from Supabase secret
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured in Edge Function secrets');
      return createErrorResponse('OpenRouter API key not configured', 'CONFIGURATION_ERROR');
    }

    // Get stage-specific system prompt
    let stagePrompt = getStagePrompt(stage, why_count || 0);
    
    // Add context for five_whys stage
    if (stage === 'five_whys') {
      const nextWhyNumber = (why_count || 0) + 1;
      const remaining = 5 - (why_count || 0);
      stagePrompt = `${stagePrompt}\n\n**CONTEXT:** You are now asking Why #${nextWhyNumber} of 5. You have ${remaining} more questions to ask. Start your response with "**Why #${nextWhyNumber}:**" then ask ONLY the next why question with 3 options, then STOP.\n\n**REMEMBER:** For the user's last answer: (1) identify what BEST PRACTICE would have been, (2) ask why actual practice differed from best practice. Provide 3 simple options from the user's perspective.`;
    }

    // Prepare messages for OpenRouter API
    const apiMessages = [
      { role: 'system', content: stagePrompt },
      ...messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // Call OpenRouter API
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || '',
        'X-Title': 'Clever Widget Factory',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', response.status, errorData);
      return createErrorResponse(
        `OpenRouter API error: ${response.statusText}`,
        'EXTERNAL_API_ERROR'
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices[0]?.message?.content || 'No response from AI';

    // Detect if this is a root cause summary (no "Why #" pattern)
    const isRootCauseSummary = stage === 'five_whys' && !assistantMessage.match(/Why #\d+:/);

    return createSuccessResponse({
      message: assistantMessage,
      stage: stage,
      why_count: why_count || 0,
      is_root_cause_summary: isRootCauseSummary,
    });
  } catch (error) {
    console.error('Error in handleFiveWhysChat:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error occurred',
      'INTERNAL_ERROR'
    );
  }
}

