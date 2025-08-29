import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, X, Clock, Edit, Plus, Target, Zap, Package, Wrench, Home, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BaseIssue, ContextType, getContextBadgeColor, getContextIcon, getContextLabel, OrderIssue, getOrderIssueTypeLabel } from "@/types/issues";
import { useGenericIssues } from "@/hooks/useGenericIssues";

interface GenericIssueCardProps {
  issue: BaseIssue;
  onResolve?: (issue: BaseIssue) => void;
  onEdit?: (issue: BaseIssue) => void;
  onRefresh: () => void;
  showContext?: boolean;
}

export function GenericIssueCard({ 
  issue, 
  onResolve, 
  onEdit, 
  onRefresh,
  showContext = true 
}: GenericIssueCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [contextEntity, setContextEntity] = useState<any>(null);
  const { removeIssue } = useGenericIssues();

  // Fetch context entity information
  useEffect(() => {
    const fetchContextEntity = async () => {
      try {
        let entity = null;
        
        switch (issue.context_type) {
          case 'tool':
            const { data: toolData } = await supabase
              .from('tools')
              .select('name, serial_number')
              .eq('id', issue.context_id)
              .single();
            entity = toolData;
            break;
            
          case 'order':
            const { data: orderData } = await supabase
              .from('parts_orders')
              .select(`
                id, 
                quantity_ordered, 
                supplier_name,
                parts!inner(name, unit)
              `)
              .eq('id', issue.context_id)
              .single();
            entity = orderData;
            break;
            
          default:
            entity = { name: `${issue.context_type} ${issue.context_id}` };
        }
        
        setContextEntity(entity);
      } catch (error) {
        console.error('Error fetching context entity:', error);
      }
    };

    if (showContext) {
      fetchContextEntity();
    }
  }, [issue.context_id, issue.context_type, showContext]);

  const getIssueTypeIcon = (issueType: string, contextType: ContextType) => {
    if (contextType === 'order') {
      switch (issueType) {
        case 'wrong_item':
        case 'wrong_brand_spec':
          return <X className="h-4 w-4 text-red-500" />;
        case 'short_shipment':
        case 'over_shipped':
          return <AlertTriangle className="h-4 w-4 text-orange-500" />;
        case 'damaged_goods':
          return <AlertTriangle className="h-4 w-4 text-red-500" />;
        default:
          return <Clock className="h-4 w-4 text-blue-500" />;
      }
    }

    // Tool issue types
    switch (issueType) {
      case 'safety':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'efficiency':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'cosmetic':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'maintenance':
        return <Clock className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getIssueTypeColor = (issueType: string, contextType: ContextType) => {
    if (contextType === 'order') {
      switch (issueType) {
        case 'wrong_item':
        case 'wrong_brand_spec':
        case 'damaged_goods':
          return 'destructive';
        case 'short_shipment':
        case 'over_shipped':
          return 'default';
        default:
          return 'secondary';
      }
    }

    // Tool issue types
    switch (issueType) {
      case 'safety':
        return 'destructive';
      case 'efficiency':
        return 'default';
      case 'cosmetic':
        return 'secondary';
      case 'maintenance':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getContextTypeIcon = (contextType: ContextType) => {
    switch (contextType) {
      case 'tool':
        return <Wrench className="h-3 w-3" />;
      case 'order':
        return <Package className="h-3 w-3" />;
      case 'inventory':
        return <FileText className="h-3 w-3" />;
      case 'facility':
        return <Home className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    
    try {
      await removeIssue(issue.id);
      onRefresh();
    } catch (error) {
      console.error('Error removing issue:', error);
      toast({
        title: "Error removing issue",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const renderContextualInfo = () => {
    if (!showContext || !contextEntity) return null;

    switch (issue.context_type) {
      case 'tool':
        return (
          <p className="text-xs text-muted-foreground">
            Tool: {contextEntity.name} {contextEntity.serial_number && `(${contextEntity.serial_number})`}
          </p>
        );
        
      case 'order':
        const orderIssue = issue as OrderIssue;
        return (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Order: {contextEntity.parts?.name} - {contextEntity.quantity_ordered} {contextEntity.parts?.unit}</p>
            {contextEntity.supplier_name && (
              <p>Supplier: {contextEntity.supplier_name}</p>
            )}
            {orderIssue.issue_metadata?.expected_quantity && orderIssue.issue_metadata?.actual_quantity_received !== undefined && (
              <p className="text-orange-600">
                Expected: {orderIssue.issue_metadata.expected_quantity}, 
                Received: {orderIssue.issue_metadata.actual_quantity_received}
              </p>
            )}
          </div>
        );
        
      default:
        return (
          <p className="text-xs text-muted-foreground">
            {getContextLabel(issue.context_type)}: {issue.context_id}
          </p>
        );
    }
  };

  const getDisplayIssueType = () => {
    if (issue.context_type === 'order') {
      return getOrderIssueTypeLabel(issue.issue_type);
    }
    return issue.issue_type;
  };

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {showContext && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getContextBadgeColor(issue.context_type)}`}
                >
                  {getContextTypeIcon(issue.context_type)}
                  <span className="ml-1">{getContextLabel(issue.context_type)}</span>
                </Badge>
              )}
              
              {getIssueTypeIcon(issue.issue_type, issue.context_type)}
              <Badge variant={getIssueTypeColor(issue.issue_type, issue.context_type) as any} className="text-xs">
                {getDisplayIssueType()}
              </Badge>
              
              <span className="text-xs text-muted-foreground">
                {new Date(issue.reported_at).toLocaleDateString()}
              </span>
            </div>
            
            {renderContextualInfo()}
            
            <p className="text-sm break-words mt-1">{issue.description}</p>
            
            {issue.damage_assessment && (
              <p className="text-sm text-orange-600 mt-1">
                <strong>Damage:</strong> {issue.damage_assessment}
              </p>
            )}
            
            {issue.resolution_photo_urls && issue.resolution_photo_urls.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Resolution Photos:</p>
                <div className="flex gap-1 flex-wrap">
                  {issue.resolution_photo_urls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Resolution photo ${index + 1}`}
                      className="h-12 w-12 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(issue)}
                className="h-7 px-2 text-xs"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            
            {onResolve && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolve(issue)}
                className="h-7 px-2 text-xs"
                title="Detailed Resolve"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Resolve
              </Button>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={isRemoving}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              title="Remove issue"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}