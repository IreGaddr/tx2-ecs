import { describe, it, expect, vi } from 'vitest';
import { World } from './world.js';
import { defineSystem, createSystemId } from './system.js';
import { SystemErrorStrategy } from './error.js';

describe('Error Handling', () => {
    it('should catch system errors and use default handler', async () => {
        const world = new World();
        const error = new Error('Test Error');
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const failingSystem = defineSystem({
            id: createSystemId('FailingSystem'),
            name: 'FailingSystem',
        }, () => {
            throw error;
        });

        world.addSystem(failingSystem);
        await world.init(); // Init phase

        // Should not throw
        await world.update(16);

        expect(consoleSpy).toHaveBeenCalled();
        expect(failingSystem.consecutiveFailures).toBe(1);

        consoleSpy.mockRestore();
    });

    it('should disable system after excessive failures', async () => {
        const world = new World();
        const failingSystem = defineSystem({
            id: createSystemId('CrashingSystem'),
            name: 'CrashingSystem',
        }, () => {
            throw new Error('Crash');
        });

        world.addSystem(failingSystem);
        await world.init();

        // Default handler disables after 3 failures
        await world.update(16); // 1
        await world.update(16); // 2
        await world.update(16); // 3 -> Disable

        expect(failingSystem.consecutiveFailures).toBe(3);
        expect(failingSystem.isEnabled()).toBe(false);

        // Next update should not run the system (no error logged)
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        await world.update(16);
        expect(consoleSpy).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should use custom error handler', async () => {
        const handler = vi.fn(() => SystemErrorStrategy.IGNORE);
        const world = new World({ errorHandler: handler });

        const failingSystem = defineSystem({
            id: createSystemId('CustomHandlerSystem'),
            name: 'CustomHandlerSystem',
        }, () => {
            throw new Error('Custom Error');
        });

        world.addSystem(failingSystem);
        await world.init();
        await world.update(16);

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
            systemId: 'CustomHandlerSystem',
            error: expect.any(Error),
            consecutiveFailures: 1,
        }));
    });

    it('should support system-level error handler', async () => {
        const systemHandler = vi.fn(() => SystemErrorStrategy.DISABLE);
        const world = new World();

        const failingSystem = defineSystem({
            id: createSystemId('SystemLevelHandler'),
            name: 'SystemLevelHandler',
            onError: systemHandler,
        }, () => {
            throw new Error('System Error');
        });

        world.addSystem(failingSystem);
        await world.init();
        await world.update(16);

        expect(systemHandler).toHaveBeenCalled();
        expect(failingSystem.isEnabled()).toBe(false);
    });
});
