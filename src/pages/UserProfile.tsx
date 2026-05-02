import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProfileSkillsSection } from '@/components/ProfileSkillsSection';
import { useAuth } from '@/hooks/useCognitoAuth';
import { useProfile } from '@/hooks/useProfile';

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fullName, organizationId, isLoading } = useProfile();

  // Extract first name from full name
  const firstName = fullName?.split(' ')[0] || '';

  // Set document title based on whether viewing own profile
  useEffect(() => {
    const isOwnProfile = user?.userId === userId;
    if (isOwnProfile && firstName) {
      document.title = `${firstName}'s Profile | Asset Tracker`;
    } else {
      document.title = 'My Profile | Asset Tracker';
    }
  }, [user?.userId, userId, firstName]);

  // Page title: show first name or fall back to "Profile"
  const pageTitle = firstName || 'Profile';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center gap-4 p-4">
          <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
        </div>
      </header>

      <main className="p-6">
        <section className="max-w-xl space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading profile...
            </div>
          ) : !organizationId ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Organization data is required to display areas of focus. Please ensure you belong to an organization.
              </AlertDescription>
            </Alert>
          ) : (
            <ProfileSkillsSection userId={userId!} organizationId={organizationId} />
          )}
          {/* Future sections (payroll, growth dashboards, impact metrics) will be added here */}
        </section>
      </main>
    </div>
  );
}
