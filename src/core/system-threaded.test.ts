import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineSystem, ThreadedSystem, createSystemId } from './system.js';
import { join } from 'path';

describe('ThreadedSystem', () => {
    const workerScript = join(__dirname, 'test-worker.cjs');

    it('should create a ThreadedSystem when workerScript is provided', () => {
        const system = defineSystem({
            id: createSystemId('ThreadedSys'),
            name: 'ThreadedSys',
            workerScript,
        });

        expect(system).toBeInstanceOf(ThreadedSystem);
        system.destroy();
    });

    it('should run the worker and wait for completion', async () => {
        const system = defineSystem({
            id: createSystemId('ThreadedSysRun'),
            name: 'ThreadedSysRun',
            workerScript,
        });

        const ctx = {
            world: {} as any,
            deltaTime: 16,
            time: 100,
            phase: 'update' as const,
        };

        const start = performance.now();
        await system.run(ctx);
        const duration = performance.now() - start;

        expect(duration).toBeGreaterThanOrEqual(10); // Worker waits 10ms
        await system.destroy();
    });
});
