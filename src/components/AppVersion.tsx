import { APP_VERSION, BUILD_DATE } from "@/lib/version";

export function AppVersion() {
  return (
    <div className="fixed bottom-2 left-2 md:bottom-2 md:right-2 md:left-auto text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-2 py-1 rounded border shadow-sm z-50">
      v{APP_VERSION} ({BUILD_DATE})
    </div>
  );
}