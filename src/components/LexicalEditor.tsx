import { useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { $generateHtmlFromNodes } from '@lexical/html';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { $getRoot, EditorState, LexicalEditor as LexicalEditorType } from 'lexical';
import { cn } from '@/lib/utils';
import { Bold, Italic, List, ListOrdered, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
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

  if (!isEditing) return null;

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

// URL regex for auto-linking
const URL_MATCHER = /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

const MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text);
    if (match === null) {
      return null;
    }
    const fullMatch = match[0];
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: fullMatch.startsWith('http') ? fullMatch : `https://${fullMatch}`,
    };
  },
];

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
          <AutoLinkPlugin matchers={MATCHERS} />
        </div>
      </LexicalComposer>
    </div>
  );
}