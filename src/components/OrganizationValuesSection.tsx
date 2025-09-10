import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Heart, Save, Info } from 'lucide-react';
import { StrategicAttributeType, strategicAttributeLabels } from '@/hooks/useStrategicAttributes';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';

interface OrganizationValuesSectionProps {
  canEdit: boolean;
}

export function OrganizationValuesSection({ canEdit }: OrganizationValuesSectionProps) {
  const { getOrganizationValues, updateOrganizationValues, isLoading } = useOrganizationValues();
  const [selectedAttributes, setSelectedAttributes] = useState<StrategicAttributeType[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialAttributes, setInitialAttributes] = useState<StrategicAttributeType[]>([]);

  // Load current organization values
  useEffect(() => {
    const loadValues = async () => {
      const values = await getOrganizationValues();
      setSelectedAttributes(values);
      setInitialAttributes(values);
    };
    loadValues();
  }, [getOrganizationValues]);

  // Track changes
  useEffect(() => {
    const hasChangesDetected = JSON.stringify(selectedAttributes.sort()) !== JSON.stringify(initialAttributes.sort());
    setHasChanges(hasChangesDetected);
  }, [selectedAttributes, initialAttributes]);

  const handleAttributeToggle = (attribute: StrategicAttributeType, checked: boolean) => {
    if (!canEdit) return;

    setSelectedAttributes(prev => {
      if (checked) {
        return [...prev, attribute];
      } else {
        return prev.filter(attr => attr !== attribute);
      }
    });
  };

  const handleSave = async () => {
    const success = await updateOrganizationValues(selectedAttributes);
    if (success) {
      setInitialAttributes(selectedAttributes);
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    setSelectedAttributes(initialAttributes);
    setHasChanges(false);
  };

  const allAttributeTypes = Object.keys(strategicAttributeLabels) as StrategicAttributeType[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Organization Values
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Strategic Focus Areas</p>
              <p className="text-blue-700 dark:text-blue-200">
                Select the strategic attributes that best represent your organization's values and priorities. 
                These will be used in analytics and scoring to focus on what matters most to your team.
              </p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allAttributeTypes.map((attribute) => (
              <div key={attribute} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={attribute}
                  checked={selectedAttributes.includes(attribute)}
                  onCheckedChange={(checked) => handleAttributeToggle(attribute, checked as boolean)}
                  disabled={!canEdit}
                />
                <label 
                  htmlFor={attribute}
                  className="text-sm font-medium leading-none cursor-pointer flex-1"
                >
                  {strategicAttributeLabels[attribute]}
                </label>
              </div>
            ))}
          </div>
        )}

        {!canEdit && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Current organization values:</p>
            <div className="flex flex-wrap gap-2">
              {selectedAttributes.length > 0 ? (
                selectedAttributes.map((attribute) => (
                  <Badge key={attribute} variant="default" className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {strategicAttributeLabels[attribute]}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No specific values configured - using all attributes</p>
              )}
            </div>
          </div>
        )}

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

        {selectedAttributes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected Values ({selectedAttributes.length}):</p>
            <div className="flex flex-wrap gap-2">
              {selectedAttributes.map((attribute) => (
                <Badge key={attribute} variant="default" className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {strategicAttributeLabels[attribute]}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}