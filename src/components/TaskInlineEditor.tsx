import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Edit3, 
  Save, 
  X, 
  Clock, 
  Timer, 
  Wrench, 
  User,
  CheckCircle2
} from 'lucide-react';
import TiptapEditor from './TiptapEditor';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface Task {
  id: string;
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  status: string;
  mission_id: string;
  estimated_duration?: string;
  actual_duration?: string;
  required_tools?: string[];
}

interface TaskInlineEditorProps {
  task: Task;
  profiles: Profile[];
  onUpdate: (taskData: Partial<Task>) => void;
  field: 'title' | 'plan' | 'observations' | 'estimated_duration' | 'actual_duration';
  isRichText?: boolean;
}

export function TaskInlineEditor({ 
  task, 
  profiles, 
  onUpdate, 
  field,
  isRichText = false 
}: TaskInlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(task[field] || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(task[field] || '');
  }, [task[field], field]);

  useEffect(() => {
    if (isEditing && !isRichText) {
      if (inputRef.current) inputRef.current.focus();
      if (textareaRef.current) textareaRef.current.focus();
    }
  }, [isEditing, isRichText]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({ [field]: value });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(task[field] || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isRichText) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const getFieldIcon = () => {
    switch (field) {
      case 'estimated_duration':
        return <Clock className="w-4 h-4" />;
      case 'actual_duration':
        return <Timer className="w-4 h-4" />;
      default:
        return <Edit3 className="w-4 h-4" />;
    }
  };

  const getFieldLabel = () => {
    switch (field) {
      case 'title':
        return 'Task Title';
      case 'plan':
        return 'Plan';
      case 'observations':
        return 'Implementation Notes';
      case 'estimated_duration':
        return 'Estimated Duration';
      case 'actual_duration':
        return 'Actual Duration';
      default:
        return 'Field';
    }
  };

  const isEmpty = !value || value.trim() === '';
  const displayValue = isEmpty ? `Click to add ${getFieldLabel().toLowerCase()}...` : value;

  if (isEditing) {
    return (
      <div className="space-y-2">
        {isRichText ? (
          <div className="border rounded-lg">
             <TiptapEditor
               value={value}
               onChange={setValue}
               placeholder={`Enter ${getFieldLabel().toLowerCase()}...`}
             />
          </div>
        ) : (
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Enter ${getFieldLabel().toLowerCase()}...`}
            className="w-full"
          />
        )}
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 px-2"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 px-2"
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`group relative p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 cursor-pointer transition-colors ${
        isEmpty ? 'text-muted-foreground italic' : ''
      }`}
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-center gap-2">
        {getFieldIcon()}
        <div className="flex-1 min-w-0">
          {isRichText ? (
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: displayValue }}
            />
          ) : (
            <span className="block truncate">{displayValue}</span>
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Edit3 className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}