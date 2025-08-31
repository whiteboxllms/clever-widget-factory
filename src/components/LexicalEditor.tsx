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
import { $getRoot, EditorState, LexicalEditor as LexicalEditorType, $insertNodes, $createParagraphNode, $createTextNode } from 'lexical';
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

// Enhanced plugin to load initial HTML content with text fallback
function LoadInitialContentPlugin({ initialHtml }: { initialHtml?: string }) {
  const [editor] = useLexicalComposerContext();
  const lastLoadedContentRef = useRef<string>('');
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Store the previous content before checking
    const previousContent = lastLoadedContentRef.current;
    
    // Only load if this is truly new content, not user editing
    if (initialHtml !== previousContent && initialHtml && initialHtml.trim()) {
      console.log('LoadInitialContentPlugin: Loading new content:', initialHtml?.substring(0, 100));
      console.log('LoadInitialContentPlugin: Previous content:', previousContent?.substring(0, 100));
      
      // Reset loading state when switching to different content
      hasLoadedRef.current = false;
      lastLoadedContentRef.current = initialHtml;

      editor.update(() => {
        const root = $getRoot();
        // Always clear when loading new content
        root.clear();
        
        try {
          const parser = new DOMParser();
          const dom = parser.parseFromString(initialHtml, 'text/html');
          const nodes = $generateNodesFromDOM(editor, dom);
          
          console.log('LoadInitialContentPlugin: Generated nodes count:', nodes.length);
          
          if (nodes.length > 0) {
            root.append(...nodes);
            console.log('LoadInitialContentPlugin: Successfully inserted HTML nodes');
          } else {
            // Fallback 1: Extract text content from parsed DOM
            const text = dom.body.textContent || '';
            console.log('LoadInitialContentPlugin: No nodes generated, trying text fallback:', text.substring(0, 50));
            
            if (text.trim()) {
              const paragraph = $createParagraphNode();
              const textNode = $createTextNode(text);
              paragraph.append(textNode);
              root.append(paragraph);
              console.log('LoadInitialContentPlugin: Inserted text content as fallback');
            } else {
              // Fallback 2: Strip HTML tags and insert as plain text
              const plainText = initialHtml.replace(/<[^>]*>/g, '').trim();
              console.log('LoadInitialContentPlugin: Using final fallback, plain text:', plainText.substring(0, 50));
              
              if (plainText) {
                const paragraph = $createParagraphNode();
                const textNode = $createTextNode(plainText);
                paragraph.append(textNode);
                root.append(paragraph);
                console.log('LoadInitialContentPlugin: Inserted plain text as final fallback');
              }
            }
          }
          hasLoadedRef.current = true;
        } catch (error) {
          console.error('LoadInitialContentPlugin: Error parsing HTML:', error);
          // Emergency fallback: strip HTML and insert as plain text
          const plainText = initialHtml.replace(/<[^>]*>/g, '').trim();
          if (plainText) {
            const paragraph = $createParagraphNode();
            const textNode = $createTextNode(plainText);
            paragraph.append(textNode);
            root.append(paragraph);
            console.log('LoadInitialContentPlugin: Used emergency text fallback due to error');
          }
          hasLoadedRef.current = true;
        }
      });
    }
  }, [initialHtml, editor]);

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
  key?: string; // Add key prop for forcing remounts
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