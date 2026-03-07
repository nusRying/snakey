import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler, errorHandler } from '../ErrorHandler';

describe('ErrorHandler (Frontend)', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  it('logs errors with correct structure', () => {
    const report = handler.error('TEST_ERROR', 'Test message', { foo: 'bar' });

    expect(report.level).toBe('error');
    expect(report.code).toBe('TEST_ERROR');
    expect(report.message).toBe('Test message');
    expect(report.context).toEqual({ foo: 'bar' });
    expect(report.timestamp).toBeDefined();
  });

  it('maintains error history with max limit', () => {
    const handler2 = new ErrorHandler();
    (handler2 as any).maxErrors = 5;

    for (let i = 0; i < 10; i++) {
      handler2.error(`ERROR_${i}`, `Message ${i}`);
    }

    const recent = handler2.getRecent(10);
    expect(recent.length).toBe(5);
    expect(recent[0].code).toBe('ERROR_5'); // First should be 5th error
  });

  it('supports all error levels', () => {
    const levels = ['debug', 'info', 'warn', 'error', 'critical'] as const;

    levels.forEach((level) => {
      const report = handler[level](`${level.toUpperCase()}_TEST`, `${level} test`);
      expect(report.level).toBe(level);
    });
  });

  it('can register and notify listeners', () => {
    const callback = vi.fn();
    handler.on('error', callback);

    handler.error('CODE', 'message');

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        code: 'CODE',
      })
    );
  });

  it('can unregister listeners', () => {
    const callback = vi.fn();
    handler.on('error', callback);
    handler.off('error', callback);

    handler.error('CODE', 'message');

    expect(callback).not.toHaveBeenCalled();
  });

  it('clears error history', () => {
    handler.error('CODE', 'message');
    expect(handler.getRecent(1).length).toBe(1);

    handler.clear();
    expect(handler.getRecent(1).length).toBe(0);
  });

  it('singleton instance is accessible', () => {
    expect(errorHandler).toBeDefined();
    expect(errorHandler).toBeInstanceOf(ErrorHandler);
  });
});
