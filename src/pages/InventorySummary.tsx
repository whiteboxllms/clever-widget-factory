import { ArrowLeft, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventoryAnalytics } from "@/hooks/useInventoryAnalytics";
import { InventoryMetricCard } from "@/components/InventoryMetricCard";
import { CategoryDistributionChart } from "@/components/CategoryDistributionChart";
import { UserActivityChart } from "@/components/UserActivityChart";
import { AdditionsLineChart } from "@/components/AdditionsLineChart";
import { Skeleton } from "@/components/ui/skeleton";

export default function InventorySummary() {
  const { data, isLoading, error } = useInventoryAnalytics();

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/inventory">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inventory
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Inventory Summary</h1>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-destructive">Failed to load analytics data. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/inventory">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
          </Link>
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Inventory Summary</h1>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isLoading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <InventoryMetricCard
                title="Total Items"
                value={data?.totalItems || 0}
                description="Non-zero inventory"
                variant="default"
              />
              <InventoryMetricCard
                title="Low Stock Items"
                value={data?.lowStockItems || 0}
                description="Need restocking"
                variant="warning"
              />
              <InventoryMetricCard
                title="Categories"
                value={data?.categoryDistribution?.length || 0}
                description="Item categories"
                variant="info"
              />
              <InventoryMetricCard
                title="Recent Additions"
                value={data?.recentAdditions || 0}
                description="Last 14 days"
                variant="success"
              />
            </>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Items by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <CategoryDistributionChart data={data?.categoryDistribution || []} />
              )}
            </CardContent>
          </Card>

          {/* User Activity */}
          <Card>
            <CardHeader>
              <CardTitle>User Activity Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <UserActivityChart data={data?.userActivity || []} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additions Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Additions Trend (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : (
              <AdditionsLineChart data={data?.additionsTrend || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}