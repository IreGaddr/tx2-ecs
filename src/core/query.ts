/**
 * Query system for efficiently filtering entities by components
 */

import type { EntityId } from './entity.js';
import type { ComponentId, ComponentClass, ComponentStore } from './component.js';
import { Signal, signal } from '../reactive/signal.js';

export interface QueryFilter {
  type: 'all' | 'any' | 'none';
  components: ComponentId[];
}

export interface QueryDescriptor {
  all?: ComponentId[];
  any?: ComponentId[];
  none?: ComponentId[];
}

export class Query {
  private filters: QueryFilter[] = [];
  private cachedResults: Set<EntityId> | null = null;
  private resultSignal: Signal<Set<EntityId>> | null = null;
  private dirty = true;

  constructor(
    private componentStore: ComponentStore,
    descriptor: QueryDescriptor
  ) {
    if (descriptor.all && descriptor.all.length > 0) {
      this.filters.push({ type: 'all', components: descriptor.all });
    }
    if (descriptor.any && descriptor.any.length > 0) {
      this.filters.push({ type: 'any', components: descriptor.any });
    }
    if (descriptor.none && descriptor.none.length > 0) {
      this.filters.push({ type: 'none', components: descriptor.none });
    }

    if (this.filters.length === 0) {
      throw new Error('Query must have at least one filter');
    }
  }

  matches(entityId: EntityId): boolean {
    for (const filter of this.filters) {
      switch (filter.type) {
        case 'all':
          if (!filter.components.every(c => this.componentStore.has(entityId, c))) {
            return false;
          }
          break;
        case 'any':
          if (!filter.components.some(c => this.componentStore.has(entityId, c))) {
            return false;
          }
          break;
        case 'none':
          if (filter.components.some(c => this.componentStore.has(entityId, c))) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  execute(): Set<EntityId> {
    if (!this.dirty && this.cachedResults) {
      return new Set(this.cachedResults);
    }

    const candidateEntities = this.getCandidateEntities();
    const results = new Set<EntityId>();

    for (const entityId of candidateEntities) {
      if (this.matches(entityId)) {
        results.add(entityId);
      }
    }

    this.cachedResults = results;
    this.dirty = false;

    if (this.resultSignal) {
      this.resultSignal.set(new Set(results));
    }

    return new Set(results);
  }

  private getCandidateEntities(): Set<EntityId> {
    let candidates: Set<EntityId> | null = null;

    // Union entities for any-filters so we don't miss entities that match on different components.
    const anyFilters = this.filters.filter(f => f.type === 'any');
    if (anyFilters.length > 0) {
      candidates = new Set<EntityId>();
      for (const filter of anyFilters) {
        for (const componentId of filter.components) {
          for (const entityId of this.componentStore.getEntitiesWithComponent(componentId)) {
            candidates.add(entityId);
          }
        }
      }
    }

    // Narrow candidates by all-filters via intersection.
    const allFilters = this.filters.filter(f => f.type === 'all');
    for (const filter of allFilters) {
      for (const componentId of filter.components) {
        const entities = this.componentStore.getEntitiesWithComponent(componentId);
        if (candidates === null) {
          candidates = new Set(entities);
        } else {
          for (const id of Array.from(candidates)) {
            if (!entities.has(id)) {
              candidates.delete(id);
            }
          }
        }
      }
    }

    if (candidates === null) {
      candidates = this.componentStore.getAllEntities();
    }

    return candidates;
  }

  markDirty(): void {
    this.dirty = true;
  }

  reactive(): Signal<Set<EntityId>> {
    if (!this.resultSignal) {
      this.resultSignal = signal(this.execute());
    }
    return this.resultSignal;
  }

  forEach(callback: (entityId: EntityId) => void): void {
    const results = this.execute();
    for (const entityId of results) {
      callback(entityId);
    }
  }

  map<T>(callback: (entityId: EntityId) => T): T[] {
    const results = this.execute();
    const mapped: T[] = [];
    for (const entityId of results) {
      mapped.push(callback(entityId));
    }
    return mapped;
  }

  first(): EntityId | undefined {
    const results = this.execute();
    return results.values().next().value;
  }

  count(): number {
    return this.execute().size;
  }

  isEmpty(): boolean {
    return this.count() === 0;
  }
}

export class QueryBuilder {
  private descriptor: QueryDescriptor = {};

  constructor(private componentStore: ComponentStore) { }

  all(...components: (ComponentId | ComponentClass)[]): this {
    this.descriptor.all = components.map(c =>
      typeof c === 'string' ? c : c.componentId
    );
    return this;
  }

  any(...components: (ComponentId | ComponentClass)[]): this {
    this.descriptor.any = components.map(c =>
      typeof c === 'string' ? c : c.componentId
    );
    return this;
  }

  none(...components: (ComponentId | ComponentClass)[]): this {
    this.descriptor.none = components.map(c =>
      typeof c === 'string' ? c : c.componentId
    );
    return this;
  }

  build(): Query {
    return new Query(this.componentStore, this.descriptor);
  }
}

export class QueryCache {
  private queries = new Map<string, Query>();

  constructor(private componentStore: ComponentStore) { }

  get(descriptor: QueryDescriptor): Query {
    const key = this.getKey(descriptor);
    let query = this.queries.get(key);

    if (!query) {
      query = new Query(this.componentStore, descriptor);
      this.queries.set(key, query);
    }

    return query;
  }

  private getKey(descriptor: QueryDescriptor): string {
    const parts: string[] = [];

    if (descriptor.all) {
      parts.push(`all:${descriptor.all.sort().join(',')}`);
    }
    if (descriptor.any) {
      parts.push(`any:${descriptor.any.sort().join(',')}`);
    }
    if (descriptor.none) {
      parts.push(`none:${descriptor.none.sort().join(',')}`);
    }

    return parts.join('|');
  }

  markAllDirty(): void {
    for (const query of this.queries.values()) {
      query.markDirty();
    }
  }

  markDirtyForComponent(componentId: ComponentId): void {
    for (const [key, query] of this.queries.entries()) {
      if (key.includes(componentId)) {
        query.markDirty();
      }
    }
  }

  clear(): void {
    this.queries.clear();
  }

  size(): number {
    return this.queries.size;
  }
}
