/**
 * WASM Bridge for tx2-core
 *
 * This module provides a unified interface that works with both:
 * - Pure TypeScript implementation (tx2-ecs)
 * - WASM implementation (tx2-core compiled to WASM)
 *
 * Maintains isomorphic state by design.
 */

import type { EntityId } from '../core/entity.js';
import type { Component, ComponentId } from '../core/component.js';

export interface WasmModule {
  WasmWorld: new () => WasmWorldInstance;
  get_wasm_version(): string;
  benchmark_entity_creation(count: number): number;
}

export interface WasmWorldInstance {
  createEntity(): { id: number };
  createEntityWithId(id: number): { id: number };
  destroyEntity(entityId: number): boolean;
  hasEntity(entityId: number): boolean;
  getAllEntities(): Array<{ id: number }>;
  addComponent(entityId: number, componentId: string, data: any): void;
  removeComponent(entityId: number, componentId: string): boolean;
  hasComponent(entityId: number, componentId: string): boolean;
  getComponent(entityId: number, componentId: string): any | null;
  getAllComponents(entityId: number): Array<{ id: string; data: any }>;
  createSnapshot(): {
    entities: Array<{
      id: number;
      components: Array<{ id: string; data: any }>;
    }>;
    timestamp: number;
  };
  restoreFromSnapshot(snapshot: any): void;
  clear(): void;
  query(includeComponents: string[], excludeComponents: string[]): number[];
  free(): void;
}

let wasmModule: WasmModule | null = null;
let wasmInitialized = false;
let wasmInitPromise: Promise<WasmModule> | null = null;

export async function initWasm(wasmPath?: string): Promise<WasmModule> {
  if (wasmInitialized && wasmModule) {
    return wasmModule;
  }

  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      let initFn: any;

      if (typeof wasmPath === 'string') {
        const module = await import(wasmPath);
        initFn = module.default;
      } else {
        try {
          // @ts-expect-error - WASM module may not exist until built
          const module = await import('@tx2/core-wasm');
          initFn = module.default;
        } catch {
          throw new Error(
            'WASM module not found. Build tx2-core WASM first: cd tx2-core && ./build-wasm.sh'
          );
        }
      }

      const wasm = await initFn();
      wasmModule = wasm;
      wasmInitialized = true;
      return wasm;
    } catch (error) {
      wasmInitPromise = null;
      throw error;
    }
  })();

  return wasmInitPromise;
}

export function isWasmAvailable(): boolean {
  return wasmInitialized && wasmModule !== null;
}

export function getWasmModule(): WasmModule | null {
  return wasmModule;
}

export interface BridgeWorldConfig {
  useWasm?: boolean;
  wasmPath?: string;
}

export class BridgeWorld {
  private wasmWorld: WasmWorldInstance | null = null;
  private jsWorld: any | null = null;
  private useWasm: boolean;

  constructor(config: BridgeWorldConfig = {}) {
    this.useWasm = config.useWasm ?? false;

    if (!this.useWasm) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { World } = require('../core/world.js');
      this.jsWorld = new World();
    }
  }

  async init(config?: BridgeWorldConfig): Promise<void> {
    if (this.useWasm || config?.useWasm) {
      const wasm = await initWasm(config?.wasmPath);
      this.wasmWorld = new wasm.WasmWorld();
      this.useWasm = true;
    }
  }

  createEntity(): { id: EntityId } {
    if (this.useWasm && this.wasmWorld) {
      const entity = this.wasmWorld.createEntity();
      return { id: entity.id as EntityId };
    } else if (this.jsWorld) {
      const entity = this.jsWorld.createEntity();
      return { id: entity.id };
    }
    throw new Error('World not initialized');
  }

  createEntityWithId(id: EntityId): { id: EntityId } {
    if (this.useWasm && this.wasmWorld) {
      const entity = this.wasmWorld.createEntityWithId(id);
      return { id: entity.id as EntityId };
    } else if (this.jsWorld) {
      const entity = this.jsWorld.createEntityWithId(id);
      return { id: entity.id };
    }
    throw new Error('World not initialized');
  }

  destroyEntity(entityId: EntityId): boolean {
    if (this.useWasm && this.wasmWorld) {
      return this.wasmWorld.destroyEntity(entityId);
    } else if (this.jsWorld) {
      return this.jsWorld.destroyEntity(entityId);
    }
    throw new Error('World not initialized');
  }

  hasEntity(entityId: EntityId): boolean {
    if (this.useWasm && this.wasmWorld) {
      return this.wasmWorld.hasEntity(entityId);
    } else if (this.jsWorld) {
      return this.jsWorld.hasEntity(entityId);
    }
    throw new Error('World not initialized');
  }

  getAllEntities(): Array<{ id: EntityId }> {
    if (this.useWasm && this.wasmWorld) {
      return this.wasmWorld.getAllEntities().map(e => ({ id: e.id as EntityId }));
    } else if (this.jsWorld) {
      return this.jsWorld.getAllEntities().map((e: any) => ({ id: e.id }));
    }
    throw new Error('World not initialized');
  }

  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const componentId = (component.constructor as any).componentId;
    const data = this.serializeComponent(component);

    if (this.useWasm && this.wasmWorld) {
      this.wasmWorld.addComponent(entityId, componentId, data);
    } else if (this.jsWorld) {
      this.jsWorld.addComponent(entityId, component);
    } else {
      throw new Error('World not initialized');
    }
  }

  removeComponent(entityId: EntityId, componentId: ComponentId): boolean {
    if (this.useWasm && this.wasmWorld) {
      return this.wasmWorld.removeComponent(entityId, componentId);
    } else if (this.jsWorld) {
      return this.jsWorld.removeComponent(entityId, componentId);
    }
    throw new Error('World not initialized');
  }

  hasComponent(entityId: EntityId, componentId: ComponentId): boolean {
    if (this.useWasm && this.wasmWorld) {
      return this.wasmWorld.hasComponent(entityId, componentId);
    } else if (this.jsWorld) {
      return this.jsWorld.hasComponent(entityId, componentId);
    }
    throw new Error('World not initialized');
  }

  getComponent<T extends Component>(entityId: EntityId, componentId: ComponentId): T | undefined {
    if (this.useWasm && this.wasmWorld) {
      const data = this.wasmWorld.getComponent(entityId, componentId);
      if (data === null) {
        return undefined;
      }
      return this.deserializeComponent(componentId, data) as T;
    } else if (this.jsWorld) {
      return this.jsWorld.getComponent(entityId, componentId);
    }
    throw new Error('World not initialized');
  }

  getAllComponents(entityId: EntityId): Component[] {
    if (this.useWasm && this.wasmWorld) {
      const components = this.wasmWorld.getAllComponents(entityId);
      return components.map(c => this.deserializeComponent(c.id, c.data));
    } else if (this.jsWorld) {
      return this.jsWorld.getAllComponents(entityId);
    }
    throw new Error('World not initialized');
  }

  createSnapshot(): any {
    if (this.useWasm && this.wasmWorld) {
      return this.wasmWorld.createSnapshot();
    } else if (this.jsWorld) {
      return this.createJsSnapshot();
    }
    throw new Error('World not initialized');
  }

  restoreFromSnapshot(snapshot: any): void {
    if (this.useWasm && this.wasmWorld) {
      this.wasmWorld.restoreFromSnapshot(snapshot);
    } else if (this.jsWorld) {
      this.restoreJsSnapshot(snapshot);
    } else {
      throw new Error('World not initialized');
    }
  }

  clear(): void {
    if (this.useWasm && this.wasmWorld) {
      this.wasmWorld.clear();
    } else if (this.jsWorld) {
      this.jsWorld.clear();
    } else {
      throw new Error('World not initialized');
    }
  }

  query(includeComponents: ComponentId[], excludeComponents: ComponentId[] = []): EntityId[] {
    if (this.useWasm && this.wasmWorld) {
      return this.wasmWorld.query(includeComponents, excludeComponents).map(id => id as EntityId);
    } else if (this.jsWorld) {
      const descriptor = {
        include: new Set(includeComponents),
        exclude: new Set(excludeComponents),
      };
      const query = this.jsWorld.query(descriptor);
      return Array.from(query.entities) as EntityId[];
    }
    throw new Error('World not initialized');
  }

  destroy(): void {
    if (this.wasmWorld) {
      this.wasmWorld.free();
      this.wasmWorld = null;
    }
    if (this.jsWorld) {
      this.jsWorld.destroy();
      this.jsWorld = null;
    }
  }

  private serializeComponent(component: Component): any {
    const reactiveProps = component.getAllReactiveProps();
    const data: any = {};

    for (const [key, signal] of reactiveProps) {
      if (typeof key === 'string') {
        data[key] = signal.peek();
      }
    }

    return data;
  }

  private deserializeComponent(componentId: string, data: any): Component {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getComponentClass } = require('../core/component.js');
    const ComponentClass = getComponentClass(componentId as ComponentId);

    if (!ComponentClass) {
      throw new Error(`Component class not found: ${componentId}`);
    }

    return new ComponentClass(data);
  }

  private createJsSnapshot(): any {
    const entities = this.jsWorld.getAllEntities();
    const serializedEntities = entities.map((entity: any) => {
      const components = this.jsWorld.getAllComponents(entity.id);
      const serializedComponents = components.map((c: Component) => ({
        id: (c.constructor as any).componentId,
        data: this.serializeComponent(c),
      }));

      return {
        id: entity.id,
        components: serializedComponents,
      };
    });

    return {
      entities: serializedEntities,
      timestamp: Date.now(),
    };
  }

  private restoreJsSnapshot(snapshot: any): void {
    this.jsWorld.clear();

    for (const entity of snapshot.entities) {
      this.jsWorld.createEntityWithId(entity.id);

      for (const component of entity.components) {
        const deserializedComponent = this.deserializeComponent(component.id, component.data);
        this.jsWorld.addComponent(entity.id, deserializedComponent);
      }
    }
  }
}

export async function createWorld(config: BridgeWorldConfig = {}): Promise<BridgeWorld> {
  const world = new BridgeWorld(config);
  await world.init(config);
  return world;
}

export function getBenchmarkStats(useWasm: boolean): {
  backend: string;
  version: string;
  available: boolean;
} {
  if (useWasm && wasmModule) {
    return {
      backend: 'wasm',
      version: wasmModule.get_wasm_version(),
      available: true,
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require('../../package.json');
    return {
      backend: 'typescript',
      version: packageJson.version,
      available: true,
    };
  } catch {
    return {
      backend: 'typescript',
      version: '0.1.8',
      available: true,
    };
  }
}
