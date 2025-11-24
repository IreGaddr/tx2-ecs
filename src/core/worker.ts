/// <reference lib="dom" />
/**
 * Isomorphic Worker Abstraction
 * Wraps Node.js worker_threads and Browser Web Workers
 */

export interface WorkerMessage<T = any> {
    type: string;
    payload: T;
}

export interface IWorker {
    postMessage(message: any, transfer?: Transferable[]): void;
    onMessage(callback: (message: any) => void): void;
    onError(callback: (error: Error) => void): void;
    terminate(): void;
}

export class IsomorphicWorker implements IWorker {
    private worker: any;
    private isNode: boolean;
    private messageQueue: { message: any; transfer: Transferable[] }[] = [];
    private onMessageCallback: ((message: any) => void) | null = null;
    private onErrorCallback: ((error: Error) => void) | null = null;

    constructor(scriptPath: string) {
        this.isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

        if (this.isNode) {
            this.initNodeWorker(scriptPath);
        } else {
            this.worker = new Worker(scriptPath, { type: 'module' });
        }
    }

    private async initNodeWorker(scriptPath: string) {
        try {
            const { Worker } = await import('worker_threads');
            this.worker = new Worker(scriptPath);

            // Re-attach callbacks if they were registered before worker was ready
            if (this.onMessageCallback) {
                this.worker.on('message', this.onMessageCallback);
            }
            if (this.onErrorCallback) {
                this.worker.on('error', this.onErrorCallback);
            }

            // Flush queued messages
            for (const { message, transfer } of this.messageQueue) {
                this.worker.postMessage(message, transfer);
            }
            this.messageQueue = [];
        } catch (error) {
            console.error('Failed to initialize Node.js worker:', error);
        }
    }

    postMessage(message: any, transfer: Transferable[] = []): void {
        if (this.worker) {
            this.worker.postMessage(message, transfer);
        } else {
            if (this.isNode) {
                this.messageQueue.push({ message, transfer });
            } else {
                // Should not happen in browser as worker is synchronous
                console.warn('Worker not ready in browser environment');
            }
        }
    }

    onMessage(callback: (message: any) => void): void {
        this.onMessageCallback = callback;
        if (this.worker) {
            if (this.isNode) {
                this.worker.on('message', callback);
            } else {
                this.worker.onmessage = (e: MessageEvent) => callback(e.data);
            }
        }
    }

    onError(callback: (error: Error) => void): void {
        this.onErrorCallback = callback;
        if (this.worker) {
            if (this.isNode) {
                this.worker.on('error', callback);
            } else {
                this.worker.onerror = (e: ErrorEvent) => callback(new Error(e.message));
            }
        }
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
        }
    }
}

export function createWorker(scriptPath: string): IWorker {
    return new IsomorphicWorker(scriptPath);
}
