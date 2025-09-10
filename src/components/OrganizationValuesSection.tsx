import { useState, useEffect, KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, Info, X, Plus } from 'lucide-react';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';

interface OrganizationValuesSectionProps {
  canEdit: boolean;
}

export function OrganizationValuesSection({ canEdit }: OrganizationValuesSectionProps) {
  const { getOrganizationValues, updateOrganizationValues, isLoading } = useOrganizationValues();
  const [values, setValues] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialValues, setInitialValues] = useState<string[]>([]);
  const [newValue, setNewValue] = useState('');

  // Load current organization values
  useEffect(() => {
    const loadValues = async () => {
      const currentValues = await getOrganizationValues();
      setValues(currentValues);
      setInitialValues(currentValues);
    };
    loadValues();
  }, [getOrganizationValues]);

  // Track changes
  useEffect(() => {
    const hasChangesDetected = JSON.stringify(values.sort()) !== JSON.stringify(initialValues.sort());
    setHasChanges(hasChangesDetected);
  }, [values, initialValues]);

  const handleAddValue = () => {
    const trimmedValue = newValue.trim();
    if (trimmedValue && !values.includes(trimmedValue)) {
      setValues(prev => [...prev, trimmedValue]);
      setNewValue('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddValue();
    } else if (e.key === ',' && newValue.trim()) {
      e.preventDefault();
      handleAddValue();
    }
  };

  const handleRemoveValue = (valueToRemove: string) => {
    if (!canEdit) return;
    setValues(prev => prev.filter(value => value !== valueToRemove));
  };

  const handleSave = async () => {
    const success = await updateOrganizationValues(values);
    if (success) {
      setInitialValues(values);
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    setValues(initialValues);
    setNewValue('');
    setHasChanges(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Organization Values
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Organization Values</p>
              <p className="text-blue-700 dark:text-blue-200">
                Define the core values that guide your organization. These will be used in analytics and scoring to focus on what matters most to your team.
              </p>
            </div>
          </div>
        </div>

        {/* Current Values Display */}
        <div className="space-y-4">
          <p className="text-sm font-medium">Current Values ({values.length}):</p>
          <div className="flex flex-wrap gap-2 min-h-[60px] p-4 border rounded-lg bg-muted/20">
            {values.length > 0 ? (
              values.map((value) => (
                <Badge key={value} variant="default" className="flex items-center gap-2 py-2 px-3">
                  {value}
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveValue(value)}
                      className="ml-1 hover:bg-black/20 dark:hover:bg-white/20 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${value}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic flex items-center">
                No values configured - using defaults: Growth Mindset, Root Cause Problem Solving, Teamwork, Quality
              </p>
            )}
          </div>
        </div>

        {/* Add New Value (Edit Mode) */}
        {canEdit && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Add a new value (press Enter or comma to add)"
                  className="flex-1"
                />
              </div>
              <Button 
                onClick={handleAddValue}
                disabled={!newValue.trim() || values.includes(newValue.trim())}
                size="sm"
                variant="outline"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or comma to add multiple values quickly. Duplicates will be ignored.
            </p>
          </div>
        )}

        {/* Save/Reset Buttons */}
        {canEdit && hasChanges && (
          <div className="flex items-center gap-2 pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
              size="sm"
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save Values'}
            </Button>
            <Button 
              onClick={handleReset} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
            >
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}