import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CategoryData {
  category: string;
  count: number;
}

interface UserActivityData {
  date: string;
  created: number;
  modified: number;
  used: number;
}

interface UserActivityByPerson {
  date: string;
  user: string;
  created: number;
  modified: number;
  used: number;
}

interface AdditionsTrendData {
  date: string;
  user: string;
  count: number;
}

interface InventoryAnalyticsData {
  totalItems: number;
  lowStockItems: number;
  recentAdditions: number;
  userActivity: UserActivityData[];
  userActivityByPerson: UserActivityByPerson[];
  allUsers: string[];
  additionsTrend: AdditionsTrendData[];
}

export function useInventoryAnalytics() {
  return useQuery({
    queryKey: ["inventory-analytics"],
    queryFn: async (): Promise<InventoryAnalyticsData> => {
      console.log("Fetching inventory analytics...");

      // Total items with non-zero quantity
      const { data: totalItemsData, error: totalError } = await supabase
        .from("parts")
        .select("id")
        .gt("current_quantity", 0);

      if (totalError) {
        console.error("Error fetching total items:", totalError);
        throw totalError;
      }

      // Low stock items
      const { data: lowStockData, error: lowStockError } = await supabase
        .from("parts")
        .select("id, current_quantity, minimum_quantity")
        .not("minimum_quantity", "is", null)
        .gt("minimum_quantity", 0);

      if (lowStockError) {
        console.error("Error fetching low stock items:", lowStockError);
        throw lowStockError;
      }

      const lowStockCount = lowStockData?.filter(
        item => item.current_quantity <= (item.minimum_quantity || 0)
      ).length || 0;


      // Recent additions (last 14 days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: recentAdditionsData, error: recentAdditionsError } = await supabase
        .from("parts_history")
        .select("id")
        .eq("change_type", "create")
        .gte("created_at", twoWeeksAgo.toISOString());

      if (recentAdditionsError) {
        console.error("Error fetching recent additions:", recentAdditionsError);
        throw recentAdditionsError;
      }

      // User activity data (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: historyData, error: historyError } = await supabase
        .from("parts_history")
        .select("changed_by, change_type, created_at")
        .gte("created_at", sevenDaysAgo.toISOString());

      if (historyError) {
        console.error("Error fetching history data:", historyError);
        throw historyError;
      }

      const { data: usageData, error: usageError } = await supabase
        .from("mission_inventory_usage")
        .select("used_by, created_at")
        .gte("created_at", sevenDaysAgo.toISOString());

      if (usageError) {
        console.error("Error fetching usage data:", usageError);
        throw usageError;
      }

      // Process daily user activity for last 7 days
      const dailyActivityMap: Record<string, { created: number; modified: number; used: number }> = {};
      const userActivityByPersonMap: Record<string, Record<string, { created: number; modified: number; used: number }>> = {};
      const allUsersSet = new Set<string>();

      // Initialize all 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toLocaleDateString();
        dailyActivityMap[dateKey] = { created: 0, modified: 0, used: 0 };
        userActivityByPersonMap[dateKey] = {};
      }

      historyData?.forEach(record => {
        const date = new Date(record.created_at).toLocaleDateString();
        // Display email for changed_by since it's more readable than UUID
        const user = record.changed_by || "Unknown";
        allUsersSet.add(user);
        
        if (dailyActivityMap[date]) {
          if (record.change_type === "create") {
            dailyActivityMap[date].created++;
          } else {
            dailyActivityMap[date].modified++;
          }
          
          // Track by person
          if (!userActivityByPersonMap[date][user]) {
            userActivityByPersonMap[date][user] = { created: 0, modified: 0, used: 0 };
          }
          if (record.change_type === "create") {
            userActivityByPersonMap[date][user].created++;
          } else {
            userActivityByPersonMap[date][user].modified++;
          }
        }
      });

      usageData?.forEach(record => {
        const date = new Date(record.created_at).toLocaleDateString();
        // Use used_by (UUID) for now - can be improved with user profiles later
        const user = record.used_by || "Unknown";
        allUsersSet.add(user);
        
        if (dailyActivityMap[date]) {
          dailyActivityMap[date].used++;
          
          // Track by person
          if (!userActivityByPersonMap[date][user]) {
            userActivityByPersonMap[date][user] = { created: 0, modified: 0, used: 0 };
          }
          userActivityByPersonMap[date][user].used++;
        }
      });

      const userActivity: UserActivityData[] = Object.entries(dailyActivityMap).map(
        ([date, activity]) => ({ date, ...activity })
      );

      const userActivityByPerson: UserActivityByPerson[] = [];
      Object.entries(userActivityByPersonMap).forEach(([date, users]) => {
        Object.entries(users).forEach(([user, activity]) => {
          userActivityByPerson.push({ date, user, ...activity });
        });
      });

      const allUsers = Array.from(allUsersSet).sort();

      // Additions trend (last 14 days)
      const { data: trendData, error: trendError } = await supabase
        .from("parts_history")
        .select("created_at, changed_by")
        .eq("change_type", "create")
        .gte("created_at", twoWeeksAgo.toISOString())
        .order("created_at", { ascending: true });

      if (trendError) {
        console.error("Error fetching trend data:", trendError);
        throw trendError;
      }

      // Process additions trend
      const trendMap: Record<string, Record<string, number>> = {};
      
      trendData?.forEach(record => {
        const date = new Date(record.created_at).toLocaleDateString();
        const user = record.changed_by || "Unknown";
        
        if (!trendMap[date]) {
          trendMap[date] = {};
        }
        trendMap[date][user] = (trendMap[date][user] || 0) + 1;
      });

      const additionsTrend: AdditionsTrendData[] = [];
      Object.entries(trendMap).forEach(([date, users]) => {
        Object.entries(users).forEach(([user, count]) => {
          additionsTrend.push({ date, user, count });
        });
      });

      console.log("Analytics data fetched successfully:", {
        totalItems: totalItemsData?.length || 0,
        lowStockCount,
        recentAdditions: recentAdditionsData?.length || 0,
        userActivityCount: userActivity.length,
        trendPointsCount: additionsTrend.length
      });

      return {
        totalItems: totalItemsData?.length || 0,
        lowStockItems: lowStockCount,
        recentAdditions: recentAdditionsData?.length || 0,
        userActivity,
        userActivityByPerson,
        allUsers,
        additionsTrend
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3
  });
}