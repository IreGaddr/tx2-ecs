import { describe, it, expect, vi } from 'vitest';
import { signal, computed, effect, batch, untrack, Signal, Computed, Effect } from './signal.js';

describe('Signal', () => {
  it('should create a signal with initial value', () => {
    const sig = signal(42);
    expect(sig.get()).toBe(42);
  });

  it('should update signal value', () => {
    const sig = signal(0);
    sig.set(10);
    expect(sig.get()).toBe(10);
  });

  it('should not notify if value is the same', () => {
    const sig = signal(5);
    const spy = vi.fn();

    effect(() => {
      sig.get();
      spy();
    });

    spy.mockClear();
    sig.set(5);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should use Object.is for equality check', () => {
    const sig = signal(NaN);
    const spy = vi.fn();

    effect(() => {
      sig.get();
      spy();
    });

    spy.mockClear();
    sig.set(NaN);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should peek value without tracking', () => {
    const sig = signal(100);
    const spy = vi.fn();

    effect(() => {
      sig.peek();
      spy();
    });

    spy.mockClear();
    sig.set(200);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should handle object values', () => {
    const sig = signal({ count: 0 });
    expect(sig.get().count).toBe(0);

    sig.set({ count: 1 });
    expect(sig.get().count).toBe(1);
  });

  it('should serialize to JSON', () => {
    const sig = signal(42);
    expect(JSON.stringify({ value: sig })).toBe('{"value":42}');
  });

  it('should convert to string', () => {
    const sig = signal('hello');
    expect(String(sig)).toBe('hello');
  });
});

describe('Computed', () => {
  it('should compute derived value', () => {
    const count = signal(5);
    const doubled = computed(() => count.get() * 2);

    expect(doubled.get()).toBe(10);
  });

  it('should update when dependency changes', () => {
    const count = signal(3);
    const doubled = computed(() => count.get() * 2);

    expect(doubled.get()).toBe(6);
    count.set(10);
    expect(doubled.get()).toBe(20);
  });

  it('should only recompute when accessed', () => {
    const spy = vi.fn();
    const count = signal(1);
    const doubled = computed(() => {
      spy();
      return count.get() * 2;
    });

    expect(spy).not.toHaveBeenCalled();
    doubled.get();
    expect(spy).toHaveBeenCalledTimes(1);

    doubled.get();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple dependencies', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.get() + b.get());

    expect(sum.get()).toBe(5);
    a.set(10);
    expect(sum.get()).toBe(13);
    b.set(5);
    expect(sum.get()).toBe(15);
  });

  it('should handle nested computed values', () => {
    const count = signal(2);
    const doubled = computed(() => count.get() * 2);
    const quadrupled = computed(() => doubled.get() * 2);

    expect(quadrupled.get()).toBe(8);
    count.set(5);
    expect(quadrupled.get()).toBe(20);
  });

  it('should track dependencies dynamically', () => {
    const condition = signal(true);
    const a = signal(1);
    const b = signal(2);
    const result = computed(() => (condition.get() ? a.get() : b.get()));

    expect(result.get()).toBe(1);

    a.set(10);
    expect(result.get()).toBe(10);

    b.set(20);
    expect(result.get()).toBe(10);

    condition.set(false);
    expect(result.get()).toBe(20);

    a.set(100);
    expect(result.get()).toBe(20);

    b.set(200);
    expect(result.get()).toBe(200);
  });

  it('should peek without tracking', () => {
    const count = signal(5);
    const doubled = computed(() => count.get() * 2);

    const value = doubled.peek();
    expect(value).toBe(10);
  });

  it('should handle disposal', () => {
    const count = signal(1);
    const doubled = computed(() => count.get() * 2);

    doubled.get();
    doubled.dispose();

    count.set(10);
    expect(doubled.get()).toBe(20);
  });
});

describe('Effect', () => {
  it('should run immediately', () => {
    const spy = vi.fn();
    effect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should track dependencies and re-run', () => {
    const count = signal(0);
    const spy = vi.fn();

    effect(() => {
      count.get();
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);

    count.set(1);
    expect(spy).toHaveBeenCalledTimes(2);

    count.set(2);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('should handle cleanup function', () => {
    const cleanup = vi.fn();
    const count = signal(0);

    effect(() => {
      count.get();
      return cleanup;
    });

    expect(cleanup).not.toHaveBeenCalled();

    count.set(1);
    expect(cleanup).toHaveBeenCalledTimes(1);

    count.set(2);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it('should dispose and stop tracking', () => {
    const count = signal(0);
    const spy = vi.fn();

    const dispose = effect(() => {
      count.get();
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);

    dispose();

    count.set(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple dependencies', () => {
    const a = signal(1);
    const b = signal(2);
    const spy = vi.fn();

    effect(() => {
      a.get();
      b.get();
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);

    a.set(10);
    expect(spy).toHaveBeenCalledTimes(2);

    b.set(20);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('should handle dynamic dependencies', () => {
    const condition = signal(true);
    const a = signal(1);
    const b = signal(2);
    const spy = vi.fn();

    effect(() => {
      if (condition.get()) {
        a.get();
      } else {
        b.get();
      }
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);

    a.set(10);
    expect(spy).toHaveBeenCalledTimes(2);

    b.set(20);
    expect(spy).toHaveBeenCalledTimes(2);

    condition.set(false);
    expect(spy).toHaveBeenCalledTimes(3);

    a.set(100);
    expect(spy).toHaveBeenCalledTimes(3);

    b.set(200);
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('should call cleanup on dispose', () => {
    const cleanup = vi.fn();
    const dispose = effect(() => cleanup);

    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should not run after disposal', () => {
    const count = signal(0);
    const spy = vi.fn();

    const dispose = effect(() => {
      count.get();
      spy();
    });

    spy.mockClear();
    dispose();

    count.set(1);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('batch', () => {
  it('should batch multiple updates', () => {
    const a = signal(1);
    const b = signal(2);
    const spy = vi.fn();

    effect(() => {
      a.get();
      b.get();
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();

    batch(() => {
      a.set(10);
      b.set(20);
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should handle nested batches', () => {
    const count = signal(0);
    const spy = vi.fn();

    effect(() => {
      count.get();
      spy();
    });

    spy.mockClear();

    batch(() => {
      count.set(1);
      batch(() => {
        count.set(2);
      });
      count.set(3);
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should return value from batch', () => {
    const result = batch(() => 42);
    expect(result).toBe(42);
  });

  it('should notify after batch completes', () => {
    const count = signal(0);
    let observedValue = 0;

    effect(() => {
      observedValue = count.get();
    });

    batch(() => {
      count.set(1);
      expect(observedValue).toBe(0);
      count.set(2);
      expect(observedValue).toBe(0);
    });

    expect(observedValue).toBe(2);
  });
});

describe('untrack', () => {
  it('should not track dependencies', () => {
    const count = signal(0);
    const spy = vi.fn();

    effect(() => {
      untrack(() => count.get());
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);

    count.set(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should return value', () => {
    const count = signal(42);
    const result = untrack(() => count.get());
    expect(result).toBe(42);
  });

  it('should allow partial tracking', () => {
    const a = signal(1);
    const b = signal(2);
    const spy = vi.fn();

    effect(() => {
      a.get();
      untrack(() => b.get());
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);

    a.set(10);
    expect(spy).toHaveBeenCalledTimes(2);

    b.set(20);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('Complex scenarios', () => {
  it('should handle effect inside computed', () => {
    const count = signal(0);
    const spy = vi.fn();

    const doubled = computed(() => {
      const value = count.get();
      effect(() => spy(value));
      return value * 2;
    });

    doubled.get();
    expect(spy).toHaveBeenCalledWith(0);

    count.set(5);
    doubled.get();
    expect(spy).toHaveBeenCalledWith(5);
  });

  it('should handle long dependency chains', () => {
    const a = signal(1);
    const b = computed(() => a.get() + 1);
    const c = computed(() => b.get() + 1);
    const d = computed(() => c.get() + 1);
    const e = computed(() => d.get() + 1);

    expect(e.get()).toBe(5);
    a.set(10);
    expect(e.get()).toBe(14);
  });

  it('should handle diamond dependency pattern', () => {
    const spy = vi.fn();
    const a = signal(1);
    const b = computed(() => a.get() * 2);
    const c = computed(() => a.get() + 1);
    const d = computed(() => b.get() + c.get());

    effect(() => {
      d.get();
      spy();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();

    a.set(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should handle effects creating effects', () => {
    const count = signal(0);
    const spy1 = vi.fn();
    const spy2 = vi.fn();

    effect(() => {
      count.get();
      spy1();

      effect(() => {
        count.get();
        spy2();
      });
    });

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);

    count.set(1);
    expect(spy1).toHaveBeenCalledTimes(2);
    expect(spy2).toHaveBeenCalledTimes(3);
  });
});
