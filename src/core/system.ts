/**
 * System implementation - systems process entities with specific components
 */

import type { World } from './world.js';
import { Effect } from '../reactive/signal.js';
import { createWorker, IWorker } from './worker.js';
import { SystemErrorHandler, SystemErrorStrategy, SystemErrorContext } from './error.js';

export type SystemId = string & { readonly __systemId: unique symbol };

export type SystemPhase = 'init' | 'update' | 'fixedUpdate' | 'lateUpdate' | 'cleanup';

export interface SystemContext {
  world: World;
  deltaTime: number;
  time: number;
  phase: SystemPhase;
}

export type SystemFunction = (ctx: SystemContext) => void | Promise<void>;

export interface SystemDescriptor {
  id: SystemId;
  name: string;
  phases?: SystemPhase[];
  priority?: number;
  enabled?: boolean;
  runBefore?: SystemId[];
  runAfter?: SystemId[];
  reactive?: boolean;
  workerScript?: string;
  onError?: SystemErrorHandler;
}

export class System {
  readonly id: SystemId;
  readonly name: string;
  readonly phases: Set<SystemPhase>;
  readonly priority: number;
  readonly runBefore: Set<SystemId>;
  readonly runAfter: Set<SystemId>;
  readonly reactive: boolean;
  readonly onError?: SystemErrorHandler;

  protected enabled: boolean;
  protected fn: SystemFunction;
  protected reactiveEffect?: Effect;
  public consecutiveFailures = 0;

  constructor(descriptor: SystemDescriptor, fn: SystemFunction) {
    this.id = descriptor.id;
    this.name = descriptor.name;
    this.phases = new Set(descriptor.phases ?? ['update']);
    this.priority = descriptor.priority ?? 0;
    this.enabled = descriptor.enabled ?? true;
    this.runBefore = new Set(descriptor.runBefore ?? []);
    this.runAfter = new Set(descriptor.runAfter ?? []);
    this.reactive = descriptor.reactive ?? false;
    this.onError = descriptor.onError;
    this.fn = fn;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  hasPhase(phase: SystemPhase): boolean {
    return this.phases.has(phase);
  }

  async run(ctx: SystemContext): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.fn(ctx);
      this.consecutiveFailures = 0;
    } catch (error: any) {
      this.consecutiveFailures++;
      const errorCtx: SystemErrorContext = {
        systemId: this.id,
        error,
        phase: ctx.phase,
        consecutiveFailures: this.consecutiveFailures,
      };

      let strategy = SystemErrorStrategy.IGNORE;

      if (this.onError) {
        const result = this.onError(errorCtx);
        if (result) strategy = result;
      } else {
        // Propagate to world if no local handler
        throw error;
      }

      if (strategy === SystemErrorStrategy.DISABLE) {
        this.enabled = false;
      }
    }
  }

  setupReactive(ctx: SystemContext): void {
    if (!this.reactive || this.reactiveEffect) {
      return;
    }

    this.reactiveEffect = new Effect(() => {
      if (this.enabled) {
        this.fn(ctx);
      }
    });
  }

  disposeReactive(): void {
    if (this.reactiveEffect) {
      this.reactiveEffect.dispose();
      this.reactiveEffect = undefined;
    }
  }

  async destroy(): Promise<void> {
    this.disposeReactive();
  }
}

export class SystemScheduler {
  private systems = new Map<SystemId, System>();
  private executionOrder = new Map<SystemPhase, SystemId[]>();
  private dirty = true;

  add(system: System): void {
    if (this.systems.has(system.id)) {
      throw new Error(`System "${system.id}" already exists`);
    }

    this.systems.set(system.id, system);
    this.dirty = true;
  }

  remove(systemId: SystemId): boolean {
    const removed = this.systems.delete(systemId);
    if (removed) {
      this.dirty = true;
    }
    return removed;
  }

  get(systemId: SystemId): System | undefined {
    return this.systems.get(systemId);
  }

  has(systemId: SystemId): boolean {
    return this.systems.has(systemId);
  }

  getAll(): System[] {
    return Array.from(this.systems.values());
  }

  async executePhase(phase: SystemPhase, ctx: SystemContext, errorHandler?: SystemErrorHandler): Promise<void> {
    if (this.dirty) {
      this.recomputeExecutionOrder();
    }

    const systemIds = this.executionOrder.get(phase) ?? [];

    for (const systemId of systemIds) {
      const system = this.systems.get(systemId);
      if (system && system.isEnabled()) {
        try {
          await system.run({ ...ctx, phase });
        } catch (error: any) {
          if (errorHandler) {
            const strategy = errorHandler({
              systemId: system.id,
              error,
              phase,
              consecutiveFailures: system.consecutiveFailures,
            });

            if (strategy === SystemErrorStrategy.DISABLE) {
              system.setEnabled(false);
            }
          } else {
            console.error(`System ${system.id} failed and no error handler was provided:`, error);
          }
        }
      }
    }
  }

  private recomputeExecutionOrder(): void {
    this.executionOrder.clear();

    const phases: SystemPhase[] = ['init', 'fixedUpdate', 'update', 'lateUpdate', 'cleanup'];

    for (const phase of phases) {
      const phaseSystems = Array.from(this.systems.values()).filter(s => s.hasPhase(phase));
      const sorted = this.topologicalSort(phaseSystems);
      this.executionOrder.set(phase, sorted.map(s => s.id));
    }

    this.dirty = false;
  }

  private topologicalSort(systems: System[]): System[] {
    const sorted: System[] = [];
    const visited = new Set<SystemId>();
    const visiting = new Set<SystemId>();
    const systemMap = new Map(systems.map(s => [s.id, s]));

    const visit = (system: System): void => {
      if (visited.has(system.id)) {
        return;
      }

      if (visiting.has(system.id)) {
        throw new Error(`Circular dependency detected in system: ${system.id}`);
      }

      visiting.add(system.id);

      for (const afterId of system.runAfter) {
        const afterSystem = systemMap.get(afterId);
        if (afterSystem) {
          visit(afterSystem);
        }
      }

      for (const beforeId of system.runBefore) {
        const beforeSystem = systemMap.get(beforeId);
        if (beforeSystem && !visited.has(beforeSystem.id)) {
          visiting.delete(system.id);
          return;
        }
      }

      visiting.delete(system.id);
      visited.add(system.id);
      sorted.push(system);
    };

    const byPriority = [...systems].sort((a, b) => b.priority - a.priority);

    for (const system of byPriority) {
      visit(system);
    }

    return sorted;
  }

  clear(): void {
    for (const system of this.systems.values()) {
      system.disposeReactive();
    }
    this.systems.clear();
    this.executionOrder.clear();
    this.dirty = true;
  }
}

export class ThreadedSystem extends System {
  private worker: IWorker;
  private pendingPromise: Promise<void> | null = null;
  private resolvePending: (() => void) | null = null;

  constructor(descriptor: SystemDescriptor, workerScript: string) {
    // For threaded systems, the main thread function is a stub that coordinates with the worker
    super(descriptor, async (ctx) => {
      await this.runWorker(ctx);
    });
    this.worker = createWorker(workerScript);
    this.setupWorker();
  }

  private setupWorker(): void {
    this.worker.onMessage((message) => {
      if (message.type === 'DONE') {
        if (this.resolvePending) {
          this.resolvePending();
          this.resolvePending = null;
          this.pendingPromise = null;
        }
      } else if (message.type === 'ERROR') {
        console.error(`Worker error in system ${this.id}:`, message.payload);
        if (this.resolvePending) {
          this.resolvePending(); // Resolve anyway to avoid hanging
          this.resolvePending = null;
          this.pendingPromise = null;
        }
      }
    });

    this.worker.onError((error) => {
      console.error(`Worker error in system ${this.id}:`, error);
      if (this.resolvePending) {
        this.resolvePending();
        this.resolvePending = null;
        this.pendingPromise = null;
      }
    });
  }

  private runWorker(ctx: SystemContext): Promise<void> {
    if (this.pendingPromise) {
      return this.pendingPromise; // Previous run not finished, skip or wait?
    }

    this.pendingPromise = new Promise<void>((resolve) => {
      this.resolvePending = resolve;
      this.worker.postMessage({
        type: 'RUN',
        payload: {
          deltaTime: ctx.deltaTime,
          time: ctx.time,
          phase: ctx.phase,
        },
      });
    });

    return this.pendingPromise;
  }

  override async destroy(): Promise<void> {
    this.worker.terminate();
  }
}

export function defineSystem(descriptor: SystemDescriptor, fn?: SystemFunction): System {
  if (descriptor.workerScript) {
    return new ThreadedSystem(descriptor, descriptor.workerScript);
  }
  if (!fn) {
    throw new Error('System function is required for non-threaded systems');
  }
  return new System(descriptor, fn);
}

export function createSystemId(name: string): SystemId {
  return name as SystemId;
}
