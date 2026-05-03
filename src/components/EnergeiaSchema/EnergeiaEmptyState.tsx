import { Sparkles } from 'lucide-react';

export function EnergeiaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Sparkles className="h-12 w-12 text-muted-foreground opacity-50" />
      <h3 className="text-lg font-semibold">No data yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Click Refresh to compute the Energeia Schema for your organization.
      </p>
    </div>
  );
}

export default EnergeiaEmptyState;
