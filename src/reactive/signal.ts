/**
 * Reactive signal implementation with fine-grained dependency tracking
 */

export type Subscriber = () => void;
export type Unsubscribe = () => void;

let currentObserver: ReactiveNode | null = null;
const observerStack: ReactiveNode[] = [];

export abstract class ReactiveNode {
  protected subscribers = new Set<ReactiveNode>();
  protected dependencies = new Set<ReactiveNode>();
  protected stale = false;

  abstract update(): void;

  track(): void {
    if (currentObserver && currentObserver !== this) {
      this.subscribers.add(currentObserver);
      currentObserver.dependencies.add(this);
    }
  }

  notify(): void {
    // Snapshot the current subscribers so mutations during updates (clearDependencies/track)
    // don't cause an endless iteration loop.
    const subscribers = Array.from(this.subscribers);

    for (const subscriber of subscribers) {
      if (this.subscribers.has(subscriber)) {
        subscriber.stale = true;
      }
    }

    for (const subscriber of subscribers) {
      if (this.subscribers.has(subscriber)) {
        subscriber.update();
      }
    }
  }

  protected clearDependencies(): void {
    for (const dep of this.dependencies) {
      dep.subscribers.delete(this);
    }
    this.dependencies.clear();
  }

  dispose(): void {
    this.clearDependencies();
    this.subscribers.clear();
  }
}

export class Signal<T> extends ReactiveNode {
  constructor(private value: T) {
    super();
  }

  get(): T {
    this.track();
    return this.value;
  }

  set(newValue: T): void {
    if (!Object.is(this.value, newValue)) {
      this.value = newValue;
      this.stale = false;
      if (batchDepth > 0) {
        batchedSignals.add(this);
      } else {
        this.notify();
      }
    }
  }

  update(): void {
    // Signals don't update themselves, they're updated by their setters
  }

  peek(): T {
    return this.value;
  }

  toString(): string {
    return String(this.value);
  }

  toJSON(): T {
    return this.value;
  }
}

export class Computed<T> extends ReactiveNode {
  private value: T | undefined = undefined;
  private computed = false;

  constructor(private compute: () => T) {
    super();
  }

  get(): T {
    if (this.stale || !this.computed) {
      this.recompute();
    }
    this.track();
    if (this.value === undefined) {
      throw new Error('Computed value is undefined');
    }
    return this.value;
  }

  private recompute(): void {
    this.clearDependencies();
    const prevObserver = currentObserver;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    currentObserver = this;
    observerStack.push(this);

    try {
      this.value = this.compute();
      this.computed = true;
      this.stale = false;
    } finally {
      observerStack.pop();
      currentObserver = prevObserver;
    }
  }

  update(): void {
    if (!this.stale) {
      return;
    }
    this.recompute();
    this.notify();
  }

  peek(): T {
    if (!this.computed) {
      this.recompute();
    }
    if (this.value === undefined) {
      throw new Error('Computed value is undefined');
    }
    return this.value;
  }

  dispose(): void {
    this.computed = false;
    this.stale = true;
    super.dispose();
  }
}

export class Effect extends ReactiveNode {
  private cleanup: (() => void) | void = undefined;
  private disposed = false;

  constructor(private effect: () => void | (() => void)) {
    super();
    this.run();
  }

  private run(): void {
    if (this.disposed) {
      return;
    }

    this.clearDependencies();

    const prevObserver = currentObserver;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    currentObserver = this;
    observerStack.push(this);

    try {
      if (this.cleanup) {
        this.cleanup();
        this.cleanup = undefined;
      }
      this.cleanup = this.effect();
      this.stale = false;
    } finally {
      observerStack.pop();
      currentObserver = prevObserver;
    }
  }

  update(): void {
    if (!this.stale || this.disposed) {
      return;
    }
    this.run();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = undefined;
    }
    super.dispose();
  }
}

let batchDepth = 0;
const batchedSignals = new Set<Signal<any>>();

function flushBatchedUpdates(): void {
  if (batchedSignals.size === 0) {
    return;
  }

  const pending = new Set<ReactiveNode>();

  for (const sig of batchedSignals) {
    // Access protected field via any to avoid exposing subscribers publicly.
    for (const subscriber of (sig as any).subscribers as Set<ReactiveNode>) {
      (subscriber as any).stale = true;
      pending.add(subscriber);
    }
  }

  batchedSignals.clear();

  for (const subscriber of pending) {
    subscriber.update();
  }
}

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      flushBatchedUpdates();
    }
  }
}

export function untrack<T>(fn: () => T): T {
  const prevObserver = currentObserver;
  currentObserver = null;
  try {
    return fn();
  } finally {
    currentObserver = prevObserver;
  }
}

export function signal<T>(initialValue: T): Signal<T> {
  return new Signal(initialValue);
}

export function computed<T>(compute: () => T): Computed<T> {
  return new Computed(compute);
}

export function effect(effect: () => void | (() => void)): () => void {
  const eff = new Effect(effect);
  return () => eff.dispose();
}
