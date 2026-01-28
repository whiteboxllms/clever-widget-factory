import { useState, useEffect, useRef } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ScoreEntry {
  score: number;
  reason: string;
  how_to_improve?: string;
}

interface ScoreEntryFormProps {
  initialScores?: Record<string, ScoreEntry>;
  rootCauses?: string[];
  onSave: (scores: Record<string, ScoreEntry>) => void;
  onCancel: () => void;
}

export function ScoreEntryForm({ initialScores = {}, rootCauses = [], onSave, onCancel }: ScoreEntryFormProps) {
  const [scores, setScores] = useState<Record<string, ScoreEntry>>(initialScores);
  const [newAttributeName, setNewAttributeName] = useState('');
  const prevInitialScoresRef = useRef<Record<string, ScoreEntry>>();

  // Update local state when initialScores prop changes - but only if content actually changed
  useEffect(() => {
    // Deep comparison to avoid infinite loops from object reference changes
    const hasChanged = !prevInitialScoresRef.current || 
                      JSON.stringify(prevInitialScoresRef.current) !== JSON.stringify(initialScores);
    
    if (hasChanged) {
      console.log('ScoreEntryForm: initialScores content changed:', initialScores);
      setScores(initialScores);
      prevInitialScoresRef.current = initialScores;
    }
  }, [initialScores]);

  const handleScoreChange = (attribute: string, field: 'score' | 'reason', value: string | number) => {
    setScores(prev => ({
      ...prev,
      [attribute]: {
        ...prev[attribute],
        [field]: value,
      }
    }));
  };

  const handleAddAttribute = () => {
    if (newAttributeName.trim() && !scores[newAttributeName]) {
      setScores(prev => ({
        ...prev,
        [newAttributeName]: { score: 0, reason: '', how_to_improve: '' }
      }));
      setNewAttributeName('');
    }
  };

  const handleRemoveAttribute = (attribute: string) => {
    setScores(prev => {
      const newScores = { ...prev };
      delete newScores[attribute];
      return newScores;
    });
  };

  const handleSave = () => {
    // Validate scores
    const isValid = Object.values(scores).every(entry => 
      entry.score >= -2 && entry.score <= 2 && entry.reason.trim().length > 0
    );

    if (!isValid) {
      alert('Please ensure all scores are between -2 and 2 and all reasons are filled in.');
      return;
    }

    onSave(scores);
  };

  const getScoreColor = (score: number) => {
    if (score >= 1) return 'bg-green-100 text-green-800';
    if (score <= -1) return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const meanScore = Object.values(scores).length > 0
    ? Object.values(scores).reduce((sum, entry) => sum + entry.score, 0) / Object.values(scores).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Root Causes Analysis */}
      {rootCauses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Root Cause Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {rootCauses.map((cause, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <Badge variant="outline" className="mt-0.5 text-xs">
                    {index + 1}
                  </Badge>
                  <span className="text-sm">{cause}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Existing Scores */}
      <div className="space-y-2">
        {Object.entries(scores).map(([attribute, entry]) => (
          <div key={attribute} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
            <Badge className={`${getScoreColor(entry.score)} shrink-0 h-6`}>
              {entry.score}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm mb-1">{attribute}</div>
              <div className="text-xs text-muted-foreground mb-1">
                <span className="font-medium">Reason:</span> {entry.reason}
              </div>
              {entry.how_to_improve && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">How to Improve:</span> {entry.how_to_improve}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add New Attribute */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Attribute</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              value={newAttributeName}
              onChange={(e) => setNewAttributeName(e.target.value)}
              placeholder="Enter attribute name"
              onKeyPress={(e) => e.key === 'Enter' && handleAddAttribute()}
            />
            <Button onClick={handleAddAttribute} disabled={!newAttributeName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={Object.keys(scores).length === 0}>
          <Save className="w-4 h-4 mr-2" />
          Save Scores
        </Button>
      </div>

      {/* Score Legend */}
      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-semibold mb-2">Scoring Guide</h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
          <div className="flex items-center space-x-2">
            <Badge className="bg-red-100 text-red-800">-2</Badge>
            <span>Severe negative impact</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-red-100 text-red-800">-1</Badge>
            <span>Negative impact</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-yellow-100 text-yellow-800">0</Badge>
            <span>Neutral/No impact</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-green-100 text-green-800">+1</Badge>
            <span>Positive impact</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-green-100 text-green-800">+2</Badge>
            <span>Strong positive impact</span>
          </div>
        </div>
      </div>
    </div>
  );
}
