import { Tool } from "@/hooks/tools/useToolsData";
import { ToolCard } from "./ToolCard";

interface ToolGridProps {
  tools: Tool[];
  activeCheckouts: {[key: string]: {user_name: string, user_id: string}};
  toolsWithIssues: Set<string>;
  canEditTools: boolean;
  isLeadership: boolean;
  currentUserId?: string;
  onToolClick: (tool: Tool) => void;
  onCheckoutClick: (tool: Tool) => void;
  onEditClick: (tool: Tool) => void;
  onRemoveClick: (tool: Tool) => void;
}

export const ToolGrid = ({
  tools,
  activeCheckouts,
  toolsWithIssues,
  canEditTools,
  isLeadership,
  currentUserId,
  onToolClick,
  onCheckoutClick,
  onEditClick,
  onRemoveClick
}: ToolGridProps) => {
  if (tools.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tools found matching your criteria.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tools.map((tool) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          activeCheckout={activeCheckouts[tool.id]}
          hasIssues={toolsWithIssues.has(tool.id) || (tool.known_issues && tool.known_issues.trim().length > 0)}
          canEditTools={canEditTools}
          isLeadership={isLeadership}
          currentUserId={currentUserId}
          onToolClick={onToolClick}
          onCheckoutClick={onCheckoutClick}
          onEditClick={onEditClick}
          onRemoveClick={onRemoveClick}
        />
      ))}
    </div>
  );
};