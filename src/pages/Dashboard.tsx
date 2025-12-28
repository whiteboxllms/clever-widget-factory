import { useAuth } from "@/hooks/useCognitoAuth";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, CheckCircle, XCircle, Wrench, Box, Flag, ClipboardCheck, Target, ClipboardList, BarChart3, Building2, Settings, Bot, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DebugModeToggle } from '@/components/DebugModeToggle';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { EditableDisplayName } from '@/components/EditableDisplayName';
import { useOrganization } from '@/hooks/useOrganization';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQueryClient } from '@tanstack/react-query';

export default function Dashboard() {
  const { user, signOut, isAdmin, isLeadership } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { organization, loading: orgLoading } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const appTitle = orgLoading 
    ? "Asset Tracker" 
    : organization 
      ? `${organization.name} Asset Tracker`
      : "Asset Tracker";

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

  const handleClearCache = () => {
    queryClient.clear();
    toast({
      title: "Cache cleared",
      description: "All cached data has been cleared. Refreshing...",
    });
    setTimeout(() => window.location.reload(), 500);
  };

  const menuItems = [
    {
      title: "Assets",
      description: "Unified view of assets and stock",
      icon: Box,
      path: "/combined-assets",
      color: "bg-green-500"
    },
    {
      title: "Actions",
      description: "Track and manage policy actions",
      icon: Target,
      path: "/actions",
      color: "bg-yellow-500"
    },
    {
      title: "Stargazer Projects",
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
      title: "Sari Sari Store",
      description: "Chat with AI assistant for farm produce",
      icon: Bot,
      path: "/sari-sari-chat",
      color: "bg-orange-500"
    },
    {
      title: "Analytics",
      description: "View strategic attributes analytics",
      icon: BarChart3,
      path: "/dashboard/analytics",
      color: "bg-indigo-500"
    },
    {
      title: "Organization Settings",
      description: "Manage organization members and settings",
      icon: Settings,
      path: "/organization",
      color: "bg-teal-500"
    },
    {
      title: "Organizations",
      description: "Manage all organizations (Super Admin)",
      icon: Building2,
      path: "/admin/organizations",
      color: "bg-emerald-500"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold">{appTitle}</h1>
            <EditableDisplayName />
          </div>
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleClearCache} variant="outline" size="sm" className="p-2">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear Cache</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => navigate('/settings')} variant="outline" size="sm" className="p-2">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
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
          {menuItems.filter(item => {
            if (item.path === "/dashboard/analytics") return isLeadership;
            if (item.path === "/organization") return isLeadership;
            if (item.path === "/admin/organizations") return isSuperAdmin;
            return true;
          }).map((item) => {
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
