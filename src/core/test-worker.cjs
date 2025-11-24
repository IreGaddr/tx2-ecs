const { parentPort } = require('worker_threads');

if (parentPort) {
    parentPort.on('message', (message) => {
        if (message.type === 'RUN') {
            // Simulate some work
            setTimeout(() => {
                parentPort.postMessage({ type: 'DONE' });
            }, 10);
        }
    });
}
