import { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/lib/apiService';

export interface MaxwellMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  trace?: any[]; // Bedrock Agent trace events
  rawReply?: string; // Original reply before stripping tags
}

export interface MaxwellSessionAttributes {
  entityId: string;
  entityType: 'tool' | 'part' | 'action';
  entityName: string;
  policy: string;
  implementation: string;
}

interface MaxwellChatResponse {
  reply: string;
  sessionId: string;
  trace?: any[];
}

export interface UseMaxwellReturn {
  messages: MaxwellMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  sendMessage: (text: string) => Promise<void>;
  resetSession: () => void;
}

export function useMaxwell(sessionAttributes: MaxwellSessionAttributes): UseMaxwellReturn {
  const [messages, setMessages] = useState<MaxwellMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const resetSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // Reset session when entity changes (session isolation)
  useEffect(() => {
    resetSession();
  }, [sessionAttributes.entityId, resetSession]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: MaxwellMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.post<MaxwellChatResponse>('/agent/maxwell-chat', {
        message: text,
        sessionId,
        sessionAttributes,
      });

      setSessionId(response.sessionId);

      const assistantMsg: MaxwellMessage = {
        role: 'assistant',
        content: response.reply.replace(/<referenced_records>.*?<\/referenced_records>/s, '').trim(),
        timestamp: new Date(),
        trace: response.trace,
        rawReply: response.reply,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Maxwell failed to respond. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, sessionAttributes]);

  return { messages, isLoading, error, sessionId, sendMessage, resetSession };
}
