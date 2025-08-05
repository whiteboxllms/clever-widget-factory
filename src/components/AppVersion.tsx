import { APP_VERSION, BUILD_DATE } from "@/lib/version";

export function AppVersion() {
  return (
    <div className="fixed bottom-2 right-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded border">
      v{APP_VERSION} ({BUILD_DATE})
    </div>
  );
}