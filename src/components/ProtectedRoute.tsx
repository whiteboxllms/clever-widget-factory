import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useCognitoAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if we've finished loading and there's no user
    // Don't block rendering - let the UI show immediately
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Render children immediately - don't block on auth loading
  // Individual pages can handle their own auth checks if needed
  return <>{children}</>;
}