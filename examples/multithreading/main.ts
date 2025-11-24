import { World, defineSystem, createSystemId } from '../../src/index.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    const world = new World();

    // Define a threaded system
    const heavySystem = defineSystem({
        id: createSystemId('HeavyCalculation'),
        name: 'HeavyCalculation',
        // Point to the worker script
        workerScript: join(__dirname, 'worker.cjs'),
        phases: ['update'],
    });

    world.addSystem(heavySystem);

    console.log('[Main] Starting world...');
    await world.init();

    // Run a few frames
    for (let i = 0; i < 5; i++) {
        console.log(`[Main] Frame ${i} start`);
        const start = Date.now();

        // This update triggers the threaded system
        // The main thread waits for the worker to finish in this simple implementation
        // In a real game loop, you might not await the worker if you want true parallelism
        // but ThreadedSystem currently awaits to ensure synchronization.
        await world.update(16);

        console.log(`[Main] Frame ${i} end (${Date.now() - start}ms)`);
    }

    await world.destroy();
    console.log('[Main] Done');
}

main().catch(console.error);
