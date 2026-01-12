import { useEffect } from 'react';
import { useAuth } from "@/hooks/useCognitoAuth";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, CheckCircle, XCircle, Wrench, Box, Flag, ClipboardCheck, Target, BarChart3, Building2, Settings, Bot, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DebugModeToggle } from '@/components/DebugModeToggle';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { EditableDisplayName } from '@/components/EditableDisplayName';
import { useOrganization } from '@/hooks/useOrganization';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQueryClient } from '@tanstack/react-query';
import { toolsQueryKey, partsOrdersQueryKey } from '@/lib/queryKeys';
import { apiService, getApiData } from '@/lib/apiService';

export default function Dashboard() {
  const { user, signOut, isAdmin, isLeadership, idToken } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { organization, loading: orgLoading } = useOrganization();

  // Debug logging to understand permission state
  console.log('Dashboard permissions:', {
    isAdmin,
    isLeadership,
    isSuperAdmin,
    user: user?.userId,
    loading: orgLoading
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use a fallback title immediately, update when org loads
  const appTitle = organization 
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

  // Prefetch tools, parts, and parts_orders data in parallel when dashboard loads
  // Use idToken from useAuth hook (already loaded) to avoid waiting for token fetch
  useEffect(() => {
    const prefetchData = async () => {
      // Only prefetch if data isn't already in cache
      const cachedTools = queryClient.getQueryData(toolsQueryKey());
      const cachedParts = queryClient.getQueryData(['parts']);
      const cachedPartsOrders = queryClient.getQueryData(partsOrdersQueryKey());

      if (cachedTools && cachedParts && cachedPartsOrders) {
        return; // All data already cached
      }

      // Use idToken from useAuth hook (already available, no need to fetch)
      // If not available yet, wait for it (but this should be fast since useAuth loads on mount)
      let token = idToken;
      if (!token) {
        // Fallback: get token if not available from context
        const { fetchAuthSession } = await import('aws-amplify/auth');
        const session = await fetchAuthSession({ forceRefresh: false });
        token = session.tokens?.idToken?.toString() || null;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
      const fetchStart = performance.now();

      // Build array of parallel fetch promises - these start simultaneously
      const fetchPromises: Promise<any>[] = [];
      const startTime = performance.now();

      if (!cachedTools) {
        const toolsStart = performance.now();
        console.log(`[Dashboard] Starting tools fetch at ${(toolsStart - startTime).toFixed(2)}ms`);
        fetchPromises.push(
          fetch(`${baseUrl}/api/tools?limit=2000`, { headers })
            .then(res => {
              console.log(`[Dashboard] Tools response received at ${(performance.now() - startTime).toFixed(2)}ms`);
              return res.json();
            })
            .then(result => {
              const data = getApiData(result) || [];
              queryClient.setQueryData(toolsQueryKey(), data);
              console.log(`[Dashboard] Tools completed at ${(performance.now() - startTime).toFixed(2)}ms`);
              return data;
            })
            .catch(err => {
              console.error('Failed to fetch tools:', err);
              return null;
            })
        );
      }

      if (!cachedParts) {
        const partsStart = performance.now();
        console.log(`[Dashboard] Starting parts fetch at ${(partsStart - startTime).toFixed(2)}ms`);
        fetchPromises.push(
          fetch(`${baseUrl}/api/parts?limit=2000`, { headers })
            .then(res => {
              console.log(`[Dashboard] Parts response received at ${(performance.now() - startTime).toFixed(2)}ms`);
              return res.json();
            })
            .then(result => {
              const data = getApiData(result) || [];
              queryClient.setQueryData(['parts'], data);
              console.log(`[Dashboard] Parts completed at ${(performance.now() - startTime).toFixed(2)}ms`);
              return data;
            })
            .catch(err => {
              console.error('Failed to fetch parts:', err);
              return null;
            })
        );
      }

      if (!cachedPartsOrders) {
        const ordersStart = performance.now();
        console.log(`[Dashboard] Starting parts_orders fetch at ${(ordersStart - startTime).toFixed(2)}ms`);
        fetchPromises.push(
          fetch(`${baseUrl}/api/parts_orders`, { headers })
            .then(res => {
              console.log(`[Dashboard] Parts_orders response received at ${(performance.now() - startTime).toFixed(2)}ms`);
              return res.json();
            })
            .then(result => {
              const data = getApiData(result) || [];
              queryClient.setQueryData(partsOrdersQueryKey(), data);
              console.log(`[Dashboard] Parts_orders completed at ${(performance.now() - startTime).toFixed(2)}ms`);
              return data;
            })
            .catch(err => {
              console.error('Failed to fetch parts_orders:', err);
              return null;
            })
        );
      }

      // Execute all fetches in parallel - these will start simultaneously
      // Don't await - let them run in background so dashboard renders immediately
      if (fetchPromises.length > 0) {
        console.log(`[Dashboard] Starting ${fetchPromises.length} parallel requests at ${(performance.now() - startTime).toFixed(2)}ms`);
        // Fire and forget - don't block dashboard rendering
        Promise.all(fetchPromises).then(() => {
          console.log(`[Dashboard] All requests completed in ${(performance.now() - startTime).toFixed(2)}ms`);
        }).catch(err => {
          console.error('[Dashboard] Error prefetching data:', err);
        });
      }
    };

    prefetchData();
  }, [queryClient, idToken]); // Re-run when idToken becomes available

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
      title: "Explorations",
      description: "Review and manage exploration data",
      icon: Search,
      path: "/explorations",
      color: "bg-purple-500"
    },
    {
      title: "Stargazer Projects",
      description: "Manage objectives and track progress",
      icon: Flag,
      path: "/missions",
      color: "bg-blue-500"
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
            // Show items based on permissions, but show all basic items while permissions load
            const shouldShow = (() => {
              if (item.path === "/dashboard/analytics") return isLeadership;
              if (item.path === "/organization") return isLeadership;
              if (item.path === "/admin/organizations") return isSuperAdmin;
              return true; // Show all other items (Assets, Actions, Explorations, etc.)
            })();
            
            console.log(`Menu item ${item.title} (${item.path}): shouldShow=${shouldShow}, isLeadership=${isLeadership}, isSuperAdmin=${isSuperAdmin}`);
            return shouldShow;
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
