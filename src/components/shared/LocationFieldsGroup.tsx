import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ParentStructure {
  id: string;
  name: string;
  category?: string;
  serial_number?: string;
}

interface LocationFieldsGroupProps {
  // Current values
  areaValue?: string;  // parent_structure_id
  specificLocation?: string;
  
  // Change handlers
  onAreaChange: (value: string) => void;
  onSpecificLocationChange: (value: string) => void;
  
  // Configuration
  areaFieldLabel?: string;
  specificLocationPlaceholder?: string;
  
  // Validation
  areaRequired?: boolean;
  specificLocationRequired?: boolean;
  
  // Loading state
  isLoadingAreas?: boolean;
  
  // Data - pass parent structures from parent component
  parentStructures?: ParentStructure[];
}

export const LocationFieldsGroup: React.FC<LocationFieldsGroupProps> = ({
  areaValue,
  specificLocation,
  onAreaChange,
  onSpecificLocationChange,
  areaFieldLabel = "Area",
  specificLocationPlaceholder = "e.g., Shelf A2, Drawer 3",
  areaRequired = false,
  specificLocationRequired = false,
  isLoadingAreas = false,
  parentStructures = []
}) => {

  return (
    <div className="space-y-4">
      {/* Area Field */}
      <div>
        <Label htmlFor="area-field">
          {areaFieldLabel}{areaRequired && " *"}
        </Label>
        <Select
          value={areaValue || "none"}
          onValueChange={onAreaChange}
          disabled={isLoadingAreas}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoadingAreas ? "Loading areas..." : "Select parent structure (optional)"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {Array.isArray(parentStructures) ? parentStructures.map((structure) => (
              <SelectItem key={structure.id} value={structure.id}>
                {structure.name}{structure.serial_number ? ` (${structure.serial_number})` : ''}
              </SelectItem>
            )) : null}
          </SelectContent>
        </Select>
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