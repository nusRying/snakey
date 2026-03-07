/**
 * ErrorHandler: centralized error handling and logging
 * Provides structured error tracking, logging, and client notification
 */

export type ErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface ErrorReport {
  timestamp: number;
  level: ErrorLevel;
  code: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

export class ErrorHandler {
  private errors: ErrorReport[] = [];
  private maxErrors = 100;
  private callbacks: Map<ErrorLevel, Set<(report: ErrorReport) => void>> = new Map(
    ['debug', 'info', 'warn', 'error', 'critical'].map((level) => [level as ErrorLevel, new Set()])
  );

  /**
   * Log an error with structured data
   */
  log(level: ErrorLevel, code: string, message: string, context?: Record<string, any>) {
    const report: ErrorReport = {
      timestamp: Date.now(),
      level,
      code,
      message,
      context,
      stack: new Error().stack,
    };

    this.errors.push(report);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Notify listeners
    const listeners = this.callbacks.get(level);
    if (listeners) {
      listeners.forEach((callback) => callback(report));
    }

    // Console output in dev (always log in development)
    const consoleLevel =
      level === 'critical' || level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleLevel](`[${code}] ${message}`, context);

    return report;
  }

  /**
   * Convenience methods
   */
  debug(code: string, message: string, context?: Record<string, any>) {
    return this.log('debug', code, message, context);
  }

  info(code: string, message: string, context?: Record<string, any>) {
    return this.log('info', code, message, context);
  }

  warn(code: string, message: string, context?: Record<string, any>) {
    return this.log('warn', code, message, context);
  }

  error(code: string, message: string, context?: Record<string, any>) {
    return this.log('error', code, message, context);
  }

  critical(code: string, message: string, context?: Record<string, any>) {
    return this.log('critical', code, message, context);
  }

  /**
   * Register a callback for error level
   */
  on(level: ErrorLevel, callback: (report: ErrorReport) => void) {
    const listeners = this.callbacks.get(level);
    if (listeners) {
      listeners.add(callback);
    }
  }

  /**
   * Unregister a callback
   */
  off(level: ErrorLevel, callback: (report: ErrorReport) => void) {
    const listeners = this.callbacks.get(level);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Get recent errors
   */
  getRecent(count: number = 10): ErrorReport[] {
    return this.errors.slice(-count);
  }

  /**
   * Clear error history
   */
  clear() {
    this.errors = [];
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();
