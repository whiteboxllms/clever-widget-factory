import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [processed, setProcessed] = useState(false);

  const orgId = searchParams.get('org_id');

  useEffect(() => {
    if (!orgId) {
      navigate('/auth');
      return;
    }

    // Process auth tokens from URL (from Supabase Auth invitation email)
    if (!processed) {
      processInviteTokens();
    }

    // If user is already logged in, just join the organization
    if (user && processed) {
      joinOrganization();
    }
  }, [user, orgId, navigate, processed]);

  const processInviteTokens = async () => {
    setProcessed(true);
    setLoading(true);
    
    try {
      // Extract tokens from URL hash or search params
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
      const type = hashParams.get('type') || searchParams.get('type');

      if (accessToken && refreshToken && type === 'invite') {
        // Set the session using the tokens from the email
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('Error setting session:', error);
          setError('Invalid or expired invitation link');
          setLoading(false);
          return;
        }

        if (data.user) {
          // User is now authenticated, the useEffect will handle joining the organization
          toast({
            title: "Invitation Accepted",
            description: "Welcome! Joining your organization...",
          });
        }
      } else {
        // No tokens found, this might be a direct access or expired link
        console.log('No invitation tokens found in URL');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error processing invite tokens:', error);
      setError('Failed to process invitation');
      setLoading(false);
    }
  };

  const joinOrganization = async () => {
    if (!user || !orgId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgId,
          user_id: user.id,
          role: 'user'
        });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to join organization",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Successfully joined the organization!",
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error joining organization:', error);
      toast({
        title: "Error",
        description: "Failed to join organization",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
      } else {
        // Password set successfully, user will be logged in
        toast({
          title: "Success",
          description: "Password set successfully! Joining organization...",
        });
        // The useEffect will handle joining the organization once user is logged in
      }
    } catch (error: any) {
      setError(error.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  if (!orgId) {
    return null;
  }

  // Show loading while processing invite tokens
  if (loading && !user && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Processing Invitation</CardTitle>
            <CardDescription>
              Verifying your invitation link...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while joining organization
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Joining Organization</CardTitle>
            <CardDescription>
              Adding you to the organization...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state or manual setup
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {error ? "Invitation Error" : "Complete Account Setup"}
          </CardTitle>
          <CardDescription>
            {error 
              ? "There was an issue with your invitation link" 
              : "Set your password to complete your account setup and join the organization"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {!error && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter your password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm your password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? "Setting up..." : "Complete Setup"}
              </Button>
            </form>
          )}
          
          {error && (
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full mt-4"
              variant="outline"
            >
              Go to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}