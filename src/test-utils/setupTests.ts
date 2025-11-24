import { expect, afterEach } from 'vitest';
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
  if (!(error instanceof Error)) return false;
  
  const errorMessage = error.message || String(error);
  const errorStack = error.stack || '';
  
  return (
    errorMessage.includes('Cannot read properties of undefined') &&
    (errorStack.includes('webidl-conversions') || 
     errorStack.includes('whatwg-url') ||
     errorStack.includes('jsdom'))
  );
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  if (isJsdomUrlError(reason)) {
    // Silently ignore known jsdom URL-related errors
    return;
  }
  // Let other unhandled rejections be handled by Vitest
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  if (isJsdomUrlError(error)) {
    // Silently ignore known jsdom URL-related errors
    return;
  }
  // Let other uncaught exceptions be handled by Vitest
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

