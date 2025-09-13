import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user, updatePassword, resetPassword } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Account Settings | Asset Tracker';
  }, []);

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
        <div className="p-4">
          <h1 className="text-2xl font-bold">Account Settings</h1>
        </div>
      </header>

      <main className="p-6">
        <section className="max-w-xl">
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
