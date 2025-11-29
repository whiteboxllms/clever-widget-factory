import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useImageUpload } from '@/hooks/useImageUpload';
import { compressImageSimple } from '@/lib/simpleImageCompression';

/**
 * Mobile Upload Test Page
 * 
 * This page simulates mobile conditions to test file upload behavior:
 * - Simulates mobile user agent
 * - Tests large file compression
 * - Monitors memory usage
 * - Tests timeout scenarios
 * 
 * Usage:
 * 1. Open this page in your browser
 * 2. Use Chrome DevTools to simulate mobile device (F12 > Toggle device toolbar)
 * 3. Or manually set user agent to mobile
 * 4. Upload test images of various sizes
 */
export default function UploadMobileTest() {
  const { uploadImages, isUploading } = useImageUpload();
  const [results, setResults] = useState<any[]>([]);
  const [isSimulatingMobile, setIsSimulatingMobile] = useState(false);

  // Simulate mobile conditions
  const simulateMobile = () => {
    // Override navigator properties for testing
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    });
    
    // Simulate limited memory (if available)
    if ((performance as any).memory) {
      const originalMemory = (performance as any).memory;
      Object.defineProperty(performance, 'memory', {
        writable: true,
        value: {
          ...originalMemory,
          jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB limit (typical mobile)
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB used
        }
      });
    }
    
    // Simulate slow connection
    if ((navigator as any).connection) {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '3g',
          downlink: 1.5, // Slow 3G
          rtt: 300
        }
      });
    }
    
    setIsSimulatingMobile(true);
    addResult('success', 'Mobile simulation enabled', {
      userAgent: navigator.userAgent,
      memory: (performance as any).memory,
      connection: (navigator as any).connection
    });
  };

  const addResult = (type: 'success' | 'error' | 'warning' | 'info', message: string, data?: any) => {
    setResults(prev => [{
      id: Date.now(),
      type,
      message,
      timestamp: new Date().toISOString(),
      data
    }, ...prev]);
  };

  const createTestImage = (sizeMB: number): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 4000; // Large dimensions
      canvas.height = 3000;
      const ctx = canvas.getContext('2d')!;
      
      // Create a complex image with gradients to increase file size
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 100; i++) {
        gradient.addColorStop(i / 100, `hsl(${i * 3.6}, 100%, 50%)`);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add noise to increase file size
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (Math.random() > 0.5) {
          imageData.data[i] = Math.random() * 255; // R
          imageData.data[i + 1] = Math.random() * 255; // G
          imageData.data[i + 2] = Math.random() * 255; // B
        }
      }
      ctx.putImageData(imageData, 0, 0);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(new File([''], 'test.jpg', { type: 'image/jpeg' }));
          return;
        }
        
        // If blob is smaller than target, create a larger one
        if (blob.size < sizeMB * 1024 * 1024) {
          // Create multiple copies in a single file
          const chunks: Blob[] = [];
          const targetSize = sizeMB * 1024 * 1024;
          while (chunks.reduce((sum, c) => sum + c.size, 0) < targetSize) {
            chunks.push(blob);
          }
          const largeBlob = new Blob(chunks, { type: 'image/jpeg' });
          resolve(new File([largeBlob], `test-${sizeMB}MB.jpg`, { type: 'image/jpeg' }));
        } else {
          resolve(new File([blob], `test-${sizeMB}MB.jpg`, { type: 'image/jpeg' }));
        }
      }, 'image/jpeg', 1.0); // Maximum quality
    });
  };

  const testCompression = async (sizeMB: number) => {
    try {
      addResult('info', `Creating test image: ${sizeMB}MB...`);
      const testFile = await createTestImage(sizeMB);
      addResult('info', `Test image created: ${(testFile.size / (1024 * 1024)).toFixed(2)}MB`);
      
      const startTime = performance.now();
      const initialMemory = (performance as any).memory?.usedJSHeapSize;
      
      addResult('info', 'Starting compression test...', {
        fileSize: testFile.size,
        initialMemory: initialMemory ? `${(initialMemory / (1024 * 1024)).toFixed(2)}MB` : 'N/A'
      });
      
      const result = await compressImageSimple(testFile, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920
      });
      
      const elapsed = performance.now() - startTime;
      const finalMemory = (performance as any).memory?.usedJSHeapSize;
      const memoryUsed = initialMemory && finalMemory 
        ? (finalMemory - initialMemory) / (1024 * 1024)
        : null;
      
      if (result.warnings && result.warnings.length > 0) {
        addResult('warning', 'Compression completed with warnings', {
          warnings: result.warnings,
          elapsed: `${(elapsed / 1000).toFixed(2)}s`,
          memoryUsed: memoryUsed ? `${memoryUsed.toFixed(2)}MB` : 'N/A',
          compressionRatio: `${result.compressionRatio.toFixed(1)}%`
        });
      } else {
        addResult('success', 'Compression completed successfully', {
          originalSize: `${(result.originalSize / (1024 * 1024)).toFixed(2)}MB`,
          compressedSize: `${(result.compressedSize / (1024 * 1024)).toFixed(2)}MB`,
          compressionRatio: `${result.compressionRatio.toFixed(1)}%`,
          elapsed: `${(elapsed / 1000).toFixed(2)}s`,
          memoryUsed: memoryUsed ? `${memoryUsed.toFixed(2)}MB` : 'N/A'
        });
      }
    } catch (error) {
      addResult('error', 'Compression test failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      addResult('info', `Testing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      
      try {
        const startTime = performance.now();
        const initialMemory = (performance as any).memory?.usedJSHeapSize;
        
        const result = await compressImageSimple(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920
        });
        
        const elapsed = performance.now() - startTime;
        const finalMemory = (performance as any).memory?.usedJSHeapSize;
        const memoryUsed = initialMemory && finalMemory 
          ? (finalMemory - initialMemory) / (1024 * 1024)
          : null;
        
        if (result.warnings && result.warnings.length > 0) {
          addResult('warning', `File compressed with warnings: ${file.name}`, {
            warnings: result.warnings.map(w => w.message),
            elapsed: `${(elapsed / 1000).toFixed(2)}s`,
            memoryUsed: memoryUsed ? `${memoryUsed.toFixed(2)}MB` : 'N/A'
          });
        } else {
          addResult('success', `File compressed successfully: ${file.name}`, {
            originalSize: `${(result.originalSize / (1024 * 1024)).toFixed(2)}MB`,
            compressedSize: `${(result.compressedSize / (1024 * 1024)).toFixed(2)}MB`,
            compressionRatio: `${result.compressionRatio.toFixed(1)}%`,
            elapsed: `${(elapsed / 1000).toFixed(2)}s`
          });
        }
      } catch (error) {
        addResult('error', `Compression failed for ${file.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Mobile Upload Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This page helps test file upload behavior under mobile conditions.
              Use Chrome DevTools device emulation for best results.
            </p>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={simulateMobile} disabled={isSimulatingMobile}>
                {isSimulatingMobile ? 'Mobile Mode Active' : 'Simulate Mobile'}
              </Button>
              
              <Button 
                onClick={() => testCompression(2)} 
                variant="outline"
                disabled={isUploading}
              >
                Test 2MB Image
              </Button>
              
              <Button 
                onClick={() => testCompression(5)} 
                variant="outline"
                disabled={isUploading}
              >
                Test 5MB Image
              </Button>
              
              <Button 
                onClick={() => testCompression(10)} 
                variant="outline"
                disabled={isUploading}
              >
                Test 10MB Image
              </Button>
              
              <Button onClick={clearResults} variant="ghost">
                Clear Results
              </Button>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Or upload your own test images:
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Test Results</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No test results yet.</p>
              ) : (
                results.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 rounded border ${
                      result.type === 'error' ? 'border-red-500 bg-red-50' :
                      result.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                      result.type === 'success' ? 'border-green-500 bg-green-50' :
                      'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{result.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </p>
                        {result.data && (
                          <pre className="text-xs mt-2 bg-white/50 p-2 rounded overflow-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-muted rounded">
            <h4 className="font-semibold mb-2">Current Environment:</h4>
            <div className="text-sm space-y-1">
              <p><strong>User Agent:</strong> {navigator.userAgent}</p>
              <p><strong>Memory:</strong> {
                (performance as any).memory 
                  ? `${((performance as any).memory.usedJSHeapSize / (1024 * 1024)).toFixed(2)}MB / ${((performance as any).memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)}MB`
                  : 'Not available'
              }</p>
              <p><strong>Connection:</strong> {
                (navigator as any).connection?.effectiveType || 'Not available'
              }</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

