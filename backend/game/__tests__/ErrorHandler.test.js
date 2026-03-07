import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler } from '../ErrorHandler.js';

describe('ErrorHandler (Backend)', () => {
  let handler;
  let mockIo;

  beforeEach(() => {
    mockIo = {
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    };
    handler = new ErrorHandler(mockIo, 'test-room');
  });

  it('logs errors with correct structure', () => {
    const report = handler.error('DB_ERROR', 'Connection failed', { retry: 3 });

    expect(report.level).toBe('error');
    expect(report.code).toBe('DB_ERROR');
    expect(report.message).toBe('Connection failed');
    expect(report.context).toEqual({ retry: 3 });
    expect(report.timestamp).toBeDefined();
  });

  it('supports all error levels', () => {
    const levels = ['debug', 'info', 'warn', 'error', 'critical'];

    levels.forEach((level) => {
      const report = handler[level](`${level.toUpperCase()}_TEST`, `${level} test`);
      expect(report.level).toBe(level);
    });
  });

  it('emits error events to clients for error and critical levels', () => {
    handler.error('TEST_ERROR', 'Critical');
    expect(mockIo.to).toHaveBeenCalledWith('test-room');

    const emitCall = mockIo.to().emit;
    expect(emitCall).toHaveBeenCalledWith('server_error', expect.objectContaining({
      code: 'TEST_ERROR',
      level: 'error',
    }));
  });

  it('does not emit debug/info/warn to clients', () => {
    mockIo.to.mockClear();
    handler.debug('DEBUG_TEST', 'debug message');
    handler.info('INFO_TEST', 'info message');
    handler.warn('WARN_TEST', 'warn message');

    expect(mockIo.to).not.toHaveBeenCalled();
  });

  it('maintains error history with max limit', () => {
    handler.maxErrors = 5;

    for (let i = 0; i < 10; i++) {
      handler.error(`ERROR_${i}`, `Message ${i}`);
    }

    const recent = handler.getRecent(10);
    expect(recent.length).toBe(5);
  });

  it('clears error history', () => {
    handler.error('CODE', 'message');
    expect(handler.getRecent(1).length).toBe(1);

    handler.clear();
    expect(handler.getRecent().length).toBe(0);
  });

  it('works without io instance', () => {
    const handlerNoIo = new ErrorHandler();
    const report = handlerNoIo.error('TEST', 'message');
    expect(report.code).toBe('TEST');
  });
});
