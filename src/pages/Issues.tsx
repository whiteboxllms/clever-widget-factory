import { useState, useEffect } from "react";
import { Plus, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GenericIssueCard } from "@/components/GenericIssueCard";
import { useGenericIssues } from "@/hooks/useGenericIssues";
import { ContextType, BaseIssue, getContextLabel } from "@/types/issues";

export function Issues() {
  const [contextFilter, setContextFilter] = useState<ContextType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'removed' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { 
    issues, 
    isLoading, 
    fetchIssues 
  } = useGenericIssues({
    contextType: contextFilter === 'all' ? undefined : contextFilter,
    status: statusFilter === 'all' ? undefined : statusFilter
  });

  // Filter issues by search query
  const filteredIssues = issues.filter(issue => 
    issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.issue_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group issues by context type
  const groupedIssues = filteredIssues.reduce((acc, issue) => {
    const key = issue.context_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {} as Record<string, BaseIssue[]>);

  const handleIssueResolve = (issue: BaseIssue) => {
    // TODO: Implement issue resolution dialog
    console.log('Resolve issue:', issue);
  };

  const handleIssueEdit = (issue: BaseIssue) => {
    // TODO: Implement issue edit dialog
    console.log('Edit issue:', issue);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading issues...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
          <p className="text-muted-foreground">
            Manage issues across tools, orders, inventory, and facilities
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={contextFilter} onValueChange={(value: any) => setContextFilter(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tool">Tools</SelectItem>
                  <SelectItem value="order">Orders</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="facility">Facility</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{filteredIssues.length}</div>
            <p className="text-xs text-muted-foreground">Total Issues</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {filteredIssues.filter(i => i.issue_type === 'safety').length}
            </div>
            <p className="text-xs text-muted-foreground">Safety Issues</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {filteredIssues.filter(i => i.context_type === 'order').length}
            </div>
            <p className="text-xs text-muted-foreground">Order Issues</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {filteredIssues.filter(i => i.context_type === 'tool').length}
            </div>
            <p className="text-xs text-muted-foreground">Tool Issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              No issues found. {searchQuery ? 'Try adjusting your search.' : 'All clear!'}
            </div>
          </CardContent>
        </Card>
      ) : contextFilter === 'all' ? (
        // Grouped view when showing all contexts
        <div className="space-y-6">
          {Object.entries(groupedIssues).map(([contextType, contextIssues]) => (
            <Card key={contextType}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getContextLabel(contextType as ContextType)}
                  <Badge variant="secondary">{contextIssues.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contextIssues.map((issue) => (
                  <GenericIssueCard
                    key={issue.id}
                    issue={issue}
                    onResolve={handleIssueResolve}
                    onEdit={handleIssueEdit}
                    onRefresh={fetchIssues}
                    showContext={false}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Simple list view when filtering by specific context
        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <GenericIssueCard
              key={issue.id}
              issue={issue}
              onResolve={handleIssueResolve}
              onEdit={handleIssueEdit}
              onRefresh={fetchIssues}
              showContext={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}