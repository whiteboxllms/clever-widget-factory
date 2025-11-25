import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Brain, CheckCircle2, MessageSquare, Lightbulb, X } from 'lucide-react';
import { getSession, type FiveWhysSession } from '@/services/fiveWhysService';
import { format } from 'date-fns';
import { supabase } from '@/lib/client';
import { isLightColor } from '@/lib/utils';

interface FiveWhysSessionViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  organizationId: string;
  issueDescription: string;
}

export function FiveWhysSessionViewer({
  open,
  onOpenChange,
  sessionId,
  organizationId,
  issueDescription
}: FiveWhysSessionViewerProps) {
  const [session, setSession] = useState<FiveWhysSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('conversation');
  const [creatorProfileColor, setCreatorProfileColor] = useState<string | null>(null);

  useEffect(() => {
    if (open && sessionId) {
      loadSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId, organizationId]);

  // Fetch creator's profile color when session loads
  useEffect(() => {
    const fetchCreatorColor = async () => {
      if (!session?.created_by) {
        setCreatorProfileColor(null);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('favorite_color')
          .eq('user_id', session.created_by)
          .single();
        
        if (error) {
          setCreatorProfileColor(null);
          return;
        }
        
        const color = data?.favorite_color;
        
        // Ensure color has # prefix if it exists
        if (color && !color.startsWith('#')) {
          setCreatorProfileColor(`#${color}`);
        } else if (color) {
          setCreatorProfileColor(color);
        } else {
          setCreatorProfileColor(null);
        }
      } catch (error) {
        setCreatorProfileColor(null);
      }
    };

    if (session?.created_by) {
      fetchCreatorColor();
    }
  }, [session?.created_by]);

  const loadSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSession(sessionId, organizationId);
      if (result.success && result.data) {
        setSession(result.data);
      } else {
        setError(result.error || 'Failed to load session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'abandoned':
        return <Badge variant="outline">Abandoned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!session && !isLoading && !error) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[98vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="px-2 pt-1.5 pb-1.5 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Brain className="h-3.5 w-3.5" />
              <span className="truncate">5 Whys</span>
              {session && getStatusBadge(session.status)}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              {session && (
                <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                  <span 
                    className="truncate max-w-[100px]"
                    style={creatorProfileColor ? { color: creatorProfileColor } : undefined}
                  >
                    {session.creator_name || 'Unknown'}
                  </span>
                  <span>•</span>
                  <span className="whitespace-nowrap">{format(new Date(session.updated_at), 'MMM d, HH:mm')}</span>
                </div>
              )}
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-70 hover:opacity-100">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="px-4 mb-2">
            <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">
              Error: {error}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 flex-1">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading session...</span>
          </div>
        ) : session ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Issue Context - Always visible */}
            <div className="px-2 py-1.5 border-b bg-blue-50/50 flex-shrink-0">
              <div className="text-[10px] sm:text-xs font-medium text-blue-900 mb-0.5">Issue:</div>
              <div className="text-xs text-blue-800 leading-relaxed">{issueDescription}</div>
            </div>

            {/* Tabbed Content - Takes remaining space */}
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue={session.root_cause_analysis ? "conversation" : "conversation"} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TabsList className="mx-1.5 mt-1 mb-0.5 flex-shrink-0 w-auto h-7">
                <TabsTrigger value="conversation" className="flex items-center gap-1 px-2.5 h-6 text-[11px] sm:text-xs">
                  <MessageSquare className="h-3 w-3" />
                  <span className="hidden sm:inline">Conversation</span>
                  <span className="sm:hidden">Chat</span>
                </TabsTrigger>
                {session.root_cause_analysis && (
                  <TabsTrigger value="root-cause" className="flex items-center gap-1 px-2.5 h-6 text-[11px] sm:text-xs">
                    <Lightbulb className="h-3 w-3" />
                    <span className="hidden sm:inline">Root Cause</span>
                    <span className="sm:hidden">Result</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Conversation Tab */}
              {activeTab === 'conversation' && (
                <TabsContent value="conversation" className="flex-1 flex flex-col min-h-0 mt-0 px-1.5 pb-1">
                  <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                    <div className="space-y-2 py-1.5">
                      {Array.isArray(session.conversation_history) &&
                        session.conversation_history.length > 0 ? (
                          session.conversation_history.map((message, index) => {
                            const isUser = message.role === 'user';
                            // Use profile color if available, otherwise fall back to undefined
                            // Ensure color has # prefix (fallback in case it wasn't added during fetch)
                            let bgColor = isUser && creatorProfileColor ? creatorProfileColor : undefined;
                            if (bgColor && !bgColor.startsWith('#')) {
                              bgColor = `#${bgColor}`;
                            }
                            const hasProfileColor = !!bgColor && bgColor.startsWith('#');
                            
                            
                            const textColor = hasProfileColor && bgColor && isLightColor(bgColor)
                              ? 'text-gray-900'
                              : hasProfileColor && bgColor
                              ? 'text-white'
                              : undefined;
                            
                            // Build style object - ensure color is valid hex with #
                            const messageStyle = hasProfileColor && bgColor && bgColor.startsWith('#')
                              ? { backgroundColor: bgColor }
                              : undefined;
                            
                            // Build complete style object with background and text color
                            // Only apply if we have a valid color (starts with #)
                            const completeStyle = hasProfileColor && bgColor
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
                                  className={`max-w-[92%] sm:max-w-[88%] rounded-lg p-2 sm:p-2.5 ${
                                    isUser
                                      ? hasProfileColor
                                        ? '' // No classes when using profile color - all styling via inline style
                                        : 'bg-primary text-primary-foreground'
                                      : 'bg-muted'
                                  }`}
                                  style={completeStyle}
                                >
                                  <div className="flex items-start gap-1.5">
                                    {message.role === 'assistant' && (
                                      <Brain className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 whitespace-pre-wrap text-sm sm:text-base leading-relaxed break-words">
                                      {message.content}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No conversation history available
                          </div>
                        )}
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Root Cause Tab */}
              {activeTab === 'root-cause' && session.root_cause_analysis && (
                <TabsContent value="root-cause" className="flex-1 flex flex-col min-h-0 mt-0 px-1.5 pb-1">
                  <div className="flex-1 min-h-0 relative">
                    <ScrollArea className="absolute inset-0">
                      <div className="p-0">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mx-1.5 mb-1.5">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="font-semibold text-green-900 text-sm sm:text-base">
                              Root Cause Analysis
                            </div>
                          </div>
                          <div className="text-sm sm:text-base text-green-900 whitespace-pre-wrap leading-relaxed pl-5 sm:pl-6 break-words overflow-wrap-anywhere">
                            {session.root_cause_analysis}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {/* Footer - Minimal */}
            <div className="border-t px-2 py-1 flex justify-end flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-6 text-xs px-2">
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

