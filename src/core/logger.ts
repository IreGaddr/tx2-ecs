/**
 * Zero-dependency Logger and Performance Metrics
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4,
}

export interface LoggerConfig {
    level: LogLevel;
    format: 'text' | 'json';
    enabled: boolean;
}

export class Logger {
    private config: LoggerConfig;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            level: config.level ?? LogLevel.INFO,
            format: config.format ?? 'text',
            enabled: config.enabled ?? true,
        };
    }

    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    setFormat(format: 'text' | 'json'): void {
        this.config.format = format;
    }

    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, args);
    }

    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, args);
    }

    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, args);
    }

    error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, args);
    }

    private log(level: LogLevel, message: string, args: any[]): void {
        if (!this.config.enabled || level < this.config.level) {
            return;
        }

        const timestamp = new Date().toISOString();
        const data = args.length > 0 ? args : undefined;

        if (this.config.format === 'json') {
            const entry = {
                timestamp,
                level: LogLevel[level],
                message,
                data,
            };
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(entry));
        } else {
            const prefix = `[${timestamp}] [${LogLevel[level]}]`;
            // eslint-disable-next-line no-console
            switch (level) {
                case LogLevel.DEBUG:
                    // eslint-disable-next-line no-console
                    console.debug(prefix, message, ...args);
                    break;
                case LogLevel.INFO:
                    // eslint-disable-next-line no-console
                    console.info(prefix, message, ...args);
                    break;
                case LogLevel.WARN:
                    console.warn(prefix, message, ...args);
                    break;
                case LogLevel.ERROR:
                    console.error(prefix, message, ...args);
                    break;
            }
        }
    }
}

export const logger = new Logger({
    level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
    format: process.env.NODE_ENV === 'production' ? 'json' : 'text',
});

/**
 * Performance Metrics
 */
export class PerformanceMetrics {
    private static timers = new Map<string, number>();
    private static metrics = new Map<string, number[]>();

    static start(label: string): void {
        this.timers.set(label, performance.now());
    }

    static end(label: string): number {
        const start = this.timers.get(label);
        if (start === undefined) {
            return 0;
        }
        const duration = performance.now() - start;
        this.timers.delete(label);

        this.record(label, duration);
        return duration;
    }

    static record(label: string, value: number): void {
        if (!this.metrics.has(label)) {
            this.metrics.set(label, []);
        }
        const samples = this.metrics.get(label);
        if (samples) {
            samples.push(value);
            // Keep last 100 samples
            if (samples.length > 100) {
                samples.shift();
            }
        }
    }

    static getAverage(label: string): number {
        const samples = this.metrics.get(label);
        if (!samples || samples.length === 0) {
            return 0;
        }
        const sum = samples.reduce((a, b) => a + b, 0);
        return sum / samples.length;
    }

    static getP95(label: string): number {
        const samples = this.metrics.get(label);
        if (!samples || samples.length === 0) {
            return 0;
        }
        const sorted = [...samples].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.95);
        return sorted[index] ?? 0;
    }

    static clear(): void {
        this.timers.clear();
        this.metrics.clear();
    }
}
