/**
 * World - the container for all entities, components, and systems
 */

import { Entity, EntityId } from './entity.js';
import { Component, ComponentId, ComponentClass, ComponentStore } from './component.js';
import { Query, QueryBuilder, QueryCache, QueryDescriptor } from './query.js';
import { System, SystemContext, SystemId, SystemScheduler } from './system.js';
import { batch } from '../reactive/signal.js';
import { SystemErrorHandler, defaultErrorHandler } from './error.js';

export interface WorldConfig {
  fixedTimestep?: number;
  maxFixedUpdates?: number;
  errorHandler?: SystemErrorHandler;
}

export class World {
  private entities = new Map<EntityId, Entity>();
  private componentStore = new ComponentStore();
  private systemScheduler = new SystemScheduler();
  private queryCache = new QueryCache(this.componentStore);
  private config: Required<WorldConfig>;
  private errorHandler: SystemErrorHandler;
  private time = 0;
  private fixedTime = 0;
  private accumulator = 0;
  private running = false;
  private paused = false;
  private lastTimestamp = 0;
  private frameId: number | null = null;

  constructor(config: WorldConfig = {}) {
    this.config = {
      fixedTimestep: config.fixedTimestep ?? 1000 / 60,
      maxFixedUpdates: config.maxFixedUpdates ?? 5,
      errorHandler: config.errorHandler ?? defaultErrorHandler,
    };
    this.errorHandler = this.config.errorHandler;
  }

  createEntity(): Entity {
    const entity = new Entity();
    this.entities.set(entity.id, entity);
    return entity;
  }

  createEntityWithId(id: EntityId): Entity {
    if (this.entities.has(id)) {
      throw new Error(`Entity with id ${id} already exists`);
    }
    const entity = new Entity(id);
    this.entities.set(entity.id, entity);
    return entity;
  }

  destroyEntity(entityId: EntityId): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }

    batch(() => {
      this.componentStore.removeAllComponents(entityId);
      this.entities.delete(entityId);
      this.queryCache.markAllDirty();
    });

    return true;
  }

  getEntity(entityId: EntityId): Entity | undefined {
    return this.entities.get(entityId);
  }

  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    batch(() => {
      this.componentStore.add(entityId, component);
      const componentId = (component.constructor as ComponentClass).componentId;
      this.queryCache.markDirtyForComponent(componentId);
    });
  }

  removeComponent(entityId: EntityId, componentId: ComponentId): boolean {
    const removed = this.componentStore.remove(entityId, componentId);
    if (removed) {
      batch(() => {
        this.queryCache.markDirtyForComponent(componentId);
      });
    }
    return removed;
  }

  getComponent<T extends Component>(entityId: EntityId, componentId: ComponentId): T | undefined {
    return this.componentStore.get<T>(entityId, componentId);
  }

  hasComponent(entityId: EntityId, componentId: ComponentId): boolean {
    return this.componentStore.has(entityId, componentId);
  }

  getAllComponents(entityId: EntityId): Component[] {
    return this.componentStore.getAll(entityId);
  }

  query(descriptor: QueryDescriptor): Query {
    return this.queryCache.get(descriptor);
  }

  queryBuilder(): QueryBuilder {
    return new QueryBuilder(this.componentStore);
  }

  addSystem(system: System): void {
    this.systemScheduler.add(system);
  }

  removeSystem(systemId: SystemId): boolean {
    return this.systemScheduler.remove(systemId);
  }

  getSystem(systemId: SystemId): System | undefined {
    return this.systemScheduler.get(systemId);
  }

  hasSystem(systemId: SystemId): boolean {
    return this.systemScheduler.has(systemId);
  }

  getAllSystems(): System[] {
    return this.systemScheduler.getAll();
  }

  async init(): Promise<void> {
    const ctx: SystemContext = {
      world: this,
      deltaTime: 0,
      time: this.time,
      phase: 'init',
    };
    await this.systemScheduler.executePhase('init', ctx, this.errorHandler);
  }

  async update(deltaTime: number): Promise<void> {
    if (this.paused) {
      return;
    }

    this.time += deltaTime;
    this.accumulator += deltaTime;

    const fixedDeltaTime = this.config.fixedTimestep;
    let fixedUpdates = 0;

    while (this.accumulator >= fixedDeltaTime && fixedUpdates < this.config.maxFixedUpdates) {
      const fixedCtx: SystemContext = {
        world: this,
        deltaTime: fixedDeltaTime,
        time: this.fixedTime,
        phase: 'fixedUpdate',
      };
      await this.systemScheduler.executePhase('fixedUpdate', fixedCtx, this.errorHandler);
      this.accumulator -= fixedDeltaTime;
      this.fixedTime += fixedDeltaTime;
      fixedUpdates++;
    }

    if (fixedUpdates >= this.config.maxFixedUpdates) {
      this.accumulator = 0;
    }

    const updateCtx: SystemContext = {
      world: this,
      deltaTime,
      time: this.time,
      phase: 'update',
    };
    await this.systemScheduler.executePhase('update', updateCtx, this.errorHandler);

    const lateUpdateCtx: SystemContext = {
      world: this,
      deltaTime,
      time: this.time,
      phase: 'lateUpdate',
    };
    await this.systemScheduler.executePhase('lateUpdate', lateUpdateCtx, this.errorHandler);
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.paused = false;
    this.lastTimestamp = performance.now();

    const loop = async (timestamp: number): Promise<void> => {
      if (!this.running) {
        return;
      }

      const deltaTime = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      await this.update(deltaTime);

      if (typeof requestAnimationFrame !== 'undefined') {
        this.frameId = requestAnimationFrame(loop);
      } else {
        this.frameId = setTimeout(() => loop(performance.now()), 16) as any;
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.frameId = requestAnimationFrame(loop);
    } else {
      this.frameId = setTimeout(() => loop(performance.now()), 16) as any;
    }
  }

  stop(): void {
    this.running = false;
    if (this.frameId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.frameId);
      } else {
        clearTimeout(this.frameId);
      }
      this.frameId = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isRunning(): boolean {
    return this.running;
  }

  getTime(): number {
    return this.time;
  }

  getFixedTime(): number {
    return this.fixedTime;
  }

  async cleanup(): Promise<void> {
    const ctx: SystemContext = {
      world: this,
      deltaTime: 0,
      time: this.time,
      phase: 'cleanup',
    };
    await this.systemScheduler.executePhase('cleanup', ctx, this.errorHandler);
  }

  async destroy(): Promise<void> {
    this.stop();
    await this.cleanup();

    batch(() => {
      this.entities.clear();
      this.componentStore.clear();
      this.systemScheduler.clear();
      this.queryCache.clear();
    });

    this.time = 0;
    this.fixedTime = 0;
    this.accumulator = 0;
  }

  clear(): void {
    batch(() => {
      this.entities.clear();
      this.componentStore.clear();
      this.queryCache.clear();
    });
  }
}
