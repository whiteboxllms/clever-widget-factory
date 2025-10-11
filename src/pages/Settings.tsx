import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';

export default function SettingsPage() {
  const { user, updatePassword, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fullName, updateFullName } = useProfile();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [favoriteColor, setFavoriteColor] = useState('#3B82F6');
  const [colorLoading, setColorLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  useEffect(() => {
    document.title = 'Account Settings | Asset Tracker';
    fetchFavoriteColor();
    setDisplayName(fullName);
  }, [fullName]);

  const fetchFavoriteColor = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('favorite_color')
        .eq('user_id', user.id)
        .single();
      
      if (data?.favorite_color) {
        setFavoriteColor(data.favorite_color);
      }
    } catch (error) {
      console.error('Error fetching favorite color:', error);
    }
  };

  const updateFavoriteColor = async (color: string) => {
    if (!user) return;
    
    setColorLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ favorite_color: color })
        .eq('user_id', user.id);

      if (error) throw error;

      setFavoriteColor(color);
      toast({
        title: "Color updated",
        description: "Your favorite color has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating favorite color:', error);
      toast({
        title: "Error",
        description: "Failed to update your favorite color. Please try again.",
        variant: "destructive",
      });
    } finally {
      setColorLoading(false);
    }
  };

  const updateDisplayName = async () => {
    if (!displayName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setNameLoading(true);
    try {
      const success = await updateFullName(displayName.trim());
      if (success) {
        toast({
          title: "Name updated",
          description: "Your display name has been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Error updating display name:', error);
      toast({
        title: "Error",
        description: "Failed to update your display name. Please try again.",
        variant: "destructive",
      });
    } finally {
      setNameLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setLoading(true);
    setError('');
    const { error } = await resetPassword(user.email);
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: 'Password reset email sent',
        description: 'Check your email for reset instructions.',
      });
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirm = formData.get('confirm') as string;

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    const { error } = await updatePassword(password);
    if (error) {
      setError(error.message);
    } else {
      toast({ title: 'Password updated', description: 'Your password has been changed.' });
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center gap-4 p-4">
          <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
      </header>

      <main className="p-6">
        <section className="max-w-xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    disabled={nameLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={updateDisplayName}
                    disabled={nameLoading || !displayName.trim() || displayName === fullName}
                    size="sm"
                  >
                    {nameLoading ? 'Saving...' : 'Save Name'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This name will be displayed throughout the system and in asset assignments.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="favorite-color">Favorite Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="favorite-color"
                    type="color"
                    value={favoriteColor}
                    onChange={(e) => setFavoriteColor(e.target.value)}
                    className="w-12 h-10 rounded border border-input cursor-pointer"
                    disabled={colorLoading}
                  />
                  <Button
                    onClick={() => updateFavoriteColor(favoriteColor)}
                    disabled={colorLoading}
                    size="sm"
                  >
                    {colorLoading ? 'Saving...' : 'Save Color'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This color will be used to display your name throughout the system.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Signed in as</p>
                <p className="font-medium">{user?.email}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>Set new password</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set new password</DialogTitle>
                    </DialogHeader>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password">New Password</Label>
                        <Input id="password" name="password" type="password" required disabled={loading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm">Confirm Password</Label>
                        <Input id="confirm" name="confirm" type="password" required disabled={loading} />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Updating...' : 'Update Password'}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" onClick={handleSendResetEmail} disabled={loading || !user?.email}>
                  Send reset email
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
