# Mobile Upload Test Guide

## Overview

This guide explains how to detect if files are too large for the compression algorithm and how to use the mobile simulation test to reproduce upload issues.

## How to Detect Files Too Large for Compression

### 1. **Compression Warnings**

The compression algorithm now detects and reports several warning conditions:

- **`large_file`**: File is > 3MB, compression may be slow on mobile
- **`slow_compression`**: Compression taking > 5 seconds, indicates potential issues
- **`low_memory`**: Available memory is insufficient for compression
- **`timeout_risk`**: Compression timed out (10s for normal, 20s for large files)

### 2. **Console Logs**

Check the browser console for these log messages:

```
[COMPRESSION] Complete: {
  originalSizeMB: "5.60",
  compressedSizeMB: "0.48",
  compressionRatio: "91.4%",
  elapsed: "8.45s",
  memoryUsedMB: "45.23",
  warnings: ["Large file detected (5.60MB). Compression may be slow on mobile devices."]
}
```

### 3. **Warning Indicators**

Look for these signs that a file is too large:

- **Low compression ratio** (< 10%) on files > 2MB
- **Long compression time** (> 5 seconds)
- **Memory warnings** in console
- **Timeout errors** (compression takes > 10-20 seconds)

### 4. **File Size Limits**

- **Maximum file size**: 10MB (rejected before compression)
- **Target compressed size**: 0.5MB (500KB)
- **Compression timeout**: 
  - Normal files: 10 seconds
  - Large files (> 3MB): 20 seconds
- **Quality reduction**: Starts at 0.8, decreases to 0.1 minimum

## Mobile Simulation Test

### Access the Test Page

Navigate to: `/debug/upload-mobile-test`

### Features

1. **Mobile Simulation Button**
   - Simulates mobile user agent
   - Limits available memory to 100MB (typical mobile)
   - Simulates slow 3G connection

2. **Test Image Generation**
   - Creates test images of various sizes (2MB, 5MB, 10MB)
   - Images are designed to be difficult to compress
   - Useful for testing compression limits

3. **File Upload**
   - Upload your own test images
   - See compression results and warnings
   - Monitor memory usage and timing

### How to Use

#### Method 1: Chrome DevTools Device Emulation

1. Open Chrome DevTools (F12)
2. Click the device toolbar icon (Ctrl+Shift+M)
3. Select a mobile device (e.g., iPhone 12 Pro)
4. Navigate to `/debug/upload-mobile-test`
5. Use the test buttons or upload files

#### Method 2: Manual Mobile Simulation

1. Navigate to `/debug/upload-mobile-test`
2. Click "Simulate Mobile" button
3. This overrides navigator properties to simulate mobile
4. Use test buttons or upload files

#### Method 3: Real Mobile Device

1. Access the app from your phone (e.g., `http://192.168.0.161:port`)
2. Navigate to `/debug/upload-mobile-test`
3. Upload test images directly from your phone

### What to Look For

#### Successful Compression
```
✅ File compressed successfully: test.jpg
{
  "originalSize": "5.60MB",
  "compressedSize": "0.48MB",
  "compressionRatio": "91.4%",
  "elapsed": "3.2s"
}
```

#### Compression with Warnings
```
⚠️ File compressed with warnings: large-image.jpg
{
  "warnings": [
    "Large file detected (5.60MB). Compression may be slow on mobile devices.",
    "Compression is taking longer than expected (6.5s). This may indicate the file is too large."
  ],
  "elapsed": "8.2s",
  "memoryUsed": "45.23MB"
}
```

#### Compression Failure
```
❌ Compression failed for huge-image.jpg
{
  "error": "Compression timed out after 20.0s. File is likely too large for mobile compression."
}
```

## Interpreting Results

### Good Compression
- Compression ratio > 50%
- Elapsed time < 3 seconds
- No warnings
- Memory usage < 20MB

### Acceptable Compression
- Compression ratio 20-50%
- Elapsed time 3-5 seconds
- Minor warnings (large_file only)
- Memory usage 20-50MB

### Problematic Compression
- Compression ratio < 20%
- Elapsed time > 5 seconds
- Multiple warnings
- Memory usage > 50MB
- **Action**: Consider rejecting files > 5MB or implementing chunked compression

### Failed Compression
- Timeout error
- Memory errors
- Canvas errors
- **Action**: File is too large, reject or use server-side compression

## Recommendations

### For Users
- **Recommended max file size**: 5MB
- **Optimal file size**: < 2MB
- **If upload fails**: Try compressing the image on your device first

### For Developers
- Monitor compression warnings in production
- Consider implementing:
  - Progressive compression (compress in chunks)
  - Server-side compression fallback
  - File size limits based on device capabilities
  - Better error messages for users

## Debugging Tips

1. **Check console logs** for detailed compression information
2. **Monitor memory usage** - if it spikes, file is too large
3. **Watch for timeouts** - indicates compression is struggling
4. **Test with real mobile devices** - emulation isn't perfect
5. **Use the test page** to reproduce issues before they happen in production

## Related Files

- `src/lib/simpleImageCompression.ts` - Compression algorithm
- `src/hooks/useImageUpload.tsx` - Upload hook with compression
- `src/pages/UploadMobileTest.tsx` - Test page
- `src/components/UnifiedActionDialog.tsx` - Main upload dialog

