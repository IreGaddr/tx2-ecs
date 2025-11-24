const { parentPort } = require('worker_threads');

// Fibonacci calculation (inefficient recursive to simulate load)
function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}

if (parentPort) {
    parentPort.on('message', (message) => {
        if (message.type === 'RUN') {
            const start = Date.now();

            // Simulate heavy work
            const result = fib(35); // Should take a noticeable amount of time

            const duration = Date.now() - start;

            // Send result back (in a real app, this would be entity updates)
            // For this example, we just log it
            console.log(`[Worker] Calculated fib(35) = ${result} in ${duration}ms`);

            parentPort.postMessage({ type: 'DONE' });
        }
    });
}
