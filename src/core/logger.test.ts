import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, PerformanceMetrics } from './logger.js';

describe('Logger', () => {
    let consoleSpy: any;

    beforeEach(() => {
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => { }),
            debug: vi.spyOn(console, 'debug').mockImplementation(() => { }),
            info: vi.spyOn(console, 'info').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { }),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should log messages with correct level', () => {
        const logger = new Logger({ level: LogLevel.DEBUG, format: 'text' });

        logger.debug('debug message');
        expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'), 'debug message');

        logger.info('info message');
        expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[INFO]'), 'info message');

        logger.warn('warn message');
        expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), 'warn message');

        logger.error('error message');
        expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'), 'error message');
    });

    it('should respect log levels', () => {
        const logger = new Logger({ level: LogLevel.WARN, format: 'text' });

        logger.info('info message');
        expect(consoleSpy.info).not.toHaveBeenCalled();

        logger.warn('warn message');
        expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should support JSON format', () => {
        const logger = new Logger({ level: LogLevel.INFO, format: 'json' });

        logger.info('json message', { foo: 'bar' });

        expect(consoleSpy.log).toHaveBeenCalled();
        const logCall = consoleSpy.log.mock.calls[0][0];
        const parsed = JSON.parse(logCall);

        expect(parsed).toMatchObject({
            level: 'INFO',
            message: 'json message',
            data: [{ foo: 'bar' }]
        });
        expect(parsed.timestamp).toBeDefined();
    });
});

describe('PerformanceMetrics', () => {
    beforeEach(() => {
        PerformanceMetrics.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should measure duration', () => {
        PerformanceMetrics.start('test-op');
        vi.advanceTimersByTime(100);
        const duration = PerformanceMetrics.end('test-op');

        expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should calculate average and p95', () => {
        // Simulate some measurements
        for (let i = 1; i <= 100; i++) {
            PerformanceMetrics.record('test-metric', i);
        }

        expect(PerformanceMetrics.getAverage('test-metric')).toBe(50.5);
        expect(PerformanceMetrics.getP95('test-metric')).toBe(96); // 95th percentile of 1-100 is 96 (0-indexed 95)
    });
});
