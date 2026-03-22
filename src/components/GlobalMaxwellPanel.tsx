import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { JSX } from 'react';
import { X, Send, RefreshCw, Loader2, Copy, Check, Code, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMaxwell, MaxwellSessionAttributes, MaxwellMessage } from '@/hooks/useMaxwell';
import { useMaxwellStorage, EntityContext } from '@/hooks/useMaxwellStorage';
import { useEntityContext } from '@/hooks/useEntityContext';
import { PrismIcon } from '@/components/icons/PrismIcon';

const STARTER_QUESTIONS_ACTION = [
  'Summarize what has happened so far and given our policy and observations what are next steps',
  'Are we missing any information or materials to complete this action as defined in the policy.',
  'What might telos and entelechy look like for this action.',
  'Are there any high entropy policy steps we might resolve before starting this action',
];

const STARTER_QUESTIONS_ASSET = [
  'Describe the telos (ultimate purpose) of this asset',
  'Look at the history and describe the degree to which we\'ve achieved entelecheia (are we following the best practice).',
  'What are options on reducing entropy in this context in an energy efficient way.',
];

interface GlobalMaxwellPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: EntityContext | null;
}

function MessageBubble({ message }: { message: MaxwellMessage }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleCopyTrace = async () => {
    if (message.trace) {
      await navigator.clipboard.writeText(JSON.stringify(message.trace, null, 2));
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    }
  };
  
  // Parse markdown images: ![alt](url) and render as <img> tags
  const renderContent = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;
    let imageIndex = 0;

    while ((match = imageRegex.exec(text)) !== null) {
      // Add text before the image
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      // Add the image (clickable to open full resolution)
      const alt = match[1];
      const url = match[2];
      parts.push(
        <a
          key={`img-${imageIndex++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-2"
        >
          <img
            src={url}
            alt={alt}
            title={`${alt} (click to view full resolution)`}
            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: '300px', objectFit: 'contain' }}
          />
        </a>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={cn('flex flex-col gap-1 group', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2 text-sm relative',
          isUser
            ? 'maxwell-message-user bg-primary text-primary-foreground rounded-br-sm'
            : 'maxwell-message-assistant bg-muted text-foreground rounded-bl-sm'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{renderContent(message.content)}</p>
        <button
          onClick={handleCopy}
          className={cn(
            'absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
            isUser ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted-foreground/10'
          )}
          aria-label="Copy message"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      
      {/* Trace section for assistant messages */}
      {!isUser && message.trace && message.trace.length > 0 && (
        <div className="max-w-[85%] mt-1 relative">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code className="h-3 w-3" />
              {showTrace ? 'Hide' : 'Show'} trace ({message.trace.length} events)
            </button>
            {showTrace && (
              <button
                onClick={handleCopyTrace}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy trace"
              >
                {copiedTrace ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copiedTrace ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {showTrace && (
            <div className="mt-2 mb-4 rounded-lg border bg-background p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto shadow-lg">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(message.trace, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GlobalMaxwellPanel({
  open,
  onOpenChange,
  context,
}: GlobalMaxwellPanelProps) {
  const currentPageContext = useEntityContext();
  const { saveConversation, loadConversation, clearConversation } = useMaxwellStorage();
  
  const [input, setInput] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeContext, setActiveContext] = useState<EntityContext | null>(context);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Don't use focus trap - allow navigation while panel is open
  // useFocusTrap(panelRef, open);

  // Update active context when panel opens with new context
  useEffect(() => {
    if (open && context) {
      setActiveContext(context);
    }
  }, [open, context]);

  // Focus management: move focus to input when panel opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure panel is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Keyboard support: Escape key closes panel (capture phase so it fires before Radix Dialog)
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    
    // Block pointerdown events originating inside the panel from reaching Radix's
    // document-level outside-click listener (which runs in the capture phase)
    const blockOutsideClick = (e: PointerEvent) => {
      if (panelRef.current?.contains(e.target as Node)) {
        e.stopPropagation();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape, true); // capture phase
      document.addEventListener('pointerdown', blockOutsideClick, true); // capture phase
      return () => {
        document.removeEventListener('keydown', handleEscape, true);
        document.removeEventListener('pointerdown', blockOutsideClick, true);
      };
    }
  }, [open, onOpenChange]);

  // Build session attributes from active context
  const sessionAttributes: MaxwellSessionAttributes | null = activeContext
    ? {
        entityId: activeContext.entityId,
        entityType: activeContext.entityType,
        entityName: activeContext.entityName,
        policy: activeContext.policy,
        implementation: activeContext.implementation,
      }
    : null;

  const { messages, isLoading, error, sendMessage, resetSession } = useMaxwell(
    sessionAttributes || {
      entityId: '',
      entityType: 'action',
      entityName: '',
      policy: '',
      implementation: '',
    }
  );

  // Load conversation from localStorage when context changes
  useEffect(() => {
    if (activeContext) {
      const stored = loadConversation(activeContext);
      if (stored && stored.length > 0) {
        // TODO: Restore messages to useMaxwell hook
        // This requires modifying useMaxwell to accept initial messages
        // For now, conversations are saved but not restored on mount
      }
    }
  }, [activeContext, loadConversation]);

  // Save conversation to localStorage whenever messages change
  useEffect(() => {
    if (activeContext && messages.length > 0) {
      saveConversation(activeContext, messages);
    }
  }, [activeContext, messages, saveConversation]);

  // Select starter questions based on entity type
  const starterQuestions =
    activeContext?.entityType === 'action'
      ? STARTER_QUESTIONS_ACTION
      : STARTER_QUESTIONS_ASSET;

  const handleCopyAll = async () => {
    const conversationText = messages
      .map((msg) => `${msg.role === 'user' ? 'You' : 'Maxwell'}: ${msg.content}`)
      .join('\n\n');
    await navigator.clipboard.writeText(conversationText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !sessionAttributes) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearConversation = () => {
    if (activeContext) {
      clearConversation(activeContext);
      resetSession();
    }
  };

  const handleSwitchToCurrentPage = () => {
    if (currentPageContext) {
      setActiveContext(currentPageContext);
      resetSession();
    }
  };

  const entityTypeLabel = activeContext
    ? activeContext.entityType.charAt(0).toUpperCase() + activeContext.entityType.slice(1)
    : '';

  // Check if current page context differs from active context
  const showSwitchButton =
    currentPageContext &&
    activeContext &&
    (currentPageContext.entityId !== activeContext.entityId ||
      currentPageContext.entityType !== activeContext.entityType);

  if (!open) return null;

  return createPortal(
    <>
      {/* No backdrop overlay - allow interaction with main content */}

      {/* Panel */}
      <div
        ref={panelRef}
        role="complementary"
        aria-label="Maxwell Assistant"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'fixed z-[200] bg-background shadow-xl flex flex-col border-l',
          'max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[90vh] max-md:rounded-t-2xl',
          'md:top-0 md:right-0 md:h-full md:w-[40%] lg:w-[35%]',
          'transition-transform duration-300 ease-out',
          open
            ? 'max-md:translate-y-0 md:translate-x-0'
            : 'max-md:translate-y-full md:translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PrismIcon size={32} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 id="maxwell-panel-title" className="text-sm font-semibold leading-none">
                Maxwell
              </h2>
              {activeContext && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {entityTypeLabel}: {activeContext.entityName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleCopyAll}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Copy entire conversation"
                title="Copy entire conversation"
              >
                {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close Maxwell"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Context controls */}
        {(showSwitchButton || messages.length > 0) && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
            {showSwitchButton && (
              <button
                onClick={handleSwitchToCurrentPage}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ArrowRight className="h-3 w-3" />
                Switch to current page
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleClearConversation}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                Clear conversation
              </button>
            )}
          </div>
        )}

        {/* Message area */}
        <div className="flex-1 overflow-y-auto px-4 py-2 pb-4 space-y-3 overscroll-contain touch-pan-y">
          {messages.length === 0 && !isLoading && (
            <div className="space-y-2 pt-2">
              {starterQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isLoading && (
            <div className="flex items-start gap-2">
              <div className="maxwell-message-assistant bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p>{error}</p>
              <button
                onClick={() => resetSession()}
                className="mt-1.5 flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}

          {/* Spacer to ensure last message and trace are visible above input */}
          <div ref={messagesEndRef} className="h-32" />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t px-4 py-3 pb-safe">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask Maxwell…"
            className="flex-1 rounded-full border bg-muted px-4 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
