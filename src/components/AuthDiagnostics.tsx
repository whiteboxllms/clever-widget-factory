import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateAndRefreshSession } from '@/lib/authUtils';
import { RefreshCw, User, Shield, Settings } from 'lucide-react';

export function AuthDiagnostics() {
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [authInfo, setAuthInfo] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsChecking(true);
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // Validate session
      const validation = await validateAndRefreshSession();
      
      // Get profile
      let profile = null;
      if (session?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        profile = profileData;
      }

      const diagnostics = {
        session: {
          exists: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at,
          accessToken: session?.access_token ? 'Present' : 'Missing',
          refreshToken: session?.refresh_token ? 'Present' : 'Missing',
          error: sessionError?.message
        },
        user: {
          exists: !!user,
          userId: user?.id,
          email: user?.email,
          error: userError?.message
        },
        validation: {
          isValid: validation.isValid,
          error: validation.error
        },
        profile: {
          exists: !!profile,
          role: profile?.role,
          fullName: profile?.full_name
        },
        browser: {
          userAgent: navigator.userAgent,
          cookiesEnabled: navigator.cookieEnabled,
          localStorage: typeof localStorage !== 'undefined' ? 'Available' : 'Not Available'
        }
      };

      setAuthInfo(diagnostics);
      
      console.log('Auth Diagnostics:', diagnostics);
      
      toast({
        title: "Diagnostics Complete",
        description: "Check the results below. Console has detailed logs.",
      });

    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const forceRefresh = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      toast({
        title: "Session Refreshed",
        description: "Please try your operation again",
      });
      
      // Clear diagnostics to force re-run
      setAuthInfo(null);
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Diagnostics
        </CardTitle>
        <CardDescription>
          Debug authentication issues and system status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics} 
            disabled={isChecking}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </Button>
          <Button 
            onClick={forceRefresh}
            variant="outline"
          >
            <Shield className="h-4 w-4 mr-2" />
            Force Refresh Session
          </Button>
        </div>

        {authInfo && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <h4 className="font-semibold">Session Status</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Session Exists:</span>
                    <Badge variant={authInfo.session.exists ? "default" : "destructive"}>
                      {authInfo.session.exists ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>User ID:</span>
                    <span className="text-xs">{authInfo.session.userId || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="text-xs">{authInfo.session.email || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Access Token:</span>
                    <Badge variant={authInfo.session.accessToken === 'Present' ? "default" : "destructive"}>
                      {authInfo.session.accessToken}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Profile & Validation</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Profile Role:</span>
                    <Badge variant={authInfo.profile.role === 'admin' ? "default" : "secondary"}>
                      {authInfo.profile.role || "None"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Validation:</span>
                    <Badge variant={authInfo.validation.isValid ? "default" : "destructive"}>
                      {authInfo.validation.isValid ? "Valid" : "Invalid"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {authInfo.validation.error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-destructive text-sm">
                  <strong>Validation Error:</strong> {authInfo.validation.error}
                </p>
              </div>
            )}

            <details className="border rounded p-2">
              <summary className="cursor-pointer font-medium">Browser Info</summary>
              <div className="mt-2 text-xs space-y-1">
                <div><strong>User Agent:</strong> {authInfo.browser.userAgent}</div>
                <div><strong>Cookies:</strong> {authInfo.browser.cookiesEnabled ? "Enabled" : "Disabled"}</div>
                <div><strong>LocalStorage:</strong> {authInfo.browser.localStorage}</div>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}