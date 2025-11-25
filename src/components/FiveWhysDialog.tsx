import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Brain, CheckCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFiveWhysAgent, parseWhyQuestion } from '@/hooks/useFiveWhysAgent';
import { toast } from '@/hooks/use-toast';
import { BaseIssue } from '@/types/issues';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useAuth } from "@/hooks/useCognitoAuth";
import { supabase } from '@/lib/client';
import { isLightColor } from '@/lib/utils';

interface FiveWhysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: BaseIssue;
  sessionId?: string;
}

export function FiveWhysDialog({ open, onOpenChange, issue, sessionId }: FiveWhysDialogProps) {
  const [userInput, setUserInput] = useState('');
  const [sessionSaved, setSessionSaved] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [userProfileColor, setUserProfileColor] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get organization ID from the hook
  const organizationId = useOrganizationId();
  const { user } = useAuth();

  // Fetch current user's profile color
  useEffect(() => {
    const fetchUserColor = async () => {
      if (!user?.id) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('favorite_color')
          .eq('user_id', user.id)
          .single();
        
        const color = data?.favorite_color;
        // Ensure color has # prefix if it exists
        if (color && !color.startsWith('#')) {
          console.warn('Profile color missing # prefix, adding it:', color);
          setUserProfileColor(`#${color}`);
        } else {
          setUserProfileColor(color || null);
        }
      } catch (error) {
        console.warn('Error fetching user profile color:', error);
        setUserProfileColor(null);
      }
    };

    if (open) {
      fetchUserColor();
    }
  }, [user?.id, open]);

  const {
    messages,
    isLoading,
    error,
    currentStage,
    whyCount,
    initializeSession,
    sendMessage,
    saveSession,
    completeSession,
    resetSession,
  } = useFiveWhysAgent(issue, organizationId, sessionId);
  
  // Get last AI message and parse it if it's a why question
  const lastMessage = messages[messages.length - 1];
  const isWhyQuestion = currentStage === 'five_whys' && lastMessage?.role === 'assistant';
  const parsedQuestion = isWhyQuestion ? parseWhyQuestion(lastMessage.content) : null;

  // Initialize session when dialog opens
  useEffect(() => {
    if (open && messages.length === 0) {
      initializeSession();
    }
  }, [open, messages.length, initializeSession]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    };
    
    // Small delay to ensure content has rendered
    const timer = setTimeout(scrollToBottom, 50);
    
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Focus textarea after AI responds (when loading finishes and there's input)
  useEffect(() => {
    if (!isLoading && messages.length > 1 && textareaRef.current && !showCustomInput) {
      // Small delay after loading stops to ensure scroll completed
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, messages.length, showCustomInput]);

  // Focus textarea when dialog opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = async () => {
    if (!userInput.trim() || isLoading) return;

    const messageToSend = userInput;
    setUserInput('');
    setShowCustomInput(false);
    await sendMessage(messageToSend);
  };

  const handleOptionSelect = async (option: string) => {
    if (isLoading) return;
    setShowCustomInput(false);
    await sendMessage(option);
  };

  const handleSaveSession = async () => {
    try {
      await saveSession();
      setSessionSaved(true);
      toast({
        title: 'Session Saved',
        description: 'Your 5 Whys conversation has been saved',
      });
    } catch (err) {
      console.error('Error saving session:', err);
      toast({
        title: 'Save Failed',
        description: 'An error occurred while saving',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteSession = async () => {
    try {
      await completeSession();
      onOpenChange(false);
      toast({
        title: 'Analysis Complete',
        description: 'Your 5 Whys analysis has been saved',
      });
    } catch (err) {
      console.error('Error completing session:', err);
      toast({
        title: 'Error',
        description: 'Failed to complete session',
        variant: 'destructive',
      });
    }
  };

  const handleCancelClick = () => {
    if (messages.length > 1) {
      setShowCancelConfirm(true);
    } else {
      resetSession();
      onOpenChange(false);
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    resetSession();
    onOpenChange(false);
  };

  const handleDenyCancel = () => {
    setShowCancelConfirm(false);
  };

  const getWorkflowStage = () => {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content.toLowerCase() || '';
    
    if (content.includes('why') || content.includes('5 whys')) {
      return { label: '5 Whys Analysis', variant: 'default' as const };
    }
    if (content.includes('plausible') || content.includes('causes')) {
      return { label: 'Plausible Causes', variant: 'secondary' as const };
    }
    return { label: 'Problem Statement', variant: 'outline' as const };
  };

  const stage = getWorkflowStage();

  return (
    <>
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        {/* Compact Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5" />
            5 Whys Analysis
            <Badge variant="outline" className="ml-2">
              {currentStage.replace(/_/g, ' ')}
            </Badge>
            {whyCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                Why #{whyCount}
              </Badge>
            )}
          </DialogTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Work with an AI accountability coach to identify the true root cause of this issue. Respond to the AI's questions in the text area below. Use Shift+Enter for new lines, Enter to send.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {error && (
          <div className="px-4 mb-2">
            <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">
              Error: {error}
            </div>
          </div>
        )}

        {/* Chat Area - Maximized */}
        <div className="flex-1 overflow-y-auto px-4 min-h-0" ref={scrollAreaRef}>
          <div className="space-y-3 py-2">
            {/* Issue Context Message */}
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-3 bg-blue-50 border border-blue-200">
                <div className="text-xs font-semibold text-blue-900 mb-1">Issue Context:</div>
                <div className="text-sm text-blue-800">{issue.description}</div>
                {issue.resolution_photo_urls && issue.resolution_photo_urls.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {issue.resolution_photo_urls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Issue photo ${index + 1}`}
                        className="h-16 w-16 object-cover rounded border border-blue-300 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              // Use profile color if available, otherwise fall back to undefined
              const bgColor = isUser && userProfileColor ? userProfileColor : undefined;
              const hasProfileColor = !!bgColor;
              
              // Build complete style object with background and text color
              const completeStyle = hasProfileColor && bgColor && bgColor.startsWith('#')
                ? {
                    backgroundColor: bgColor,
                    color: isLightColor(bgColor) ? '#111827' : '#ffffff'
                  }
                : undefined;
              
              return (
                <div
                  key={index}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      isUser
                        ? hasProfileColor
                          ? '' // No classes when using profile color - all styling via inline style
                          : 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                    style={completeStyle}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === 'assistant' && <Brain className="h-4 w-4 mt-1 flex-shrink-0" />}
                      <div className="flex-1 whitespace-pre-wrap text-sm">{message.content}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area - Compact */}
        <div className="flex flex-col gap-2 border-t bg-background px-4 py-3 flex-shrink-0">
          {parsedQuestion && !showCustomInput ? (
            /* Multiple Choice Options */
            <div className="flex flex-col gap-2">
              {parsedQuestion.options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handleOptionSelect(option)}
                  disabled={isLoading}
                  className="text-left justify-start h-auto py-3 px-4 w-full"
                >
                  <span className="font-semibold mr-3 flex-shrink-0">{String.fromCharCode(65 + index)}.</span>
                  <span className="flex-1 break-words whitespace-normal">{option}</span>
                </Button>
              ))}
              <Button
                variant="ghost"
                onClick={() => setShowCustomInput(true)}
                disabled={isLoading}
                size="sm"
                className="self-start"
              >
                Or enter your own reason
              </Button>
            </div>
          ) : (
            /* Text Input */
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={parsedQuestion ? "Enter your own reason..." : "Type your response... (Shift+Enter for new line, Enter to send)"}
                className="min-h-[80px] resize-none flex-1"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!userInput.trim() || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
          
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={handleCancelClick}
              disabled={isLoading}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveSession}
              disabled={isLoading || sessionSaved}
              size="sm"
            >
              {sessionSaved ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                'Save Progress'
              )}
            </Button>
            <Button
              variant="default"
              onClick={handleCompleteSession}
              disabled={isLoading || messages.length <= 1}
              size="sm"
            >
              Complete & Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Cancel Confirmation Dialog */}
    {showCancelConfirm && (
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Analysis?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel? Your conversation will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleDenyCancel}
              disabled={isLoading}
            >
              No
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isLoading}
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

