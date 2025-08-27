import { useCallback, useEffect, useState, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { $getRoot, EditorState, LexicalEditor as LexicalEditorType, $insertNodes } from 'lexical';
import { cn } from '@/lib/utils';
import { Bold, Italic, List, ListOrdered, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { FORMAT_TEXT_COMMAND } from 'lexical';

const theme = {
  paragraph: 'mb-1',
  list: {
    nested: {
      listitem: 'list-none',
    },
    ol: 'list-decimal list-inside',
    ul: 'list-disc list-inside',
    listitem: 'mb-1',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
  },
  link: 'text-blue-600 hover:text-blue-800 underline cursor-pointer',
};

function onError(error: Error) {
  console.error(error);
}

interface ToolbarProps {
  isEditing?: boolean;
}

function ToolbarPlugin({ isEditing = true }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();

  const formatBold = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  }, [editor]);

  const formatItalic = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  }, [editor]);

  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }
  }, [editor]);

  const insertBulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const insertNumberedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  if (!isEditing) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
      <Button
        variant="ghost"
        size="sm"
        onClick={formatBold}
        className="h-8 w-8 p-0"
        type="button"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={formatItalic}
        className="h-8 w-8 p-0"
        type="button"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={insertLink}
        className="h-8 w-8 p-0"
        type="button"
      >
        <Link className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={insertBulletList}
        className="h-8 w-8 p-0"
        type="button"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={insertNumberedList}
        className="h-8 w-8 p-0"
        type="button"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Simple AutoLink implementation
function AutoLinkPlugin() {
  const [editor] = useLexicalComposerContext();
  
  // For now, let's just return null and get the basic editor working
  // We can add URL detection later once the editor is functioning
  return null;
}

// Plugin to load initial HTML content into the editor
function LoadInitialContentPlugin({ initialHtml }: { initialHtml?: string }) {
  const [editor] = useLexicalComposerContext();
  const lastLoadedHtmlRef = useRef<string>('');
  const isUserTypingRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't reload if user is actively typing or if it's the same content
    if (isUserTypingRef.current || initialHtml === lastLoadedHtmlRef.current) {
      return;
    }

    // Check if current editor content matches the incoming HTML to avoid unnecessary reloads
    editor.getEditorState().read(() => {
      const currentHtml = $generateHtmlFromNodes(editor);
      
      // Only reload if the content is actually different
      if (currentHtml !== initialHtml) {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          
          if (initialHtml && initialHtml.trim()) {
            // Parse HTML and insert nodes
            const parser = new DOMParser();
            const dom = parser.parseFromString(initialHtml, 'text/html');
            const nodes = $generateNodesFromDOM(editor, dom);
            root.append(...nodes);
          }
          
          lastLoadedHtmlRef.current = initialHtml || '';
        });
      }
    });
  }, [initialHtml, editor]);

  // Track when user starts typing to prevent content reloading during input
  useEffect(() => {
    const removeListener = editor.registerTextContentListener(() => {
      isUserTypingRef.current = true;
      
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Reset the typing flag after a short delay
      typingTimeoutRef.current = setTimeout(() => {
        isUserTypingRef.current = false;
      }, 100);
    });

    return () => {
      removeListener();
      // Clean up timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [editor]);

  return null;
}

interface LexicalEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export function LexicalEditor({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Start typing...",
  className,
  readOnly = false
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: 'TaskEditor',
    theme,
    onError,
    editable: !readOnly,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      AutoLinkNode,
      LinkNode,
    ],
  };

  const handleChange = useCallback((editorState: EditorState, editor: LexicalEditorType) => {
    editorState.read(() => {
      const html = $generateHtmlFromNodes(editor);
      onChange(html);
    });
  }, [onChange]);

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  return (
    <div className={cn("border border-input rounded-md overflow-hidden bg-background", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin isEditing={!readOnly} />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[80px] p-3 outline-none resize-none"
                onFocus={handleFocus}
                onBlur={handleBlur}
                spellCheck={false}
              />
            }
            placeholder={
              <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <OnChangePlugin onChange={handleChange} />
          <HistoryPlugin />
          <LinkPlugin />
          <ListPlugin />
          <AutoLinkPlugin />
          <LoadInitialContentPlugin initialHtml={value} />
        </div>
      </LexicalComposer>
    </div>
  );
}