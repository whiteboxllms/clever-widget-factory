import { useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { AssetScore } from '@/hooks/useAssetScores';

interface ScoreDisplayCardProps {
  scores: AssetScore[];
  assetName: string;
}

export function ScoreDisplayCard({ scores, assetName }: ScoreDisplayCardProps) {
  const [expandedScores, setExpandedScores] = useState<Set<string>>(new Set());

  if (scores.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">No scores available for {assetName}</p>
        </CardContent>
      </Card>
    );
  }

  const toggleExpanded = (scoreId: string) => {
    setExpandedScores(prev => {
      const newSet = new Set(prev);
      if (newSet.has(scoreId)) {
        newSet.delete(scoreId);
      } else {
        newSet.add(scoreId);
      }
      return newSet;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 1) return 'bg-green-100 text-green-800';
    if (score <= -1) return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getScoreIcon = (score: number) => {
    if (score > 0) return <TrendingUp className="w-3 h-3" />;
    if (score < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const calculateAverageScore = (scoreData: Record<string, { score: number; reason: string }>) => {
    const scores = Object.values(scoreData).map(s => s.score);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  };

  const getSourceTypeLabel = (sourceType: string) => {
    return sourceType === 'issue' ? 'Issue Report' : 'Action Completion';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Performance Scores for {assetName}</h3>
      
      {scores.map((assetScore) => {
        const averageScore = calculateAverageScore(assetScore.scores);
        const isExpanded = expandedScores.has(assetScore.id);
        
        return (
          <Card key={assetScore.id}>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-base">
                          {format(new Date(assetScore.created_at), 'MMM d, yyyy')}
                        </CardTitle>
                        <Badge variant="outline">
                          {getSourceTypeLabel(assetScore.source_type)}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(assetScore.created_at), 'h:mm a')}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          {getScoreIcon(averageScore)}
                          <span>Avg: {averageScore.toFixed(1)}</span>
                        </span>
                        <span>{Object.keys(assetScore.scores).length} attributes</span>
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge className={getScoreColor(averageScore)}>
                        {averageScore.toFixed(1)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(assetScore.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {Object.entries(assetScore.scores).map(([attribute, data]) => (
                      <div key={attribute} className="flex items-start justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-sm">{attribute}</span>
                            <Badge className={`text-xs ${getScoreColor(data.score)}`}>
                              {data.score > 0 ? '+' : ''}{data.score}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{data.reason}</p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Prompt information */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Scoring method:</span> AI-generated using custom prompt
                      </p>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}