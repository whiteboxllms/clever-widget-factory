import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CategoryData {
  category: string;
  count: number;
}

interface UserActivityData {
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
  categoryDistribution: CategoryData[];
  userActivity: UserActivityData[];
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

      // Category distribution
      const { data: categoryData, error: categoryError } = await supabase
        .from("parts")
        .select("category")
        .gt("current_quantity", 0);

      if (categoryError) {
        console.error("Error fetching category data:", categoryError);
        throw categoryError;
      }

      const categoryDistribution = categoryData?.reduce((acc: Record<string, number>, item) => {
        const category = item.category || "Uncategorized";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const categoryArray: CategoryData[] = Object.entries(categoryDistribution || {}).map(
        ([category, count]) => ({ category, count })
      );

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

      // User activity data
      const { data: historyData, error: historyError } = await supabase
        .from("parts_history")
        .select("changed_by, change_type");

      if (historyError) {
        console.error("Error fetching history data:", historyError);
        throw historyError;
      }

      const { data: usageData, error: usageError } = await supabase
        .from("mission_inventory_usage")
        .select("used_by");

      if (usageError) {
        console.error("Error fetching usage data:", usageError);
        throw usageError;
      }

      // Process user activity
      const userActivityMap: Record<string, { created: number; modified: number; used: number }> = {};

      historyData?.forEach(record => {
        const user = record.changed_by || "Unknown";
        if (!userActivityMap[user]) {
          userActivityMap[user] = { created: 0, modified: 0, used: 0 };
        }
        if (record.change_type === "create") {
          userActivityMap[user].created++;
        } else {
          userActivityMap[user].modified++;
        }
      });

      usageData?.forEach(record => {
        // Get user name from profiles if available, otherwise use ID
        const userId = record.used_by;
        const user = `User-${userId?.slice(0, 8)}` || "Unknown";
        if (!userActivityMap[user]) {
          userActivityMap[user] = { created: 0, modified: 0, used: 0 };
        }
        userActivityMap[user].used++;
      });

      const userActivity: UserActivityData[] = Object.entries(userActivityMap).map(
        ([user, activity]) => ({ user, ...activity })
      );

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
        categoryCount: categoryArray.length,
        userActivityCount: userActivity.length,
        trendPointsCount: additionsTrend.length
      });

      return {
        totalItems: totalItemsData?.length || 0,
        lowStockItems: lowStockCount,
        recentAdditions: recentAdditionsData?.length || 0,
        categoryDistribution: categoryArray,
        userActivity,
        additionsTrend
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3
  });
}