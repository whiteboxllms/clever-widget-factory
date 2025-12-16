/**
 * Custom error classes for the Sari Sari Agent system
 */

export class SariSariError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Database related errors
export class DatabaseError extends SariSariError {
  constructor(message: string, originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500);
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class ProductNotFoundError extends SariSariError {
  constructor(productId: string) {
    super(`Product not found: ${productId}`, 'PRODUCT_NOT_FOUND', 404);
  }
}

export class InsufficientStockError extends SariSariError {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`,
      'INSUFFICIENT_STOCK',
      400
    );
  }
}

// Session related errors
export class SessionNotFoundError extends SariSariError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', 404);
  }
}

export class SessionExpiredError extends SariSariError {
  constructor(sessionId: string) {
    super(`Session expired: ${sessionId}`, 'SESSION_EXPIRED', 401);
  }
}

// Customer related errors
export class CustomerNotFoundError extends SariSariError {
  constructor(customerId: string) {
    super(`Customer not found: ${customerId}`, 'CUSTOMER_NOT_FOUND', 404);
  }
}

// AI/NLP related errors
export class NLPServiceError extends SariSariError {
  constructor(message: string, originalError?: Error) {
    super(`NLP service error: ${message}`, 'NLP_SERVICE_ERROR', 500);
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class BedrockError extends SariSariError {
  constructor(message: string, originalError?: Error) {
    super(`Bedrock API error: ${message}`, 'BEDROCK_ERROR', 500);
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

// Validation errors
export class ValidationError extends SariSariError {
  constructor(message: string) {
    super(`Validation error: ${message}`, 'VALIDATION_ERROR', 400);
  }
}

// Business logic errors
export class PricingError extends SariSariError {
  constructor(message: string) {
    super(`Pricing error: ${message}`, 'PRICING_ERROR', 400);
  }
}

export class InventoryError extends SariSariError {
  constructor(message: string) {
    super(`Inventory error: ${message}`, 'INVENTORY_ERROR', 400);
  }
}

// Configuration errors
export class ConfigurationError extends SariSariError {
  constructor(message: string) {
    super(`Configuration error: ${message}`, 'CONFIGURATION_ERROR', 500, false);
  }
}

// Rate limiting errors
export class RateLimitError extends SariSariError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

// Error response helper
export interface ErrorResponse {
  type: 'system' | 'business' | 'user';
  code: string;
  message: string;
  suggestions?: string[];
  fallbackActions?: string[];
}

export function createErrorResponse(error: SariSariError): ErrorResponse {
  let type: 'system' | 'business' | 'user';
  let suggestions: string[] = [];
  let fallbackActions: string[] = [];

  // Categorize error type
  if (error instanceof ValidationError || error instanceof RateLimitError) {
    type = 'user';
    suggestions = ['Please check your input and try again'];
  } else if (
    error instanceof ProductNotFoundError ||
    error instanceof InsufficientStockError ||
    error instanceof PricingError ||
    error instanceof InventoryError
  ) {
    type = 'business';
    suggestions = ['Try browsing other products', 'Ask for alternatives'];
    fallbackActions = ['show-product-catalog', 'contact-support'];
  } else {
    type = 'system';
    suggestions = ['Please try again in a moment'];
    fallbackActions = ['retry-request', 'contact-support'];
  }

  return {
    type,
    code: error.code,
    message: error.message,
    suggestions,
    fallbackActions
  };
}

// Error handler for async functions
export function handleAsyncError<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof SariSariError) {
        throw error;
      }
      
      // Convert unknown errors to SariSariError
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new SariSariError(message, 'UNKNOWN_ERROR', 500, false);
    }
  };
}

// Type guard for SariSariError
export function isSariSariError(error: unknown): error is SariSariError {
  return error instanceof SariSariError;
}