import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParentStructures } from "@/hooks/tools/useParentStructures";
import { StorageVicinitySelector } from "@/components/StorageVicinitySelector";

interface LocationFieldsGroupProps {
  // Current values
  legacyLocation?: string;
  areaValue?: string;  // Can be parent_structure_id or storage_vicinity
  specificLocation?: string;
  
  // Change handlers
  onAreaChange: (value: string) => void;
  onSpecificLocationChange: (value: string) => void;
  
  // Configuration
  showLegacyField?: boolean;
  legacyFieldLabel?: string;
  areaFieldLabel?: string;
  areaDataSource: 'parent_structures' | 'storage_vicinities';
  specificLocationPlaceholder?: string;
  
  // Validation
  areaRequired?: boolean;
  specificLocationRequired?: boolean;
}

export const LocationFieldsGroup: React.FC<LocationFieldsGroupProps> = ({
  legacyLocation,
  areaValue,
  specificLocation,
  onAreaChange,
  onSpecificLocationChange,
  showLegacyField = false,
  legacyFieldLabel = "Legacy Location (Reference)",
  areaFieldLabel = "Area",
  areaDataSource,
  specificLocationPlaceholder = "e.g., Shelf A2, Drawer 3",
  areaRequired = false,
  specificLocationRequired = false
}) => {
  const { parentStructures } = useParentStructures();

  const renderAreaField = () => {
    if (areaDataSource === 'parent_structures') {
      return (
        <Select
          value={areaValue || "none"}
          onValueChange={onAreaChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select parent structure (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {parentStructures.map((structure) => (
              <SelectItem key={structure.id} value={structure.id}>
                {structure.name} ({structure.category})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else {
      return (
        <StorageVicinitySelector
          value={areaValue || ""}
          onValueChange={onAreaChange}
          placeholder="Select or add storage vicinity"
        />
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Legacy Location Field - Only show if specified */}
      {showLegacyField && legacyLocation && (
        <div>
          <Label>{legacyFieldLabel}</Label>
          <Input
            value={legacyLocation}
            disabled
            className="bg-muted text-muted-foreground"
          />
        </div>
      )}

      {/* Area Field */}
      <div>
        <Label htmlFor="area-field">
          {areaFieldLabel}{areaRequired && " *"}
        </Label>
        {renderAreaField()}
      </div>

      {/* Specific Location Field */}
      <div>
        <Label htmlFor="specific-location">
          Specific Location{specificLocationRequired && " *"}
        </Label>
        <Input
          id="specific-location"
          value={specificLocation || ""}
          onChange={(e) => onSpecificLocationChange(e.target.value)}
          placeholder={specificLocationPlaceholder}
        />
      </div>
    </div>
  );
};