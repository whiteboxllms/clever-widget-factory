import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { LogOut, Package, Search, CheckCircle, XCircle, Wrench, Box, Flag, ClipboardCheck, Target, ClipboardList, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DebugModeToggle } from '@/components/DebugModeToggle';
import { AuthDiagnostics } from '@/components/AuthDiagnostics';

export default function Dashboard() {
  const { user, signOut, isLeadership } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out successfully",
        description: "You have been signed out.",
      });
    }
  };

  const menuItems = [
    {
      title: "Stock",
      description: "View and manage stock",
      icon: Package,
      path: "/inventory",
      color: "bg-orange-500"
    },
    {
      title: "Assets",
      description: "View and manage assets",
      icon: Wrench,
      path: "/tools",
      color: "bg-red-500"
    },
    {
      title: "Actions",
      description: "Track and manage policy actions",
      icon: Target,
      path: "/actions",
      color: "bg-yellow-500"
    },
    {
      title: "Stargazer Missions",
      description: "Manage objectives and track progress",
      icon: Flag,
      path: "/missions",
      color: "bg-blue-500"
    },
    {
      title: "Audit",
      description: "Verify asset and stock locations",
      icon: ClipboardList,
      path: "/audit",
      color: "bg-purple-500"
    },
    {
      title: "Analytics",
      description: "View strategic attributes analytics",
      icon: BarChart3,
      path: "/dashboard/analytics",
      color: "bg-indigo-500"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold">Farm Asset Tracker</h1>
            <p className="text-muted-foreground">Welcome back, {user?.user_metadata?.full_name || user?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <DebugModeToggle />
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.filter(item => item.path !== "/dashboard/analytics" || isLeadership).map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.path}
                className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
                onClick={() => navigate(item.path)}
              >
                <CardHeader className="text-center">
                  <div className={`w-16 h-16 rounded-full ${item.color} flex items-center justify-center mx-auto mb-4`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Open
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Diagnostics - only show for debugging */}
        {window.location.hostname !== 'localhost' && (
          <AuthDiagnostics />
        )}
      </main>
    </div>
  );
}
