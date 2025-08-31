import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface LeadershipRouteProps {
  children: React.ReactNode;
}

export default function LeadershipRoute({ children }: LeadershipRouteProps) {
  const { user, loading, isLeadership } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && !isLeadership) {
      navigate('/dashboard');
    }
  }, [user, loading, isLeadership, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isLeadership) {
    return null;
  }

  return <>{children}</>;
}