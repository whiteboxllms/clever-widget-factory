import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global error handlers for debugging upload issues
window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED_PROMISE_REJECTION]:', {
    reason: event.reason,
    promise: event.promise,
    message: event.reason?.message,
    stack: event.reason?.stack,
    timestamp: new Date().toISOString(),
    memory: (performance as any).memory?.usedJSHeapSize
  });
});

window.addEventListener('error', (event) => {
  console.error('[GLOBAL_ERROR]:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    timestamp: new Date().toISOString(),
    memory: (performance as any).memory?.usedJSHeapSize
  });
});

// Hide initial loading state when React mounts
const rootElement = document.getElementById("root")!;
const loadingElement = document.getElementById("initial-loading");
if (loadingElement) {
  // Hide immediately when React starts rendering
  loadingElement.style.display = 'none';
}

createRoot(rootElement).render(<App />);
