/**
 * ExplorationTab Component
 * 
 * Displays exploration-specific fields for actions with exploration records
 * Supports editing exploration notes, metrics, and public flag
 * Includes AI suggestions functionality
 * 
 * Requirements: 2.5, 2.6, 2.7, 2.8, 6.3, 8.2, 8.4
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Sparkles, Loader2, Save, AlertCircle, Camera, X, Image } from 'lucide-react';
import { ExplorationService, ExplorationResponse, UpdateExplorationRequest } from '@/services/explorationService';
import { AIContentService, ExplorationSuggestionRequest } from '@/services/aiContentService';
import { BaseAction } from '@/types/actions';

interface ExplorationTabProps {
  action: BaseAction;
  onUpdate?: () => void;
}

interface ExplorationData {
  id: number;
  exploration_code: string;
  exploration_notes_text?: string;
  metrics_text?: string;
  public_flag: boolean;
  key_photos: string[];
  created_at: string;
  updated_at: string;
}

export function ExplorationTab({ action, onUpdate }: ExplorationTabProps) {
  const [exploration, setExploration] = useState<ExplorationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [formData, setFormData] = useState({
    exploration_notes_text: '',
    metrics_text: '',
    public_flag: false,
    key_photos: [] as string[]
  });
  const [hasChanges, setHasChanges] = useState(false);
  
  const { toast } = useToast();
  const { uploadImages, isUploading } = useImageUpload();
  const explorationService = new ExplorationService();
  const aiContentService = new AIContentService();

  // Load exploration data
  useEffect(() => {
    const loadExploration = async () => {
      if (!action.id) return;
      
      try {
        setLoading(true);
        // Try to get exploration by action_id
        const response = await explorationService.getExplorationByActionId(action.id);
        if (response) {
          setExploration(response);
          setFormData({
            exploration_notes_text: response.exploration_notes_text || '',
            metrics_text: response.metrics_text || '',
            public_flag: response.public_flag,
            key_photos: response.key_photos || []
          });
        }
      } catch (error) {
        console.error('Error loading exploration:', error);
        // Don't show error toast - exploration might not exist yet
      } finally {
        setLoading(false);
      }
    };

    loadExploration();
  }, [action.id]);

  // Track changes
  useEffect(() => {
    if (!exploration) return;
    
    const hasFormChanges = 
      formData.exploration_notes_text !== (exploration.exploration_notes_text || '') ||
      formData.metrics_text !== (exploration.metrics_text || '') ||
      formData.public_flag !== exploration.public_flag ||
      JSON.stringify(formData.key_photos) !== JSON.stringify(exploration.key_photos || []);
    
    setHasChanges(hasFormChanges);
  }, [formData, exploration]);

  const handleSave = async () => {
    if (!exploration || !hasChanges) return;

    try {
      setSaving(true);
      
      const updateData: UpdateExplorationRequest = {
        exploration_notes_text: formData.exploration_notes_text || undefined,
        metrics_text: formData.metrics_text || undefined,
        public_flag: formData.public_flag,
        key_photos: formData.key_photos
      };

      const updatedExploration = await explorationService.updateExploration(exploration.id, updateData);
      
      setExploration(updatedExploration);
      setHasChanges(false);
      
      toast({
        title: "Success",
        description: "Exploration data updated successfully",
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error saving exploration:', error);
      toast({
        title: "Error",
        description: "Failed to save exploration data",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAISuggestions = async () => {
    if (!action.id) return;

    try {
      setGeneratingAI(true);
      
      const request: ExplorationSuggestionRequest = {
        action_id: action.id,
        state_text: action.description || '',
        policy_text: action.policy,
        summary_policy_text: action.summary_policy_text,
        existing_exploration_notes: formData.exploration_notes_text,
        existing_metrics: formData.metrics_text
      };

      const response = await aiContentService.generateExplorationSuggestions(request);
      
      if (response?.content) {
        // Update form with AI suggestions, but don't overwrite existing content
        setFormData(prev => ({
          ...prev,
          exploration_notes_text: prev.exploration_notes_text || response.content.exploration_notes_text,
          metrics_text: prev.metrics_text || response.content.metrics_text
        }));

        toast({
          title: "AI Suggestions Generated",
          description: "Exploration suggestions have been added to empty fields",
        });
      } else {
        toast({
          title: "AI Unavailable",
          description: "AI suggestions are currently unavailable. Please fill in the fields manually.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI suggestions",
        variant: "destructive",
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      
      // Upload to exploration-photos bucket
      const uploadResults = await uploadImages(fileArray, { 
        bucket: 'mission-attachments' as const,
        generateFileName: (file) => `exploration-${exploration?.exploration_code || action.id}-${Date.now()}-${file.name}`
      });
      
      const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const uploadedUrls = resultsArray.map(result => result.url);
      
      // Add new photos to existing ones
      setFormData(prev => ({
        ...prev,
        key_photos: [...prev.key_photos, ...uploadedUrls]
      }));

      toast({
        title: "Success",
        description: `${uploadedUrls.length} photo(s) uploaded successfully`,
      });
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: "Error",
        description: "Failed to upload photos",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      key_photos: prev.key_photos.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading exploration data...</span>
      </div>
    );
  }

  if (!exploration) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Exploration Data</h3>
        <p className="text-muted-foreground">
          This action doesn't have exploration data. Enable exploration mode when creating or editing the action.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Exploration Code Display */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <Label className="text-sm font-medium text-muted-foreground">Exploration Code</Label>
        <p className="text-lg font-mono font-semibold">{exploration.exploration_code}</p>
      </div>

      {/* AI Suggestions Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerateAISuggestions}
          disabled={generatingAI}
          className="flex items-center gap-2"
        >
          {generatingAI ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generatingAI ? 'Generating...' : 'Get AI Suggestions'}
        </Button>
      </div>

      {/* Exploration Notes */}
      <div className="space-y-2">
        <Label htmlFor="exploration_notes">Exploration Notes</Label>
        <Textarea
          id="exploration_notes"
          placeholder="Document your exploration findings, observations, and insights..."
          value={formData.exploration_notes_text}
          onChange={(e) => setFormData(prev => ({ ...prev, exploration_notes_text: e.target.value }))}
          rows={6}
          className="min-h-[150px]"
        />
        <p className="text-xs text-muted-foreground">
          Record detailed observations about the exploration area, conditions, and any notable findings.
        </p>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <Label htmlFor="metrics">Metrics & Measurements</Label>
        <Textarea
          id="metrics"
          placeholder="Record measurements, quantities, and quantitative observations..."
          value={formData.metrics_text}
          onChange={(e) => setFormData(prev => ({ ...prev, metrics_text: e.target.value }))}
          rows={4}
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          Include specific measurements, counts, percentages, or other quantitative data.
        </p>
      </div>

      {/* Photo Upload */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Exploration Photos</Label>
          <p className="text-xs text-muted-foreground">
            Upload photos of treated/exploration areas and optional comparison areas
          </p>
        </div>
        
        {/* Photo Upload Button */}
        <div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
            id="exploration-photo-upload"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('exploration-photo-upload')?.click()}
            disabled={isUploading}
            className="w-full"
          >
            <Camera className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Photos'}
          </Button>
        </div>

        {/* Display uploaded photos */}
        {formData.key_photos.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Uploaded Photos ({formData.key_photos.length})</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {formData.key_photos.map((photoUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photoUrl.startsWith('http') ? photoUrl : `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${photoUrl}`}
                    alt={`Exploration photo ${index + 1}`}
                    className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(photoUrl.startsWith('http') ? photoUrl : `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${photoUrl}`, '_blank')}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Public Flag */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="space-y-1">
          <Label htmlFor="public_flag" className="text-sm font-medium">
            Public Exploration
          </Label>
          <p className="text-xs text-muted-foreground">
            Make this exploration visible to other users for learning and reference
          </p>
        </div>
        <Switch
          id="public_flag"
          checked={formData.public_flag}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, public_flag: checked }))}
        />
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground pt-4 border-t">
        <p>Created: {new Date(exploration.created_at).toLocaleString()}</p>
        <p>Last Updated: {new Date(exploration.updated_at).toLocaleString()}</p>
      </div>
    </div>
  );
}