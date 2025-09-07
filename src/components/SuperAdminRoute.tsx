import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Card, CardContent } from '@/components/ui/card';

interface SuperAdminRouteProps {
  children: ReactNode;
}

const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  const { isSuperAdmin, loading } = useSuperAdmin();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default SuperAdminRoute;