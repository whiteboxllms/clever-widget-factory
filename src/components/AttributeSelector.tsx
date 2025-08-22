import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { AttributeType, IssueRequirement } from '@/hooks/useWorkerAttributes';

interface AttributeSelectorProps {
  requirements: IssueRequirement[];
  onAddRequirement: (attributeType: AttributeType, requiredLevel: number) => void;
  onRemoveRequirement: (requirementId: string) => void;
  disabled?: boolean;
}

const attributeLabels: Record<AttributeType, string> = {
  communication: 'Communication',
  quality: 'Quality',
  transparency: 'Transparency', 
  reliability: 'Reliability',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  it: 'IT',
  carpentry: 'Carpentry',
  plumbing: 'Plumbing',
  hydraulics: 'Hydraulics',
  welding: 'Welding',
  fabrication: 'Fabrication'
};

const attributeColors: Record<AttributeType, string> = {
  communication: 'bg-blue-100 text-blue-800',
  quality: 'bg-green-100 text-green-800',
  transparency: 'bg-yellow-100 text-yellow-800',
  reliability: 'bg-purple-100 text-purple-800',
  mechanical: 'bg-red-100 text-red-800',
  electrical: 'bg-orange-100 text-orange-800',
  it: 'bg-cyan-100 text-cyan-800',
  carpentry: 'bg-amber-100 text-amber-800',
  plumbing: 'bg-teal-100 text-teal-800',
  hydraulics: 'bg-indigo-100 text-indigo-800',
  welding: 'bg-pink-100 text-pink-800',
  fabrication: 'bg-gray-100 text-gray-800'
};

export function AttributeSelector({ requirements, onAddRequirement, onRemoveRequirement, disabled }: AttributeSelectorProps) {
  const [selectedAttribute, setSelectedAttribute] = useState<AttributeType | ''>('');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  const availableAttributes = Object.keys(attributeLabels).filter(
    attr => !requirements.some(req => req.attribute_type === attr)
  ) as AttributeType[];

  const handleAddRequirement = () => {
    if (selectedAttribute) {
      onAddRequirement(selectedAttribute, selectedLevel);
      setSelectedAttribute('');
      setSelectedLevel(1);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Required Skills & Levels</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Requirements */}
        <div className="flex flex-wrap gap-2">
          {requirements.map((req) => (
            <Badge 
              key={req.id} 
              variant="secondary"
              className={`${attributeColors[req.attribute_type]} flex items-center gap-1`}
            >
              {attributeLabels[req.attribute_type]} L{req.required_level}
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => onRemoveRequirement(req.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
          {requirements.length === 0 && (
            <span className="text-sm text-muted-foreground">No skill requirements set</span>
          )}
        </div>

        {/* Add New Requirement */}
        {!disabled && availableAttributes.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select value={selectedAttribute} onValueChange={(value) => setSelectedAttribute(value as AttributeType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select skill" />
                </SelectTrigger>
                <SelectContent>
                  {availableAttributes.map((attr) => (
                    <SelectItem key={attr} value={attr}>
                      {attributeLabels[attr]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <Select value={selectedLevel.toString()} onValueChange={(value) => setSelectedLevel(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <SelectItem key={level} value={level.toString()}>
                      L{level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAddRequirement} 
              size="sm" 
              disabled={!selectedAttribute}
              className="px-3"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}