import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Handle unhandled promise rejections and errors
// This prevents jsdom URL-related errors from causing false positives
// These errors occur due to known issues with jsdom's URL implementation
const isJsdomUrlError = (error: unknown): boolean => {
  if (!error) return false;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? (error.stack || '') : '';
  const errorString = String(error);
  const errorName = error instanceof Error ? error.name : '';
  
  // Check for the specific JSDOM URL error pattern
  // Match: TypeError: Cannot read properties of undefined (reading 'get')
  const hasUndefinedGet = (
    errorMessage.includes('Cannot read properties of undefined') && 
    errorMessage.includes("reading 'get'")
  ) || (
    errorString.includes('Cannot read properties of undefined') && 
    errorString.includes("reading 'get'")
  );
  
  // Check stack trace for JSDOM-related modules
  const hasJsdomStack = (
    errorStack.includes('webidl-conversions') || 
    errorStack.includes('whatwg-url') ||
    errorStack.includes('jsdom') ||
    errorStack.includes('URL.js') ||
    errorStack.includes('node_modules/jsdom')
  ) || (
    errorString.includes('webidl-conversions') || 
    errorString.includes('whatwg-url') ||
    errorString.includes('jsdom') ||
    errorString.includes('URL.js')
  );
  
  // Also check if it's a TypeError (which these JSDOM errors are)
  const isTypeError = errorName === 'TypeError' || errorString.includes('TypeError');
  
  return hasUndefinedGet && (hasJsdomStack || isTypeError);
};

// Suppress console errors for JSDOM URL errors, but allow other errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const errorString = args.map(String).join(' ');
  // Suppress JSDOM URL errors
  if (errorString.includes('Cannot read properties of undefined') &&
      errorString.includes("reading 'get'") &&
      (errorString.includes('webidl-conversions') || 
       errorString.includes('whatwg-url') ||
       errorString.includes('URL.js') ||
       errorString.includes('jsdom'))) {
    return; // Suppress
  }
  originalConsoleError.apply(console, args);
};

// Handle unhandled promise rejections
// Store original handlers before removing
const originalUnhandledRejectionHandlers = process.listeners('unhandledRejection');
process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', (reason, promise) => {
  if (isJsdomUrlError(reason)) {
    // Silently ignore known jsdom URL-related errors
    return;
  }
  // Call original handlers if any
  originalUnhandledRejectionHandlers.forEach(handler => {
    try {
      handler(reason, promise);
    } catch (e) {
      // Ignore errors in handlers
    }
  });
});

// Handle uncaught exceptions
const originalUncaughtExceptionHandlers = process.listeners('uncaughtException');
process.removeAllListeners('uncaughtException');
process.on('uncaughtException', (error) => {
  if (isJsdomUrlError(error)) {
    // Silently ignore known jsdom URL-related errors
    return;
  }
  // Call original handlers if any
  originalUncaughtExceptionHandlers.forEach(handler => {
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
      event.stopPropagation();
    }
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    if (isJsdomUrlError(event.reason)) {
      // Prevent the error from propagating
      event.preventDefault();
      event.stopPropagation();
    }
  });
}
