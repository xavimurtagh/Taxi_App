/**
 * Unit tests for src/utils/logger.js
 *
 * The Logger class writes to stdout/stderr. We spy on process.stdout.write
 * and process.stderr.write to verify output structure.
 */

import { jest } from '@jest/globals';

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';

const { Logger, default: logger } = await import('../../src/utils/logger.js');

describe('Logger', () => {
  let stdoutSpy;
  let stderrSpy;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('log entry structure', () => {
    test('info log contains timestamp, level, service, version, and message', () => {
      const testLogger = new Logger();
      testLogger.info('test message');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);

      expect(entry).toHaveProperty('timestamp');
      expect(entry.level).toBe('info');
      expect(entry).toHaveProperty('service');
      expect(entry).toHaveProperty('version');
      expect(entry.message).toBe('test message');
    });

    test('timestamp is in ISO 8601 format', () => {
      const testLogger = new Logger();
      testLogger.info('ts check');

      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);

      const date = new Date(entry.timestamp);
      expect(date.toISOString()).toBe(entry.timestamp);
    });
  });

  describe('log levels', () => {
    test('error writes to stderr', () => {
      const testLogger = new Logger();
      testLogger.error('error message');

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.level).toBe('error');
      expect(entry.message).toBe('error message');
    });

    test('warn writes to stdout with level warn', () => {
      const testLogger = new Logger();
      testLogger.warn('warning message');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.level).toBe('warn');
      expect(entry.message).toBe('warning message');
    });

    test('info writes to stdout with level info', () => {
      const testLogger = new Logger();
      testLogger.info('info message');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.level).toBe('info');
    });

    test('debug is suppressed in production', () => {
      const testLogger = new Logger();
      testLogger.debug('debug message');

      const debugOutput = stdoutSpy.mock.calls.find((call) => {
        try {
          const e = JSON.parse(call[0]);
          return e.level === 'debug';
        } catch {
          return false;
        }
      });
      expect(debugOutput).toBeUndefined();
    });
  });

  describe('metadata', () => {
    test('merges additional metadata into log entry', () => {
      const testLogger = new Logger();
      testLogger.info('with meta', { requestId: '123', userId: '456' });

      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.requestId).toBe('123');
      expect(entry.userId).toBe('456');
    });

    test('handles Error objects in meta', () => {
      const testLogger = new Logger();
      const err = new Error('something broke');
      testLogger.error('failure', err);

      const output = stderrSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.error).toBeDefined();
      expect(entry.error.message).toBe('something broke');
      expect(entry.error.name).toBe('Error');
      expect(entry.error.stack).toBeDefined();
      expect(entry.message).toBe('failure');
    });

    test('handles Error objects nested in meta.error', () => {
      const testLogger = new Logger();
      const err = new Error('nested error');
      testLogger.error('wrapped', { error: err, context: 'test' });

      const output = stderrSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.error.message).toBe('nested error');
      expect(entry.context).toBe('test');
    });
  });

  describe('child logger', () => {
    test('child logger inherits parent metadata', () => {
      const parent = new Logger({ service: 'test-service' });
      const child = parent.child({ requestId: 'req-123' });
      child.info('child message');

      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.service).toBe('test-service');
      expect(entry.requestId).toBe('req-123');
    });

    test('child metadata overrides parent metadata for same keys', () => {
      const parent = new Logger({ component: 'parent' });
      const child = parent.child({ component: 'child' });
      child.info('override test');

      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.component).toBe('child');
    });

    test('child logger is independent from parent', () => {
      const parent = new Logger({ component: 'parent' });
      const child = parent.child({ extra: 'data' });

      parent.info('parent log');
      const parentOutput = stdoutSpy.mock.calls[0][0];
      const parentEntry = JSON.parse(parentOutput);
      expect(parentEntry.extra).toBeUndefined();
      expect(parentEntry.component).toBe('parent');
    });

    test('grandchild inherits from both parent and child', () => {
      const root = new Logger({ app: 'openride' });
      const child = root.child({ module: 'auth' });
      const grandchild = child.child({ handler: 'login' });
      grandchild.info('deep log');

      const output = stdoutSpy.mock.calls[0][0];
      const entry = JSON.parse(output);
      expect(entry.app).toBe('openride');
      expect(entry.module).toBe('auth');
      expect(entry.handler).toBe('login');
    });
  });

  describe('singleton logger', () => {
    test('default export is a Logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    test('default logger can create children', () => {
      const child = logger.child({ test: true });
      expect(child).toBeInstanceOf(Logger);
    });
  });
});
