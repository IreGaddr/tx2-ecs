import { describe, it, expect, beforeEach } from 'vitest';
import { Query, QueryBuilder, QueryCache } from './query.js';
import { ComponentStore, Component } from './component.js';
import { createEntityId, resetEntityIdCounter } from './entity.js';

class CompA extends Component {
  static readonly componentId = 'CompA' as any;
  static readonly componentName = 'CompA';
  clone(): this {
    return new CompA() as this;
  }
}

class CompB extends Component {
  static readonly componentId = 'CompB' as any;
  static readonly componentName = 'CompB';
  clone(): this {
    return new CompB() as this;
  }
}

class CompC extends Component {
  static readonly componentId = 'CompC' as any;
  static readonly componentName = 'CompC';
  clone(): this {
    return new CompC() as this;
  }
}

describe('Query', () => {
  let store: ComponentStore;

  beforeEach(() => {
    store = new ComponentStore();
    resetEntityIdCounter();
  });

  it('should query entities with all specified components', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();
    const e3 = createEntityId();

    store.add(e1, new CompA());
    store.add(e1, new CompB());

    store.add(e2, new CompA());

    store.add(e3, new CompA());
    store.add(e3, new CompB());

    const query = new Query(store, { all: [CompA.componentId, CompB.componentId] });
    const results = query.execute();

    expect(results.size).toBe(2);
    expect(results.has(e1)).toBe(true);
    expect(results.has(e3)).toBe(true);
  });

  it('should query entities with any specified component', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();
    const e3 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompB());
    store.add(e3, new CompC());

    const query = new Query(store, { any: [CompA.componentId, CompB.componentId] });
    const results = query.execute();

    expect(results.size).toBe(2);
    expect(results.has(e1)).toBe(true);
    expect(results.has(e2)).toBe(true);
    expect(results.has(e3)).toBe(false);
  });

  it('should query entities without specified components', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();
    const e3 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompA());
    store.add(e2, new CompB());
    store.add(e3, new CompA());

    const query = new Query(store, { all: [CompA.componentId], none: [CompB.componentId] });
    const results = query.execute();

    expect(results.size).toBe(2);
    expect(results.has(e1)).toBe(true);
    expect(results.has(e3)).toBe(true);
  });

  it('should combine multiple query filters', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();
    const e3 = createEntityId();
    const e4 = createEntityId();

    store.add(e1, new CompA());
    store.add(e1, new CompB());

    store.add(e2, new CompA());
    store.add(e2, new CompC());

    store.add(e3, new CompB());
    store.add(e3, new CompC());

    store.add(e4, new CompA());
    store.add(e4, new CompB());
    store.add(e4, new CompC());

    const query = new Query(store, {
      all: [CompA.componentId],
      any: [CompB.componentId, CompC.componentId],
      none: [CompC.componentId],
    });

    const results = query.execute();

    expect(results.size).toBe(1);
    expect(results.has(e1)).toBe(true);
  });

  it('should cache query results', () => {
    const e1 = createEntityId();
    store.add(e1, new CompA());

    const query = new Query(store, { all: [CompA.componentId] });

    const results1 = query.execute();
    const results2 = query.execute();

    expect(results1).not.toBe(results2);
    expect(results1.size).toBe(results2.size);
  });

  it('should mark query as dirty', () => {
    const e1 = createEntityId();
    store.add(e1, new CompA());

    const query = new Query(store, { all: [CompA.componentId] });

    query.execute();
    query.markDirty();

    const e2 = createEntityId();
    store.add(e2, new CompA());

    const results = query.execute();
    expect(results.size).toBe(2);
  });

  it('should iterate over results', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompA());

    const query = new Query(store, { all: [CompA.componentId] });
    const visited: number[] = [];

    query.forEach(entityId => {
      visited.push(entityId);
    });

    expect(visited).toHaveLength(2);
    expect(visited).toContain(e1);
    expect(visited).toContain(e2);
  });

  it('should map over results', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompA());

    const query = new Query(store, { all: [CompA.componentId] });
    const mapped = query.map(entityId => entityId * 2);

    expect(mapped).toHaveLength(2);
    expect(mapped).toContain(e1 * 2);
    expect(mapped).toContain(e2 * 2);
  });

  it('should get first result', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompA());

    const query = new Query(store, { all: [CompA.componentId] });
    const first = query.first();

    expect(first).toBeDefined();
    expect([e1, e2]).toContain(first!);
  });

  it('should count results', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();
    const e3 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompA());
    store.add(e3, new CompA());

    const query = new Query(store, { all: [CompA.componentId] });

    expect(query.count()).toBe(3);
  });

  it('should check if query is empty', () => {
    const query = new Query(store, { all: [CompA.componentId] });

    expect(query.isEmpty()).toBe(true);

    const e1 = createEntityId();
    store.add(e1, new CompA());
    query.markDirty();

    expect(query.isEmpty()).toBe(false);
  });

  it('should create reactive query', () => {
    const e1 = createEntityId();
    store.add(e1, new CompA());

    const query = new Query(store, { all: [CompA.componentId] });
    const reactive = query.reactive();

    expect(reactive.get().size).toBe(1);
  });

  it('should throw error for empty query descriptor', () => {
    expect(() => {
      new Query(store, {});
    }).toThrow();
  });
});

describe('QueryBuilder', () => {
  let store: ComponentStore;

  beforeEach(() => {
    store = new ComponentStore();
    resetEntityIdCounter();
  });

  it('should build query with all filter', () => {
    const e1 = createEntityId();
    store.add(e1, new CompA());
    store.add(e1, new CompB());

    const query = new QueryBuilder(store).all(CompA.componentId, CompB.componentId).build();

    const results = query.execute();
    expect(results.size).toBe(1);
  });

  it('should build query with any filter', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompB());

    const query = new QueryBuilder(store).any(CompA.componentId, CompB.componentId).build();

    const results = query.execute();
    expect(results.size).toBe(2);
  });

  it('should build query with none filter', () => {
    const e1 = createEntityId();
    const e2 = createEntityId();

    store.add(e1, new CompA());
    store.add(e2, new CompA());
    store.add(e2, new CompB());

    const query = new QueryBuilder(store).all(CompA.componentId).none(CompB.componentId).build();

    const results = query.execute();
    expect(results.size).toBe(1);
    expect(results.has(e1)).toBe(true);
  });

  it('should build query with component classes', () => {
    const e1 = createEntityId();
    store.add(e1, new CompA());

    const query = new QueryBuilder(store).all(CompA).build();

    const results = query.execute();
    expect(results.size).toBe(1);
  });

  it('should chain multiple filters', () => {
    const e1 = createEntityId();
    store.add(e1, new CompA());
    store.add(e1, new CompB());

    const query = new QueryBuilder(store)
      .all(CompA.componentId)
      .any(CompB.componentId, CompC.componentId)
      .none(CompC.componentId)
      .build();

    const results = query.execute();
    expect(results.size).toBe(1);
  });
});

describe('QueryCache', () => {
  let store: ComponentStore;
  let cache: QueryCache;

  beforeEach(() => {
    store = new ComponentStore();
    cache = new QueryCache(store);
    resetEntityIdCounter();
  });

  it('should cache queries', () => {
    const query1 = cache.get({ all: [CompA.componentId] });
    const query2 = cache.get({ all: [CompA.componentId] });

    expect(query1).toBe(query2);
  });

  it('should create different queries for different descriptors', () => {
    const query1 = cache.get({ all: [CompA.componentId] });
    const query2 = cache.get({ all: [CompB.componentId] });

    expect(query1).not.toBe(query2);
  });

  it('should mark all queries as dirty', () => {
    const e1 = createEntityId();
    store.add(e1, new CompA());

    const query = cache.get({ all: [CompA.componentId] });
    query.execute();

    const e2 = createEntityId();
    store.add(e2, new CompA());

    cache.markAllDirty();

    const results = query.execute();
    expect(results.size).toBe(2);
  });

  it('should mark queries dirty for specific component', () => {
    const query1 = cache.get({ all: [CompA.componentId] });
    const query2 = cache.get({ all: [CompB.componentId] });

    query1.execute();
    query2.execute();

    cache.markDirtyForComponent(CompA.componentId);

    const e1 = createEntityId();
    store.add(e1, new CompA());
    store.add(e1, new CompB());

    const results1 = query1.execute();
    expect(results1.size).toBe(1);
  });

  it('should clear cache', () => {
    cache.get({ all: [CompA.componentId] });
    cache.get({ all: [CompB.componentId] });

    expect(cache.size()).toBe(2);

    cache.clear();

    expect(cache.size()).toBe(0);
  });

  it('should handle complex query descriptors', () => {
    const query = cache.get({
      all: [CompA.componentId, CompB.componentId],
      any: [CompC.componentId],
      none: [CompC.componentId],
    });

    expect(query).toBeDefined();
  });
});
