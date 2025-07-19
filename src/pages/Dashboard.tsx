import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { LogOut, Package, Search, CheckCircle, XCircle, Wrench, Box } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DebugModeToggle } from '@/components/DebugModeToggle';

export default function Dashboard() {
  const { user, signOut } = useAuth();
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
      title: "Check In Tool",
      description: "Return a tool and report condition",
      icon: CheckCircle,
      path: "/checkin",
      color: "bg-green-500"
    },
    {
      title: "Inventory",
      description: "View all tools and parts",
      icon: Package,
      path: "/inventory",
      color: "bg-orange-500"
    },
    {
      title: "Tools",
      description: "View and manage tools",
      icon: Wrench,
      path: "/tools",
      color: "bg-red-500"
    },
    {
      title: "Manage Inventory",
      description: "Add and edit consumable parts",
      icon: Box,
      path: "/parts",
      color: "bg-teal-500"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold">Farm Tool Tracker</h1>
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
          {menuItems.map((item) => {
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
      </main>
    </div>
  );
}