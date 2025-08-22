import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';

interface MigrationResult {
  totalTools: number;
  processedTools: number;
  skippedTools: number;
  migratedIssues: number;
  skippedIssues: number;
  errors: string[];
  details: Array<{
    tool: string;
    action: 'skipped' | 'migrated';
    reason?: string;
    issue?: {
      description: string;
      type: string;
      blocksCheckout: boolean;
      originalText: string;
    };
    originalText?: string;
  }>;
}

export function MigrateLegacyIssues() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [dryRun, setDryRun] = useState(true);

  const runMigration = async (isDryRun: boolean) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-legacy-issues', {
        body: { dryRun: isDryRun }
      });

      if (error) throw error;

      setResult(data.results);
      setDryRun(isDryRun);
      
      toast({
        title: isDryRun ? "Dry run completed" : "Migration completed",
        description: `Processed ${data.results.processedTools} tools, migrated ${data.results.migratedIssues} issues`,
      });
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: "Migration failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Migrate Legacy Issues
          </CardTitle>
          <CardDescription>
            Convert legacy "known_issues" text fields into structured tool issues. 
            Run a dry run first to preview the migration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => runMigration(true)}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              {isLoading && dryRun ? 'Running...' : 'Dry Run'}
            </Button>
            <Button
              onClick={() => runMigration(false)}
              disabled={isLoading || !result}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {isLoading && !dryRun ? 'Migrating...' : 'Run Migration'}
            </Button>
          </div>
          
          {!result && (
            <div className="text-sm text-muted-foreground">
              Start with a dry run to see what would be migrated without making changes.
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {dryRun ? (
                <>
                  <Clock className="h-5 w-5" />
                  Dry Run Results
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Migration Results
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{result.totalTools}</div>
                <div className="text-sm text-muted-foreground">Total Tools</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.processedTools}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.migratedIssues}</div>
                <div className="text-sm text-muted-foreground">Issues {dryRun ? 'Would Be' : ''} Migrated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{result.skippedTools}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Errors ({result.errors.length})
                </h4>
                <div className="space-y-1">
                  {result.errors.map((error, index) => (
                    <div key={index} className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h4 className="font-medium">Migration Details</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.details.map((detail, index) => (
                  <div key={index} className="border rounded p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{detail.tool}</span>
                      <Badge variant={detail.action === 'migrated' ? 'default' : 'secondary'}>
                        {detail.action}
                      </Badge>
                    </div>
                    
                    {detail.action === 'skipped' && detail.reason && (
                      <div className="text-sm text-muted-foreground">
                        Reason: {detail.reason}
                      </div>
                    )}
                    
                    {detail.issue && (
                      <div className="space-y-1">
                        <div className="text-sm">
                          <strong>Issue:</strong> {detail.issue.description}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">
                            {detail.issue.type}
                          </Badge>
                          {detail.issue.blocksCheckout && (
                            <Badge variant="destructive">
                              Blocks Checkout
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {detail.originalText && (
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        <strong>Original:</strong> {detail.originalText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}