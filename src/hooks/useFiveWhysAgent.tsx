import { useState, useCallback } from 'react';
import { saveSession as saveSessionService, completeSession as completeSessionService, getSession, chatFiveWhys } from '@/services/fiveWhysService';
import { useAuth } from "@/hooks/useCognitoAuth";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export type WorkflowStage = 
  | 'collecting_facts'
  | 'proposing_causes'
  | 'selecting_cause'
  | 'five_whys'
  | 'root_cause_identified';

interface FiveWhysSession {
  id?: string;
  issue_id: string;
  organization_id: string;
  conversation_history: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
  root_cause_analysis?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

const BASE_PROMPT = `You are an AI accountability coach helping users find root causes through the 5 Whys method.

**OVERVIEW:** You guide users through different stages:
- Stage 1: Collecting observable facts (what happened, when, where)
- Stage 2: Proposing 3 plausible causes
- Stage 3: User selects a cause
- Stage 4: 5 Whys - ask why questions about the selected cause vs best practice
- Stage 5: Summarize root cause

**CORE RULES:**
- Be concise: ONE sentence, ONE question`;

const getStagePrompt = (stage: WorkflowStage): string => {
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
- ALWAYS frame the question in terms of why best practice was or wasn’t applied.
- Stop after providing the question and three options.
`
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
};

// OpenRouter API calls now handled by MCP server - see chatFiveWhys in fiveWhysService

export interface ParsedWhyQuestion {
  question: string;
  options: string[];
}

export function parseWhyQuestion(content: string): ParsedWhyQuestion | null {
  // Try to find numbered options
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  // Find lines that start with numbers (1., 2., 3.) or (1), (2), (3)
  const optionPattern = /^(\d+)\.\s*(.+)$/;
  const options: string[] = [];
  let question = '';
  
  for (const line of lines) {
    const match = line.match(optionPattern);
    if (match) {
      options.push(match[2]);
    } else if (!question && line.length > 0) {
      // First non-empty line is likely the question
      question = line;
    }
  }
  
  if (question && options.length >= 3) {
    return { question, options: options.slice(0, 3) };
  }
  
  return null;
}

export function useFiveWhysAgent(issue: { id: string; description: string }, organizationId: string, existingSessionId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<FiveWhysSession | null>(null);
  const [currentStage, setCurrentStage] = useState<WorkflowStage>('collecting_facts');
  const [factExchangeCount, setFactExchangeCount] = useState(0);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [whyCount, setWhyCount] = useState(0);
  const [whyAnswers, setWhyAnswers] = useState<string[]>([]);

  // Define loadExistingSession FIRST before initializeSession references it
  const loadExistingSession = useCallback(async () => {
    if (existingSessionId) {
      // Load specific session by ID
      const result = await getSession(existingSessionId, organizationId);
      if (result.success && result.data) {
        const data = result.data;
        
        // Restore session state from conversation history
        interface ConversationHistoryItem {
          role: string;
          content: string;
          timestamp?: string;
        }
        
        const restoredMessages: ChatMessage[] = (data.conversation_history || []).map((msg: ConversationHistoryItem) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
        }));

        // Restore stage and counts by analyzing messages
        let restoredStage: WorkflowStage = 'collecting_facts';
        let factCount = 0;
        let whyCount = 0;

        for (let i = 0; i < restoredMessages.length; i++) {
          const msg = restoredMessages[i];
          if (msg.role === 'user' && i > 0) {
            factCount++;
          }
          
          // Detect stage from AI responses
          if (msg.role === 'assistant') {
            if (msg.content.toLowerCase().includes('plausible causes') || msg.content.match(/^\d+\./)) {
              restoredStage = 'proposing_causes';
            } else if (msg.content.match(/Why #\d+:/)) {
              restoredStage = 'five_whys';
              const matches = restoredMessages.filter(m => m.role === 'assistant' && m.content.match(/Why #\d+:/));
              whyCount = matches.length;
            } else if (msg.content.toLowerCase().includes('root cause')) {
              restoredStage = 'root_cause_identified';
            }
          }
        }

        setMessages(restoredMessages);
        setCurrentStage(restoredStage);
        setFactExchangeCount(factCount);
        setWhyCount(whyCount);
        
        setSession({
          id: data.id,
          issue_id: data.issue_id,
          organization_id: data.organization_id,
          conversation_history: data.conversation_history,
          root_cause_analysis: data.root_cause_analysis,
          status: data.status,
        });

        return data;
      }
    }
    return null;
  }, [existingSessionId, organizationId]);

  const initializeSession = useCallback(async () => {
    // Try to load existing session first
    const existingSession = await loadExistingSession();
    
    // If session exists and was restored, return early
    if (existingSession) {
      setError(null);
      return;
    }

    // Otherwise, start a new session
    const initialPrompt = `I'll help you find the root cause using the 5 Whys method.

**Issue:** ${issue.description}

Beyond the reported issue, is there anything else you want to include as background before we get into the analysis. This should be observations and facts.`;

    const initialMessage: ChatMessage = {
      role: 'assistant',
      content: initialPrompt,
      timestamp: new Date(),
    };

    const newMessages = [initialMessage];
    setMessages(newMessages);
    setError(null);
    setCurrentStage('collecting_facts');
    setFactExchangeCount(0);
    setSelectedCause(null);
    setWhyCount(0);
    setWhyAnswers([]);
  }, [issue, loadExistingSession]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);
    setError(null);

    // Determine if we should transition stages based on current stage and user message
    let newStage = currentStage;
    
    if (currentStage === 'collecting_facts') {
      const newCount = factExchangeCount + 1;
      setFactExchangeCount(newCount);
      
      // Check if user indicated they're done providing facts
      const lowerMessage = userMessage.toLowerCase().trim();
      const completionSignals = [
        "that's all", "that is all", "thats all",
        "nothing else", "nothing more", "no more",
        "ready to proceed", "ready", "proceed",
        "no more facts", "no additional facts", "that's everything",
        "that is everything", "all done", "done", "finished",
        "that's it", "that is it", "nothing further"
      ];
      
      const isDone = completionSignals.some(signal => lowerMessage === signal || lowerMessage.includes(signal));
      
      if (isDone) {
        newStage = 'proposing_causes';
        setCurrentStage(newStage);
      }
    } else if (currentStage === 'proposing_causes') {
      // User is responding to cause proposal - they could:
      // 1. Select a numbered option (1, 2, 3, "first", "second", etc.)
      // 2. Confirm the causes match their thoughts ("yes", "match", etc.)
      // 3. Provide a custom cause (longer text)
      // Any of these should transition to selecting_cause stage
      const lowerMessage = userMessage.toLowerCase();
      
      // Transition if user selected a numbered option
      if (lowerMessage.includes('number 1') || lowerMessage.includes('first') || 
          lowerMessage.includes('second') || lowerMessage.includes('third') ||
          lowerMessage.match(/^\s*[123]\s*$/)) {
        newStage = 'selecting_cause';
        setCurrentStage(newStage);
      } 
      // Transition if user confirmed causes match
      else if (lowerMessage.includes('yes') || lowerMessage.includes('match') || 
               lowerMessage.includes('correct') || lowerMessage.includes('right')) {
        newStage = 'selecting_cause';
        setCurrentStage(newStage);
      }
      // Transition if user provided a custom cause (not just "no" or short negation)
      else if (userMessage.trim().length > 3 && 
               !lowerMessage.includes('no') && 
               !lowerMessage.includes('not')) {
        newStage = 'selecting_cause';
        setCurrentStage(newStage);
        setSelectedCause(userMessage);
      }
    } else if (currentStage === 'selecting_cause') {
      // User responded to "Why #1 of 5" - transition to five_whys
      newStage = 'five_whys';
      setCurrentStage(newStage);
    } else if (currentStage === 'five_whys') {
      // Track user's answer but don't increment whyCount yet
      // The increment happens when AI provides the next "Why #X" question
      setWhyAnswers(prev => [...prev, userMessage]);
      // Note: Stage transition to root_cause_identified will be detected by AI response content
    }

    try {
      // Call MCP server chat endpoint (OpenRouter API key is stored securely server-side)
      const result = await chatFiveWhys({
        messages: updatedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        stage: newStage,
        why_count: whyCount,
        issue_description: issue.description,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to get AI response');
      }

      const assistantMessage = result.data?.message || 'No response from AI';

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      };

      // Check if AI is transitioning to root_cause_identified stage
      // Use the flag from the server response or detect from message pattern
      const isRootCauseSummary = result.data?.is_root_cause_summary || 
                                  (currentStage === 'five_whys' && !assistantMessage.match(/Why #\d+:/));
      
      if (isRootCauseSummary) {
        // AI provided a summary instead of another why question
        newStage = 'root_cause_identified';
        setCurrentStage(newStage);
      } else if (newStage === 'five_whys' && assistantMessage.match(/Why #\d+:/)) {
        // AI just asked a new why question - increment the count
        const whyMatch = assistantMessage.match(/Why #(\d+):/);
        if (whyMatch) {
          const whyNumber = parseInt(whyMatch[1]);
          setWhyCount(whyNumber);
          
          // After 5 whys, force transition to root_cause_identified
          if (whyNumber >= 5) {
            newStage = 'root_cause_identified';
            setCurrentStage(newStage);
          }
        }
      }

      setMessages([...updatedMessages, assistantMsg]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMessage);
      console.error('AI Agent Error:', err);
      
      // Show user-friendly error
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${errorMessage}. Please try again or contact support.`,
        timestamp: new Date(),
      };
      setMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, currentStage, factExchangeCount, whyCount]);

  const saveSessionCallback = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');

    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp?.toISOString(),
    }));

    // Generate root cause analysis from conversation if we have enough data
    let rootCauseAnalysis: string | undefined;
    
    // Check if we're in root_cause_identified stage or if we have enough why answers
    if (currentStage === 'root_cause_identified') {
      // Extract the root cause summary from the last AI message
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMessage && lastAssistantMessage.content.length > 50) {
        rootCauseAnalysis = lastAssistantMessage.content;
      }
    } else if (whyCount >= 2 && whyAnswers.length >= 2) {
      // Generate a summary from the why chain if we have at least 2 whys
      const whyChain = whyAnswers.map((answer, index) => `Why ${index + 1}: ${answer}`).join('\n');
      rootCauseAnalysis = `Root cause analysis (${whyCount} whys completed):\n\n${whyChain}\n\n[Analysis in progress - continue conversation to complete]`;
    } else if (messages.length >= 4 && currentStage !== 'collecting_facts') {
      // If we have substantial conversation, create a basic summary
      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      
      if (userMessages.length >= 2 && assistantMessages.length >= 2) {
        rootCauseAnalysis = `Analysis in progress for: ${issue.description}\n\nKey points from conversation:\n- ${userMessages.slice(-2).map(m => m.content.substring(0, 100)).join('\n- ')}`;
      }
    }

    const result = await saveSessionService({
      session_id: session?.id,
      issue_id: issue.id,
      organization_id: organizationId,
      conversation_history: conversationHistory,
      status: 'in_progress',
      root_cause_analysis: rootCauseAnalysis,
      created_by: user.id
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to save session');
    }

    const sessionData = result.data?.session;
    if (sessionData) {
      setSession({
        id: sessionData.id,
        issue_id: sessionData.issue_id,
        organization_id: sessionData.organization_id,
        conversation_history: sessionData.conversation_history,
        root_cause_analysis: sessionData.root_cause_analysis,
        status: sessionData.status,
      } as FiveWhysSession);
    }

    return sessionData;
  }, [messages, issue.id, issue.description, organizationId, session?.id, user, currentStage, whyCount, whyAnswers]);

  const completeSessionCallback = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');

    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp?.toISOString(),
    }));

    // Extract root cause analysis from last AI message
    let rootCauseAnalysis: string | undefined;
    if (currentStage === 'root_cause_identified') {
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistantMessage) {
        rootCauseAnalysis = lastAssistantMessage.content;
      }
    }

    // If no session exists yet, create it first
    let sessionId = session?.id;
    if (!sessionId) {
      // Create the session first
      const saveResult = await saveSessionService({
        issue_id: issue.id,
        organization_id: organizationId,
        conversation_history: conversationHistory,
        status: 'in_progress',
        created_by: user.id
      });

      if (!saveResult.success || !saveResult.data?.session?.id) {
        throw new Error(saveResult.error || 'Failed to create session');
      }

      sessionId = saveResult.data.session.id;
    }

    const result = await completeSessionService({
      session_id: sessionId,
      organization_id: organizationId,
      conversation_history: conversationHistory,
      root_cause_analysis: rootCauseAnalysis,
      created_by: user.id
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to complete session');
    }

    const sessionData = result.data?.session;
    if (sessionData) {
      setSession({
        id: sessionData.id,
        issue_id: sessionData.issue_id,
        organization_id: sessionData.organization_id,
        conversation_history: sessionData.conversation_history,
        root_cause_analysis: sessionData.root_cause_analysis,
        status: sessionData.status,
      } as FiveWhysSession);
    }

    return sessionData;
  }, [messages, issue.id, organizationId, currentStage, session?.id, user]);

  const resetSession = useCallback(() => {
    setMessages([]);
    setSession(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    session,
    currentStage,
    whyCount,
    whyAnswers,
    initializeSession,
    sendMessage,
    saveSession: saveSessionCallback,
    completeSession: completeSessionCallback,
    resetSession,
  };
}

