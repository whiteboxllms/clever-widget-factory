import React from 'react';
import { Search, Package, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SearchPromptProps {
  searchTerm: string;
  onExampleSearch: (term: string) => void;
}

export const SearchPrompt: React.FC<SearchPromptProps> = ({ searchTerm, onExampleSearch }) => {
  const examples = [
    { term: "drill", icon: Wrench, description: "Find drills and drill bits" },
    { term: "saw", icon: Wrench, description: "Search for saws and cutting tools" },
    { term: "screw", icon: Package, description: "Look for screws and fasteners" },
    { term: "wire", icon: Package, description: "Find electrical wires and cables" }
  ];

  if (searchTerm.trim()) {
    return null; // Don't show when user is actively searching
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center mb-8">
        <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Search Assets & Stock
        </h3>
        <p className="text-muted-foreground max-w-md">
          Start typing to find tools, equipment, and inventory items by name, serial number, description, or location.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg w-full">
        {examples.map((example) => (
          <Card 
            key={example.term}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onExampleSearch(example.term)}
          >
            <CardContent className="flex items-center p-4">
              <example.icon className="w-8 h-8 text-primary mr-3" />
              <div className="text-left">
                <div className="font-medium">"{example.term}"</div>
                <div className="text-sm text-muted-foreground">
                  {example.description}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 text-sm text-muted-foreground">
        💡 <strong>Tip:</strong> Use specific terms for better results
      </div>
    </div>
  );
};