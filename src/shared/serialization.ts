/**
 * Serialization system for isomorphic entity and component data transfer
 */

import { Entity, EntityId, resetEntityIdCounter } from '../core/entity.js';
import { Component, ComponentId, ComponentClass, getComponentClass } from '../core/component.js';
import { World } from '../core/world.js';
import { batch } from '../reactive/signal.js';

export interface SerializedComponent {
  id: ComponentId;
  data: any;
}

export interface SerializedEntity {
  id: EntityId;
  components: SerializedComponent[];
}

export interface WorldSnapshot {
  entities: SerializedEntity[];
  timestamp: number;
  version: string;
}

export interface SerializationOptions {
  includeEntities?: Set<EntityId>;
  excludeEntities?: Set<EntityId>;
  includeComponents?: Set<ComponentId>;
  excludeComponents?: Set<ComponentId>;
  pretty?: boolean;
}

export class Serializer {
  private componentSerializers = new Map<ComponentId, (component: Component) => any>();
  private componentDeserializers = new Map<ComponentId, (data: any) => Component>();

  registerComponentSerializer<T extends Component>(
    componentId: ComponentId,
    serialize: (component: T) => any,
    deserialize: (data: any) => T
  ): void {
    this.componentSerializers.set(componentId, serialize as (component: Component) => any);
    this.componentDeserializers.set(componentId, deserialize as (data: any) => Component);
  }

  serializeComponent(component: Component): SerializedComponent {
    const componentClass = component.constructor as ComponentClass;
    const componentId = componentClass.componentId;

    let data: any;

    const customSerializer = this.componentSerializers.get(componentId);
    if (customSerializer) {
      data = customSerializer(component);
    } else {
      data = this.defaultSerializeComponent(component);
    }

    return {
      id: componentId,
      data,
    };
  }

  deserializeComponent(serialized: SerializedComponent): Component | null {
    const customDeserializer = this.componentDeserializers.get(serialized.id);
    if (customDeserializer) {
      return customDeserializer(serialized.data);
    }

    return this.defaultDeserializeComponent(serialized);
  }

  private defaultSerializeComponent(component: Component): any {
    const data: any = {};
    const reactiveProps = component.getAllReactiveProps();

    for (const [key, signal] of reactiveProps) {
      if (typeof key === 'string') {
        const value = signal.peek();
        data[key] = this.serializeValue(value);
      }
    }

    return data;
  }

  private defaultDeserializeComponent(serialized: SerializedComponent): Component | null {
    const ComponentClass = getComponentClass(serialized.id);
    if (!ComponentClass) {
      console.warn(`Component class not found for id: ${serialized.id}`);
      return null;
    }

    const data = this.deserializeValue(serialized.data);
    return new ComponentClass(data);
  }

  private serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(v => this.serializeValue(v));
      }

      if (value.constructor === Object) {
        const serialized: any = {};
        for (const key in value) {
          serialized[key] = this.serializeValue(value[key]);
        }
        return serialized;
      }

      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }

      if (value instanceof Map) {
        return { __type: 'Map', value: Array.from(value.entries()) };
      }

      if (value instanceof Set) {
        return { __type: 'Set', value: Array.from(value) };
      }

      return value;
    }

    return value;
  }

  private deserializeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object') {
      if (value.__type === 'Date') {
        return new Date(value.value);
      }

      if (value.__type === 'Map') {
        return new Map(value.value);
      }

      if (value.__type === 'Set') {
        return new Set(value.value);
      }

      if (Array.isArray(value)) {
        return value.map(v => this.deserializeValue(v));
      }

      const deserialized: any = {};
      for (const key in value) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        deserialized[key] = this.deserializeValue(value[key]);
      }
      return deserialized;
    }

    return value;
  }

  serializeEntity(world: World, entityId: EntityId, options?: SerializationOptions): SerializedEntity | null {
    const entity = world.getEntity(entityId);
    if (!entity) {
      return null;
    }

    if (options?.excludeEntities?.has(entityId)) {
      return null;
    }

    if (options?.includeEntities && !options.includeEntities.has(entityId)) {
      return null;
    }

    const components = world.getAllComponents(entityId);
    const serializedComponents: SerializedComponent[] = [];

    for (const component of components) {
      const componentClass = component.constructor as ComponentClass;
      const componentId = componentClass.componentId;

      if (options?.excludeComponents?.has(componentId)) {
        continue;
      }

      if (options?.includeComponents && !options.includeComponents.has(componentId)) {
        continue;
      }

      serializedComponents.push(this.serializeComponent(component));
    }

    return {
      id: entityId,
      components: serializedComponents,
    };
  }

  deserializeEntity(world: World, serialized: SerializedEntity): Entity | null {
    let entity = world.getEntity(serialized.id);
    if (!entity) {
      entity = world.createEntityWithId(serialized.id);
    }

    for (const serializedComponent of serialized.components) {
      const component = this.deserializeComponent(serializedComponent);
      if (component) {
        world.addComponent(entity.id, component);
      }
    }

    return entity;
  }

  createSnapshot(world: World, options?: SerializationOptions): WorldSnapshot {
    const entities: SerializedEntity[] = [];
    const allEntities = world.getAllEntities();

    for (const entity of allEntities) {
      const serialized = this.serializeEntity(world, entity.id, options);
      if (serialized) {
        entities.push(serialized);
      }
    }

    return {
      entities,
      timestamp: Date.now(),
      version: '1.0.0',
    };
  }

  restoreSnapshot(world: World, snapshot: WorldSnapshot): void {
    // Update or create entities from snapshot (preserves existing entities and their signals)
    batch(() => {
      for (const serializedEntity of snapshot.entities) {
        this.updateOrCreateEntity(world, serializedEntity);
      }

      // Update entity ID counter to prevent collisions with deserialized entities
      const maxId = Math.max(...snapshot.entities.map(e => e.id as number), 0);
      resetEntityIdCounter(maxId + 1);
    });
  }

  private updateOrCreateEntity(world: World, serialized: SerializedEntity): void {
    let entity = world.getEntity(serialized.id);
    if (!entity) {
      entity = world.createEntityWithId(serialized.id);
    }

    const currentComponents = new Map(
      world.getAllComponents(entity.id).map(c => {
        const componentClass = c.constructor as ComponentClass;
        return [componentClass.componentId, c];
      })
    );

    const snapshotComponentIds = new Set(serialized.components.map(c => c.id));

    for (const [componentId] of currentComponents) {
      if (!snapshotComponentIds.has(componentId)) {
        world.removeComponent(entity.id, componentId);
      }
    }

    for (const serializedComponent of serialized.components) {
      const existingComponent = currentComponents.get(serializedComponent.id);

      if (existingComponent) {
        this.updateComponent(existingComponent, serializedComponent);
      } else {
        const component = this.deserializeComponent(serializedComponent);
        if (component) {
          world.addComponent(entity.id, component);
        }
      }
    }
  }

  private updateComponent(component: Component, serialized: SerializedComponent): void {
    const data = this.deserializeValue(serialized.data);
    const reactiveProps = component.getAllReactiveProps();

    for (const [key, signal] of reactiveProps) {
      if (typeof key === 'string' && key in data) {
        const currentValue = signal.peek();
        const newValue = data[key];

        if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
          signal.set(newValue);
        }
      }
    }
  }

  toJSON(world: World, options?: SerializationOptions): string {
    const snapshot = this.createSnapshot(world, options);
    return JSON.stringify(snapshot, null, options?.pretty ? 2 : 0);
  }

  fromJSON(world: World, json: string): void {
    const snapshot = JSON.parse(json) as WorldSnapshot;
    this.restoreSnapshot(world, snapshot);
  }
}

export interface DeltaChange {
  type: 'entity_added' | 'entity_removed' | 'component_added' | 'component_removed' | 'component_updated';
  entityId: EntityId;
  componentId?: ComponentId;
  data?: any;
}

export interface Delta {
  changes: DeltaChange[];
  timestamp: number;
  baseTimestamp: number;
}

export class DeltaCompressor {
  private previousSnapshot: WorldSnapshot | null = null;

  createDelta(world: World, options?: SerializationOptions): Delta {
    const serializer = new Serializer();
    const currentSnapshot = serializer.createSnapshot(world, options);

    if (!this.previousSnapshot) {
      const changes: DeltaChange[] = [];
      for (const entity of currentSnapshot.entities) {
        changes.push({
          type: 'entity_added',
          entityId: entity.id,
        });
        for (const component of entity.components) {
          changes.push({
            type: 'component_added',
            entityId: entity.id,
            componentId: component.id,
            data: component.data,
          });
        }
      }

      this.previousSnapshot = currentSnapshot;

      return {
        changes,
        timestamp: currentSnapshot.timestamp,
        baseTimestamp: 0,
      };
    }

    const changes: DeltaChange[] = [];
    const previousEntities = new Map(this.previousSnapshot.entities.map(e => [e.id, e]));
    const currentEntities = new Map(currentSnapshot.entities.map(e => [e.id, e]));

    for (const [entityId, currentEntity] of currentEntities) {
      const previousEntity = previousEntities.get(entityId);

      if (!previousEntity) {
        changes.push({
          type: 'entity_added',
          entityId,
        });
        for (const component of currentEntity.components) {
          changes.push({
            type: 'component_added',
            entityId,
            componentId: component.id,
            data: component.data,
          });
        }
        continue;
      }

      const previousComponents = new Map(previousEntity.components.map(c => [c.id, c]));
      const currentComponents = new Map(currentEntity.components.map(c => [c.id, c]));

      for (const [componentId, currentComponent] of currentComponents) {
        const previousComponent = previousComponents.get(componentId);

        if (!previousComponent) {
          changes.push({
            type: 'component_added',
            entityId,
            componentId,
            data: currentComponent.data,
          });
        } else if (JSON.stringify(currentComponent.data) !== JSON.stringify(previousComponent.data)) {
          changes.push({
            type: 'component_updated',
            entityId,
            componentId,
            data: currentComponent.data,
          });
        }
      }

      for (const [componentId] of previousComponents) {
        if (!currentComponents.has(componentId)) {
          changes.push({
            type: 'component_removed',
            entityId,
            componentId,
          });
        }
      }
    }

    for (const [entityId] of previousEntities) {
      if (!currentEntities.has(entityId)) {
        changes.push({
          type: 'entity_removed',
          entityId,
        });
      }
    }

    this.previousSnapshot = currentSnapshot;

    return {
      changes,
      timestamp: currentSnapshot.timestamp,
      baseTimestamp: this.previousSnapshot.timestamp,
    };
  }

  applyDelta(world: World, delta: Delta): void {
    const serializer = new Serializer();

    for (const change of delta.changes) {
      switch (change.type) {
        case 'entity_added':
          if (!world.hasEntity(change.entityId)) {
            world.createEntityWithId(change.entityId);
          }
          break;

        case 'entity_removed':
          world.destroyEntity(change.entityId);
          break;

        case 'component_added':
        case 'component_updated':
          if (change.componentId && change.data !== undefined) {
            const component = serializer.deserializeComponent({
              id: change.componentId,
              data: change.data,
            });
            if (component) {
              const existing = world.getComponent(change.entityId, change.componentId);
              if (existing) {
                world.removeComponent(change.entityId, change.componentId);
              }
              world.addComponent(change.entityId, component);
            }
          }
          break;

        case 'component_removed':
          if (change.componentId) {
            world.removeComponent(change.entityId, change.componentId);
          }
          break;
      }
    }
  }

  reset(): void {
    this.previousSnapshot = null;
  }
}

export function createSerializer(): Serializer {
  return new Serializer();
}

export function createDeltaCompressor(): DeltaCompressor {
  return new DeltaCompressor();
}
