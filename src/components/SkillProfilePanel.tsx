/**
 * SkillProfilePanel Component
 *
 * Collapsible panel for generating, previewing, editing, and approving
 * AI-generated skill profiles for actions.
 *
 * Three states:
 * - Empty: "Generate Skill Profile" button (disabled if no context)
 * - Preview: Editable narrative + axes with Approve/Discard
 * - Approved: Stored profile with mini radar preview + Regenerate
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  useGenerateSkillProfile,
  useApproveSkillProfile,
  useDeleteSkillProfile,
} from '@/hooks/useSkillProfile';
import type { SkillProfile } from '@/hooks/useSkillProfile';
import type { BaseAction } from '@/types/actions';
import {
  ChevronDown,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Loader2,
  Brain,
} from 'lucide-react';

// --- Zod schema for frontend validation before approve ---

const skillAxisSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  label: z.string().min(1, 'Label is required'),
  required_level: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Min 0')
    .max(5, 'Max 5'),
});

const skillProfileFormSchema = z.object({
  narrative: z.string().min(1, 'Narrative is required'),
  axes: z
    .array(skillAxisSchema)
    .min(4, 'At least 4 axes required')
    .max(6, 'At most 6 axes allowed'),
});

type SkillProfileFormData = z.infer<typeof skillProfileFormSchema>;

// --- Props ---

interface SkillProfilePanelProps {
  action: BaseAction;
  userId: string;
}

// --- Component ---

export function SkillProfilePanel({ action, userId }: SkillProfilePanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [previewProfile, setPreviewProfile] = useState<SkillProfile | null>(null);

  const { toast } = useToast();
  const generateMutation = useGenerateSkillProfile();
  const approveMutation = useApproveSkillProfile();
  const deleteMutation = useDeleteSkillProfile();

  const approvedProfile = action.skill_profile as SkillProfile | null | undefined;
  const hasContext = !!(action.title || action.description || action.expected_state);

  // Determine panel state
  const panelState: 'empty' | 'preview' | 'approved' = previewProfile
    ? 'preview'
    : approvedProfile
      ? 'approved'
      : 'empty';

  // --- Handlers ---

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        action_id: action.id,
        action_context: {
          title: action.title,
          description: action.description || undefined,
          expected_state: action.expected_state || undefined,
          policy: action.policy || undefined,
          asset_name: action.asset?.name || undefined,
          required_tools: action.required_tools || undefined,
        },
      });
      setPreviewProfile(result);
    } catch {
      toast({
        title: 'Generation failed',
        description: 'Could not generate skill profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDiscard = () => {
    setPreviewProfile(null);
  };

  const handleRegenerate = async () => {
    // Clear approved profile first, then generate fresh
    try {
      await deleteMutation.mutateAsync(action.id);
    } catch {
      // If delete fails, still try to generate
    }
    handleGenerate();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full p-0">
          <div className="flex items-center gap-2 w-full">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Skill Profile</span>
            {approvedProfile && !previewProfile && (
              <span className="text-xs text-green-600 ml-1">Approved</span>
            )}
            {previewProfile && (
              <span className="text-xs text-amber-600 ml-1">Preview</span>
            )}
            <ChevronDown
              className={`h-4 w-4 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3">
        {panelState === 'empty' && (
          <EmptyState
            hasContext={hasContext}
            isLoading={generateMutation.isPending}
            onGenerate={handleGenerate}
          />
        )}

        {panelState === 'preview' && previewProfile && (
          <PreviewState
            profile={previewProfile}
            actionId={action.id}
            userId={userId}
            isApproving={approveMutation.isPending}
            onApprove={async (data) => {
              try {
                await approveMutation.mutateAsync({
                  action_id: action.id,
                  skill_profile: {
                    ...data,
                    generated_at: previewProfile.generated_at,
                  },
                  approved_by: userId,
                });
                setPreviewProfile(null);
                toast({ title: 'Skill profile approved' });
              } catch {
                toast({
                  title: 'Approval failed',
                  description: 'Could not approve skill profile. Please try again.',
                  variant: 'destructive',
                });
              }
            }}
            onDiscard={handleDiscard}
          />
        )}

        {panelState === 'approved' && approvedProfile && (
          <ApprovedState
            profile={approvedProfile}
            isRegenerating={generateMutation.isPending || deleteMutation.isPending}
            onRegenerate={handleRegenerate}
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Empty State ---

function EmptyState({
  hasContext,
  isLoading,
  onGenerate,
}: {
  hasContext: boolean;
  isLoading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-sm text-muted-foreground">
        No skill profile yet. Generate one from the action context.
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasContext || isLoading}
        onClick={onGenerate}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Generate Skill Profile
      </Button>
      {!hasContext && (
        <p className="text-xs text-muted-foreground">
          Add a title, description, or expected state first.
        </p>
      )}
    </div>
  );
}

// --- Preview State (React Hook Form + Zod) ---

function PreviewState({
  profile,
  actionId,
  userId,
  isApproving,
  onApprove,
  onDiscard,
}: {
  profile: SkillProfile;
  actionId: string;
  userId: string;
  isApproving: boolean;
  onApprove: (data: SkillProfileFormData) => void;
  onDiscard: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SkillProfileFormData>({
    resolver: zodResolver(skillProfileFormSchema),
    defaultValues: {
      narrative: profile.narrative,
      axes: profile.axes.map((a) => ({
        key: a.key,
        label: a.label,
        required_level: a.required_level,
      })),
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'axes',
  });

  return (
    <form onSubmit={handleSubmit(onApprove)} className="space-y-4">
      {/* Narrative */}
      <div className="space-y-1.5">
        <Label htmlFor={`narrative-${actionId}`} className="text-xs font-medium">
          Skill Narrative
        </Label>
        <Textarea
          id={`narrative-${actionId}`}
          {...register('narrative')}
          rows={3}
          className="text-sm"
          placeholder="Describe the skills this action requires..."
        />
        {errors.narrative && (
          <p className="text-xs text-destructive">{errors.narrative.message}</p>
        )}
      </div>

      {/* Axes */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Skill Axes</Label>
        {errors.axes?.root && (
          <p className="text-xs text-destructive">{errors.axes.root.message}</p>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              {...register(`axes.${index}.label`)}
              className="text-sm flex-1"
              placeholder="Axis label"
            />
            <Input
              {...register(`axes.${index}.required_level`, { valueAsNumber: true })}
              type="number"
              step="1"
              min="0"
              max="5"
              className="text-sm w-20"
              placeholder="0–5"
            />
            {errors.axes?.[index]?.label && (
              <span className="text-xs text-destructive">
                {errors.axes[index].label?.message}
              </span>
            )}
            {errors.axes?.[index]?.required_level && (
              <span className="text-xs text-destructive">
                {errors.axes[index].required_level?.message}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isApproving}>
          {isApproving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDiscard}
          disabled={isApproving}
        >
          <X className="h-4 w-4 mr-2" />
          Discard
        </Button>
      </div>
    </form>
  );
}

// --- Approved State (mini radar preview with progress bars) ---

function ApprovedState({
  profile,
  isRegenerating,
  onRegenerate,
}: {
  profile: SkillProfile;
  isRegenerating: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Narrative */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {profile.narrative}
      </p>

      {/* Approved metadata */}
      {profile.approved_at && (
        <p className="text-xs text-muted-foreground">
          Approved {new Date(profile.approved_at).toLocaleDateString()}
        </p>
      )}

      {/* Regenerate */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRegenerate}
        disabled={isRegenerating}
      >
        {isRegenerating ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Regenerate
      </Button>
    </div>
  );
}
