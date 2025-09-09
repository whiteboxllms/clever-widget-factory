import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [step, setStep] = useState<'loading' | 'set-password' | 'success' | 'error'>('loading');

  useEffect(() => {
    handleMagicLinkAuth();
  }, []);

  const handleMagicLinkAuth = async () => {
    try {
      // Check if this is a magic link callback
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const type = searchParams.get('type');

      if (accessToken && refreshToken && type === 'magiclink') {
        // Set the session from the magic link
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
          setStep('error');
          return;
        }

        if (data.user) {
          setUserEmail(data.user.email || '');
          const metadata = data.user.user_metadata;
          
          if (metadata?.organization_name) {
            setOrganizationName(metadata.organization_name);
          }

          // Check if user needs to set password (invited users won't have email_confirmed_at initially)
          if (!data.user.email_confirmed_at || metadata?.needs_password_setup) {
            // User needs to set a password
            setStep('set-password');
          } else {
            // User already has password, proceed to join organization
            await joinOrganization(data.user.id, metadata);
          }
        }
      } else {
        // Check if user is already logged in but needs to set password
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserEmail(session.user.email || '');
          const metadata = session.user.user_metadata;
          
          if (metadata?.organization_name) {
            setOrganizationName(metadata.organization_name);
          }

          if (metadata?.needs_password_setup) {
            setStep('set-password');
          } else {
            // Already set up, redirect to dashboard
            navigate('/dashboard');
          }
        } else {
          setError('Invalid invitation link or session expired');
          setStep('error');
        }
      }
    } catch (error: any) {
      console.error('Error handling magic link:', error);
      setError(error.message);
      setStep('error');
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

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update user's password and remove the password setup flag
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          needs_password_setup: false
        }
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Join the organization
        await joinOrganization(data.user.id, data.user.user_metadata);
      }
    } catch (error: any) {
      console.error('Error setting password:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const joinOrganization = async (userId: string, metadata: any) => {
    try {
      const organizationId = metadata?.organization_id;

      if (!organizationId) {
        throw new Error('Organization information not found in invitation');
      }

      // No need to update status anymore - organization membership is already active
      // Just show success and redirect
      toast({
        title: "Welcome!",
        description: `You've successfully joined ${organizationName}`,
      });

      setStep('success');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('Error joining organization:', error);
      setError(error.message);
      setStep('error');
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Processing your invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">Welcome to {organizationName}!</h2>
              <p className="text-muted-foreground text-center">
                You've successfully joined the organization. Redirecting to dashboard...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Invitation Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Welcome to {organizationName}! Please set a password for your account ({userEmail}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up account...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}