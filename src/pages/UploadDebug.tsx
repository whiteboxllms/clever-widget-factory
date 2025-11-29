import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useImageUpload } from '@/hooks/useImageUpload';

export default function UploadDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const { uploadImages, isUploading } = useImageUpload();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    addLog(`Selected ${files.length} files`);
    
    try {
      const fileArray = Array.from(files);
      addLog(`Starting upload...`);
      
      const results = await uploadImages(fileArray, {
        bucket: 'mission-attachments' as const
      });
      
      const resultsArray = Array.isArray(results) ? results : [results];
      addLog(`✅ SUCCESS: Uploaded ${resultsArray.length} files`);
      
    } catch (error) {
      addLog(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Upload Debug Tool</h1>
      
      <div className="space-y-4">
        <div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="debugUpload"
            disabled={isUploading}
          />
          <Button
            onClick={() => document.getElementById('debugUpload')?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : 'Select Images'}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={clearLogs} variant="outline" className="flex-1">
            Clear Logs
          </Button>
          <Button 
            onClick={() => {
              const logText = logs.join('\n');
              navigator.clipboard.writeText(logText);
              addLog('📋 Logs copied to clipboard');
            }} 
            variant="outline"
            className="flex-1"
          >
            Copy Logs
          </Button>
        </div>

        <div className="border rounded p-4 bg-muted min-h-[400px] max-h-[600px] overflow-y-auto">
          <div className="text-xs font-mono space-y-1">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No logs yet. Select images to start.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Device Info:</strong></p>
          <p>User Agent: {navigator.userAgent}</p>
          <p>Connection: {(navigator as any).connection?.effectiveType || 'unknown'}</p>
          <p>Memory: {(performance as any).memory?.usedJSHeapSize ? 
            `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB` : 
            'unavailable'}</p>
        </div>
      </div>
    </div>
  );
}
