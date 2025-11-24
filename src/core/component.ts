/**
 * Component system with reactive properties
 */

import { Signal, signal } from '../reactive/signal.js';
import type { EntityId } from './entity.js';

export type ComponentId = string & { readonly __componentId: unique symbol };

export interface ComponentType<T extends Component = Component> {
  readonly id: ComponentId;
  readonly name: string;
  create(data?: Partial<ComponentData<T>>): T;
  deserialize?(data: any): T;
  serialize?(component: T): any;
}

export abstract class Component {
  static readonly componentId: ComponentId;
  static readonly componentName: string;

  readonly entity?: EntityId;
  private reactiveProps = new Map<string | symbol, Signal<any>>();

  protected defineReactive<T>(key: string | symbol, initialValue: T): Signal<T> {
    const sig = signal(initialValue);
    this.reactiveProps.set(key, sig);
    return sig;
  }

  protected getReactive<T>(key: string | symbol): Signal<T> | undefined {
    return this.reactiveProps.get(key);
  }

  getAllReactiveProps(): Map<string | symbol, Signal<any>> {
    return new Map(this.reactiveProps);
  }

  abstract clone(): this;
}

export type ComponentData<T extends Component> = {
  [K in keyof T]: T[K] extends Signal<infer V> ? V : T[K];
};

export type ComponentClass<T extends Component = Component> = {
  new(data?: Partial<ComponentData<T>>): T;
  readonly componentId: ComponentId;
  readonly componentName: string;
};

const componentRegistry = new Map<ComponentId, ComponentClass<any>>();
const componentNameToId = new Map<string, ComponentId>();

export function defineComponent<T extends Component>(
  name: string,
  factory: () => ComponentClass<T>
): ComponentType<T> {
  const id = name as ComponentId;

  if (componentRegistry.has(id)) {
    throw new Error(`Component "${name}" is already defined`);
  }

  const ComponentClass = factory();

  Object.defineProperty(ComponentClass, 'componentId', {
    value: id,
    writable: false,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(ComponentClass, 'componentName', {
    value: name,
    writable: false,
    enumerable: true,
    configurable: true,
  });

  componentRegistry.set(id, ComponentClass);
  componentNameToId.set(name, id);

  return {
    id,
    name,
    create(data?: Partial<ComponentData<T>>): T {
      return new ComponentClass(data);
    },
    deserialize(data: any): T {
      return new ComponentClass(data);
    },
    serialize(component: T): any {
      const serialized: any = {};
      const reactiveProps = component.getAllReactiveProps();

      for (const [key, signal] of reactiveProps) {
        if (typeof key === 'string') {
          serialized[key] = signal.peek();
        }
      }

      return serialized;
    },
  };
}

export function getComponentClass<T extends Component = Component>(
  id: ComponentId
): ComponentClass<T> | undefined {
  return componentRegistry.get(id) as ComponentClass<T> | undefined;
}

export function getComponentId(name: string): ComponentId | undefined {
  return componentNameToId.get(name);
}

export function getAllComponents(): ComponentClass[] {
  return Array.from(componentRegistry.values());
}

export class ComponentStore {
  private components = new Map<EntityId, Map<ComponentId, Component[]>>();
  private componentIndex = new Map<ComponentId, Set<EntityId>>();

  add(entityId: EntityId, component: Component): void {
    let entityComponents = this.components.get(entityId);
    if (!entityComponents) {
      entityComponents = new Map();
      this.components.set(entityId, entityComponents);
    }

    const componentId = (component.constructor as ComponentClass).componentId;
    const existing = entityComponents.get(componentId) ?? [];
    entityComponents.set(componentId, [...existing, component]);

    let index = this.componentIndex.get(componentId);
    if (!index) {
      index = new Set();
      this.componentIndex.set(componentId, index);
    }
    index.add(entityId);

    Object.defineProperty(component, 'entity', {
      value: entityId,
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }

  remove(entityId: EntityId, componentId: ComponentId): boolean {
    const entityComponents = this.components.get(entityId);
    if (!entityComponents) {
      return false;
    }

    const removed = entityComponents.delete(componentId);
    if (removed) {
      const index = this.componentIndex.get(componentId);
      if (index) {
        index.delete(entityId);
        if (index.size === 0) {
          this.componentIndex.delete(componentId);
        }
      }
    }

    return removed;
  }

  get<T extends Component>(entityId: EntityId, componentId: ComponentId): T | undefined {
    const entityComponents = this.components.get(entityId);
    const list = entityComponents?.get(componentId);
    return (list && list[0]) as T | undefined;
  }

  has(entityId: EntityId, componentId: ComponentId): boolean {
    return (this.components.get(entityId)?.get(componentId)?.length ?? 0) > 0;
  }

  getAll(entityId: EntityId): Component[] {
    const entityComponents = this.components.get(entityId);
    if (!entityComponents) {
      return [];
    }

    const all: Component[] = [];
    for (const list of entityComponents.values()) {
      all.push(...list);
    }
    return all;
  }

  getEntitiesWithComponent(componentId: ComponentId): Set<EntityId> {
    return this.componentIndex.get(componentId) ?? new Set();
  }

  removeAllComponents(entityId: EntityId): void {
    const entityComponents = this.components.get(entityId);
    if (!entityComponents) {
      return;
    }

    for (const componentId of entityComponents.keys()) {
      const index = this.componentIndex.get(componentId);
      if (index) {
        index.delete(entityId);
        if (index.size === 0) {
          this.componentIndex.delete(componentId);
        }
      }
    }

    this.components.delete(entityId);
  }

  clear(): void {
    this.components.clear();
    this.componentIndex.clear();
  }

  getAllEntities(): Set<EntityId> {
    return new Set(this.components.keys());
  }
}
