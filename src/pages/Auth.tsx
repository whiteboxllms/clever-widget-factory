import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from "@/hooks/useCognitoAuth";
import { useInvitations } from '@/hooks/useInvitations';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp, confirmSignIn, resetPassword, updatePassword } = useAuth();
  const { sendInvitation } = useInvitations();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  
  // Helper function to detect recovery parameters from both query and hash
  const getRecoveryFlagFromUrl = () => {
    const type = searchParams.get('type');
    const accessToken = searchParams.get('access_token');
    const token = searchParams.get('token');
    
    // Check URL hash as well for Supabase tokens
    const hash = window.location.hash;
    const hashType = hash.includes('type=recovery');
    const hashTokens = hash.includes('access_token=') || hash.includes('token=');
    
    return (type === 'recovery' && (accessToken || token)) || hashType || hashTokens;
  };
  
  const [isPasswordReset, setIsPasswordReset] = useState(getRecoveryFlagFromUrl());
  const [showResetForm, setShowResetForm] = useState(false);
  // Removed invitation state since magic links are handled by AcceptInvite page

  useEffect(() => {
    // Update password reset state if URL changes
    const isRecovery = getRecoveryFlagFromUrl();
    if (isRecovery !== isPasswordReset) {
      setIsPasswordReset(isRecovery);
      setError(''); // Clear any previous errors
    }

    // Invitation tokens are no longer used in the new magic link system
    // Users are redirected to /accept-invite directly

    // Redirect to dashboard ONLY if authenticated AND not in password reset flow
    if (user && !isPasswordReset) {
      navigate('/dashboard');
    }
  }, [user, navigate, searchParams, isPasswordReset]);

  // Magic link invitations are handled by the AcceptInvite page

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    setLoading(true);
    setError('');
    
    const { error } = await signIn(email, password);
    
    if (error) {
      if (error.code === 'NEW_PASSWORD_REQUIRED') {
        setNeedsPasswordChange(true);
      } else {
        setError(error.message);
      }
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    }
    
    setLoading(false);
  };

  const handleConfirmSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newPassword = formData.get('newPassword') as string;
    
    setLoading(true);
    setError('');
    
    const { error } = await confirmSignIn(newPassword);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "Password updated successfully",
        description: "You have successfully signed in.",
      });
      setNeedsPasswordChange(false);
    }
    
    setLoading(false);
  };

  // Sign up is now handled via magic link invitations only

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const email = formData.get('email') as string;
    
    setLoading(true);
    setError('');
    
    const { error } = await resetPassword(email);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "Password reset email sent",
        description: "Check your email for password reset instructions.",
      });
      setShowResetForm(false);
    }
    
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    const { error } = await signInWithGoogle();
    
    if (error) {
      setError(error.message);
    }
    
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError('');
    
    const { error } = await updatePassword(password);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: "Password updated successfully",
        description: "Your password has been updated.",
      });
      setIsPasswordReset(false);
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Asset Tracker</CardTitle>
          <p className="text-muted-foreground">Manage your assets and stock efficiently</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {needsPasswordChange ? (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Set New Password</h3>
                <p className="text-sm text-muted-foreground">You must set a new password to continue</p>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleConfirmSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Setting Password...' : 'Set Password'}
                </Button>
              </form>
            </div>
          ) : isPasswordReset ? (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Set New Password</h3>
                <p className="text-sm text-muted-foreground">Enter your new password below</p>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </div>
          ) : showResetForm ? (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Reset Password</h3>
                <p className="text-sm text-muted-foreground">Enter your email to receive password reset instructions</p>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Email'}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  onClick={() => setShowResetForm(false)}
                  disabled={loading}
                >
                  Back to Sign In
                </Button>
              </form>
            </div>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
              </TabsList>
              
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                  <div className="text-center">
                    <Button 
                      type="button" 
                      variant="link" 
                      onClick={() => setShowResetForm(true)}
                      disabled={loading}
                    >
                      Forgot your password?
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;