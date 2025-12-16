/**
 * Logging utility for the Sari Sari Agent
 * Provides structured logging with CloudWatch integration
 */

export interface LogContext {
  sessionId?: string;
  customerId?: string;
  productId?: string;
  correlationId?: string;
  [key: string]: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0 
      ? `[${Object.entries(this.context).map(([k, v]) => `${k}:${v}`).join(',')}]`
      : '';
    
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    
    return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}${dataStr}`;
  }

  debug(message: string, data?: any): void {
    console.debug(this.formatMessage('debug', message, data));
  }

  info(message: string, data?: any): void {
    console.log(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, error?: Error | any): void {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    
    console.error(this.formatMessage('error', message, errorData));
  }

  withContext(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  // Performance timing
  time(label: string): void {
    console.time(`${this.formatMessage('info', `Timer started: ${label}`)}`);
  }

  timeEnd(label: string): void {
    console.timeEnd(`${this.formatMessage('info', `Timer ended: ${label}`)}`);
  }
}

// Default logger instance
export const logger = new Logger();

// Helper function to create logger with session context
export function createSessionLogger(sessionId: string, customerId?: string): Logger {
  return new Logger({ sessionId, customerId });
}