import React from "react";
import { 
  AlertTriangle, 
  Clock, 
  X, 
  Wrench, 
  Package, 
  Building, 
  FileText 
} from "lucide-react";
import { ContextType } from "@/types/issues";

// Map of icon components for JSX rendering
const iconComponents = {
  AlertTriangle,
  Clock,
  X,
  Wrench,
  Package,
  Building,
  FileText
};

export const getIssueTypeIconName = (issueType: string, contextType: ContextType) => {
  if (contextType === 'order') {
    switch (issueType) {
      case 'wrong_item':
      case 'wrong_brand_spec':
        return 'X';
      case 'short_shipment':
      case 'over_shipped':
        return 'AlertTriangle';
      case 'damaged_goods':
        return 'AlertTriangle';
      default:
        return 'Clock';
    }
  }

  // Tool issue types
  switch (issueType) {
    case 'safety':
      return 'AlertTriangle';
    case 'efficiency':
      return 'AlertTriangle';
    case 'cosmetic':
      return 'Clock';
    case 'maintenance':
      return 'Clock';
    default:
      return 'Clock';
  }
};

export const getIssueTypeIconClass = (issueType: string, contextType: ContextType) => {
  if (contextType === 'order') {
    switch (issueType) {
      case 'wrong_item':
      case 'wrong_brand_spec':
        return 'h-4 w-4 text-red-500';
      case 'short_shipment':
      case 'over_shipped':
        return 'h-4 w-4 text-orange-500';
      case 'damaged_goods':
        return 'h-4 w-4 text-red-500';
      default:
        return 'h-4 w-4 text-blue-500';
    }
  }

  // Tool issue types
  switch (issueType) {
    case 'safety':
      return 'h-4 w-4 text-destructive';
    case 'efficiency':
      return 'h-4 w-4 text-orange-500';
    case 'cosmetic':
      return 'h-4 w-4 text-blue-500';
    case 'maintenance':
      return 'h-4 w-4 text-purple-500';
    default:
      return 'h-4 w-4 text-muted-foreground';
  }
};

export const getIssueTypeColor = (issueType: string, contextType: ContextType) => {
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

export const getContextTypeIconName = (contextType: ContextType) => {
  switch (contextType) {
    case 'tool':
      return 'Wrench';
    case 'order':
      return 'Package';
    case 'inventory':
      return 'Building';
    case 'facility':
      return 'FileText';
    default:
      return 'FileText';
  }
};

// Helper functions to return JSX elements
export const getIssueTypeIcon = (issueType: string, contextType: ContextType) => {
  const iconName = getIssueTypeIconName(issueType, contextType);
  const iconClass = getIssueTypeIconClass(issueType, contextType);
  const IconComponent = iconComponents[iconName as keyof typeof iconComponents];
  
  return React.createElement(IconComponent, { className: iconClass });
};

export const getContextTypeIcon = (contextType: ContextType) => {
  const iconName = getContextTypeIconName(contextType);
  const IconComponent = iconComponents[iconName as keyof typeof iconComponents];
  
  return React.createElement(IconComponent, { className: "h-3 w-3" });
};