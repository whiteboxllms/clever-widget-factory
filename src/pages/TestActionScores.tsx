import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/hooks/useCognitoAuth';

export default function TestActionScores() {
  const { user } = useAuth();
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const testResults: any = {};

    try {
      // Test 1: Get all action scores
      console.log('Test 1: Fetching action scores...');
      const scoresRes = await apiService.get<{ data: any[] }>('/action_scores');
      testResults.actionScores = {
        count: scoresRes.data?.length || 0,
        sample: scoresRes.data?.[0] || null
      };

      // Test 2: Get actions with assigned users
      console.log('Test 2: Fetching actions...');
      const actionsRes = await apiService.get<{ data: any[] }>('/actions');
      const actionsWithUsers = actionsRes.data?.filter(a => a.assigned_to) || [];
      testResults.actions = {
        total: actionsRes.data?.length || 0,
        withUsers: actionsWithUsers.length,
        userIds: [...new Set(actionsWithUsers.map(a => a.assigned_to))],
        completed: actionsRes.data?.filter(a => a.status === 'completed' && a.assigned_to).length || 0
      };

      // Test 3: Get organization members
      console.log('Test 3: Fetching org members...');
      const membersRes = await apiService.get<{ data: any[] }>('/organization_members');
      testResults.members = {
        count: membersRes.data?.length || 0,
        sample: membersRes.data?.slice(0, 3).map(m => ({
          name: m.full_name,
          id: m.user_id
        })) || []
      };

      // Test 4: Check user ID format
      const userIds = testResults.actions.userIds || [];
      const cognitoFormat = userIds.filter((id: string) => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-70[0-9a-f]{2}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
      );
      const supabaseFormat = userIds.filter((id: string) => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
      );
      
      testResults.userIdFormat = {
        total: userIds.length,
        cognito: cognitoFormat.length,
        supabase: supabaseFormat.length,
        needsMigration: supabaseFormat.length > 0,
        supabaseIds: supabaseFormat.slice(0, 5)
      };

      // Test 5: Check if current user has scored actions
      if (user?.id) {
        const userScoresRes = await apiService.get<{ data: any[] }>(`/action_scores?user_id=${user.id}`);
        testResults.currentUserScores = {
          count: userScoresRes.data?.length || 0,
          sample: userScoresRes.data?.[0] || null
        };
      }

    } catch (error: any) {
      testResults.error = error.message;
      console.error('Test error:', error);
    }

    setResults(testResults);
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Action Scores API Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runTests} disabled={loading}>
            {loading ? 'Running Tests...' : 'Run API Tests'}
          </Button>

          {Object.keys(results).length > 0 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-bold mb-2">📊 Test Results</h3>
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>

              {results.actionScores && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Action Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Total: {results.actionScores.count}</p>
                    {results.actionScores.count === 0 && (
                      <p className="text-yellow-600">⚠️ No action scores found in database</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {results.userIdFormat && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">User ID Format</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Total unique users: {results.userIdFormat.total}</p>
                    <p>Cognito format: {results.userIdFormat.cognito}</p>
                    <p>Supabase format: {results.userIdFormat.supabase}</p>
                    {results.userIdFormat.needsMigration && (
                      <div className="mt-2 p-2 bg-yellow-100 rounded">
                        <p className="font-bold text-yellow-800">⚠️ Migration Needed</p>
                        <p className="text-xs">Found Supabase UUIDs that need migration to Cognito</p>
                      </div>
                    )}
                    {!results.userIdFormat.needsMigration && results.userIdFormat.cognito > 0 && (
                      <p className="text-green-600 mt-2">✅ All user IDs are in Cognito format</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {results.currentUserScores && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Your Action Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Count: {results.currentUserScores.count}</p>
                    {results.currentUserScores.count === 0 && (
                      <p className="text-muted-foreground">No scores found for your user ID</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
