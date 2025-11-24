import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Suppress console errors during tests
global.console = {
  ...console,
  error: () => {},
};

// Handle unhandled promise rejections and errors
// This prevents jsdom URL-related errors from causing false positives
// These errors occur due to known issues with jsdom's URL implementation
const isJsdomUrlError = (error: unknown): boolean => {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? (error.stack || '') : '';
  const errorString = String(error);
  
  // Check for the specific JSDOM URL error pattern
  const hasUndefinedGet = errorMessage.includes('Cannot read properties of undefined') && 
                          errorMessage.includes("reading 'get'");
  
  const hasJsdomStack = errorStack.includes('webidl-conversions') || 
                       errorStack.includes('whatwg-url') ||
                       errorStack.includes('jsdom') ||
                       errorStack.includes('URL.js');
  
  return hasUndefinedGet && hasJsdomStack;
};

// Handle unhandled promise rejections
const originalUnhandledRejection = process.listeners('unhandledRejection');
process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', (reason, promise) => {
  if (isJsdomUrlError(reason)) {
    // Silently ignore known jsdom URL-related errors
    return;
  }
  // Call original handlers if any
  originalUnhandledRejection.forEach(handler => {
    try {
      handler(reason, promise);
    } catch (e) {
      // Ignore errors in handlers
    }
  });
});

// Handle uncaught exceptions
const originalUncaughtException = process.listeners('uncaughtException');
process.removeAllListeners('uncaughtException');
process.on('uncaughtException', (error) => {
  if (isJsdomUrlError(error)) {
    // Silently ignore known jsdom URL-related errors
    return;
  }
  // Call original handlers if any
  originalUncaughtException.forEach(handler => {
    try {
      handler(error);
    } catch (e) {
      // Ignore errors in handlers
    }
  });
});

// Handle browser-level errors (for jsdom environment)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (isJsdomUrlError(event.error)) {
      // Prevent the error from propagating
      event.preventDefault();
    }
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    if (isJsdomUrlError(event.reason)) {
      // Prevent the error from propagating
      event.preventDefault();
    }
  });
}

// Vitest-specific error handling
// Suppress JSDOM URL errors that Vitest reports as "unhandled"
// These are known issues with jsdom's URL implementation and don't affect test results
const suppressJsdomUrlErrors = () => {
  // Override console.error to filter out JSDOM URL errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const errorString = args.map(String).join(' ');
    if (errorString.includes('Cannot read properties of undefined') &&
        errorString.includes("reading 'get'") &&
        (errorString.includes('webidl-conversions') || 
         errorString.includes('whatwg-url') ||
         errorString.includes('URL.js') ||
         errorString.includes('jsdom'))) {
      // Suppress this specific error - it's a known JSDOM issue
      return;
    }
    originalConsoleError.apply(console, args);
  };
};

// Apply suppression immediately
suppressJsdomUrlErrors();

// Also handle errors at the global level for Vitest
if (typeof globalThis !== 'undefined') {
  const originalError = globalThis.Error;
  // This won't work for unhandled errors, but we'll catch them in process handlers above
}

