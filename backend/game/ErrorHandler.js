// ErrorHandler - backend: centralized error handling, logging, and emission
// Provides structured error tracking for game engine and server operations

export class ErrorHandler {
  constructor(io, roomId) {
    this.errors = [];
    this.maxErrors = 200;
    this.io = io;
    this.roomId = roomId || 'global';
  }

  log(level, code, message, context) {
    const report = {
      timestamp: Date.now(),
      level,
      code,
      message,
      context,
    };

    this.errors.push(report);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console
    const consoleLevel = level === 'critical' || level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleLevel](`[${code}] ${message}`, context || '');

    // Emit error to clients if critical or error
    if (this.io && this.roomId && (level === 'error' || level === 'critical')) {
      try {
        this.io.to(this.roomId).emit('server_error', {
          code,
          message,
          level,
        });
      } catch (e) {
        console.error('Failed to emit error to clients:', e);
      }
    }

    return report;
  }

  debug(code, message, context) {
    return this.log('debug', code, message, context);
  }

  info(code, message, context) {
    return this.log('info', code, message, context);
  }

  warn(code, message, context) {
    return this.log('warn', code, message, context);
  }

  error(code, message, context) {
    return this.log('error', code, message, context);
  }

  critical(code, message, context) {
    return this.log('critical', code, message, context);
  }

  getRecent(count) {
    const maxCount = count || 20;
    return this.errors.slice(-maxCount);
  }

  clear() {
    this.errors = [];
  }
}
