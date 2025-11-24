import { describe, it, expect, beforeEach } from 'vitest';
import {
  Component,
  ComponentStore,
  defineComponent,
  getComponentClass,
  getComponentId,
  getAllComponents,
} from './component.js';
import { createEntityId, resetEntityIdCounter } from './entity.js';
import { signal } from '../reactive/signal.js';

class TestComponent extends Component {
  static readonly componentId = 'Test' as any;
  static readonly componentName = 'Test';

  private valueSignal = this.defineReactive('value', 0);

  get value() {
    return this.valueSignal.get();
  }

  set value(val: number) {
    this.valueSignal.set(val);
  }

  clone(): this {
    return new TestComponent({ value: this.valueSignal.peek() }) as this;
  }

  constructor(data?: { value?: number }) {
    super();
    if (data?.value !== undefined) {
      this.value = data.value;
    }
  }
}

describe('Component', () => {
  it('should create component with reactive properties', () => {
    const comp = new TestComponent();
    expect(comp.value).toBe(0);
  });

  it('should update reactive properties', () => {
    const comp = new TestComponent();
    comp.value = 42;
    expect(comp.value).toBe(42);
  });

  it('should track reactive properties', () => {
    const comp = new TestComponent();
    const props = comp.getAllReactiveProps();
    expect(props.size).toBe(1);
    expect(props.has('value')).toBe(true);
  });

  it('should clone component', () => {
    const comp = new TestComponent({ value: 100 });
    const clone = comp.clone();

    expect(clone.value).toBe(100);
    expect(clone).not.toBe(comp);

    clone.value = 200;
    expect(comp.value).toBe(100);
    expect(clone.value).toBe(200);
  });
});

describe('defineComponent', () => {
  it('should define a component', () => {
    const TestComp = defineComponent('TestComp', () => TestComponent);

    expect(TestComp.id).toBe('TestComp');
    expect(TestComp.name).toBe('TestComp');
  });

  it('should create component instances', () => {
    const TestComp = defineComponent('TestComp2', () => TestComponent);
    const instance = TestComp.create({ value: 50 });

    expect(instance).toBeInstanceOf(TestComponent);
    expect(instance.value).toBe(50);
  });

  it('should serialize component', () => {
    const TestComp = defineComponent('TestComp3', () => TestComponent);
    const instance = TestComp.create({ value: 75 });
    const serialized = TestComp.serialize!(instance);

    expect(serialized).toEqual({ value: 75 });
  });

  it('should deserialize component', () => {
    const TestComp = defineComponent('TestComp4', () => TestComponent);
    const instance = TestComp.deserialize!({ value: 99 });

    expect(instance).toBeInstanceOf(TestComponent);
    expect(instance.value).toBe(99);
  });

  it('should throw error for duplicate component names', () => {
    defineComponent('UniqueComp', () => TestComponent);
    expect(() => {
      defineComponent('UniqueComp', () => TestComponent);
    }).toThrow();
  });

  it('should register component in registry', () => {
    const name = 'RegisteredComp';
    defineComponent(name, () => TestComponent);

    const id = getComponentId(name);
    expect(id).toBe(name);

    const ComponentClass = getComponentClass(id!);
    expect(ComponentClass).toBeDefined();
  });
});

describe('ComponentStore', () => {
  let store: ComponentStore;

  beforeEach(() => {
    store = new ComponentStore();
    resetEntityIdCounter();
  });

  it('should add component to entity', () => {
    const entityId = createEntityId();
    const comp = new TestComponent({ value: 10 });

    store.add(entityId, comp);

    const retrieved = store.get(entityId, TestComponent.componentId);
    expect(retrieved).toBe(comp);
  });

  it('should remove component from entity', () => {
    const entityId = createEntityId();
    const comp = new TestComponent();

    store.add(entityId, comp);
    const removed = store.remove(entityId, TestComponent.componentId);

    expect(removed).toBe(true);
    expect(store.has(entityId, TestComponent.componentId)).toBe(false);
  });

  it('should check if entity has component', () => {
    const entityId = createEntityId();
    const comp = new TestComponent();

    expect(store.has(entityId, TestComponent.componentId)).toBe(false);

    store.add(entityId, comp);

    expect(store.has(entityId, TestComponent.componentId)).toBe(true);
  });

  it('should get all components for entity', () => {
    const entityId = createEntityId();
    const comp1 = new TestComponent({ value: 1 });
    const comp2 = new TestComponent({ value: 2 });

    store.add(entityId, comp1);
    store.add(entityId, comp2);

    const all = store.getAll(entityId);
    expect(all.length).toBe(2);
  });

  it('should get entities with specific component', () => {
    const entity1 = createEntityId();
    const entity2 = createEntityId();
    const entity3 = createEntityId();

    store.add(entity1, new TestComponent());
    store.add(entity2, new TestComponent());

    const entities = store.getEntitiesWithComponent(TestComponent.componentId);

    expect(entities.size).toBe(2);
    expect(entities.has(entity1)).toBe(true);
    expect(entities.has(entity2)).toBe(true);
    expect(entities.has(entity3)).toBe(false);
  });

  it('should remove all components from entity', () => {
    const entityId = createEntityId();
    const comp1 = new TestComponent({ value: 1 });
    const comp2 = new TestComponent({ value: 2 });

    store.add(entityId, comp1);
    store.add(entityId, comp2);

    store.removeAllComponents(entityId);

    expect(store.getAll(entityId)).toEqual([]);
  });

  it('should update component index on add', () => {
    const entity1 = createEntityId();
    const entity2 = createEntityId();

    store.add(entity1, new TestComponent());

    let entities = store.getEntitiesWithComponent(TestComponent.componentId);
    expect(entities.size).toBe(1);

    store.add(entity2, new TestComponent());

    entities = store.getEntitiesWithComponent(TestComponent.componentId);
    expect(entities.size).toBe(2);
  });

  it('should update component index on remove', () => {
    const entity1 = createEntityId();
    const entity2 = createEntityId();

    store.add(entity1, new TestComponent());
    store.add(entity2, new TestComponent());

    store.remove(entity1, TestComponent.componentId);

    const entities = store.getEntitiesWithComponent(TestComponent.componentId);
    expect(entities.size).toBe(1);
    expect(entities.has(entity2)).toBe(true);
  });

  it('should clear all data', () => {
    const entity1 = createEntityId();
    const entity2 = createEntityId();

    store.add(entity1, new TestComponent());
    store.add(entity2, new TestComponent());

    store.clear();

    expect(store.getAllEntities().size).toBe(0);
    expect(store.getEntitiesWithComponent(TestComponent.componentId).size).toBe(0);
  });

  it('should get all entities', () => {
    const entity1 = createEntityId();
    const entity2 = createEntityId();

    store.add(entity1, new TestComponent());
    store.add(entity2, new TestComponent());

    const entities = store.getAllEntities();
    expect(entities.size).toBe(2);
    expect(entities.has(entity1)).toBe(true);
    expect(entities.has(entity2)).toBe(true);
  });

  it('should set entity property on component', () => {
    const entityId = createEntityId();
    const comp = new TestComponent();

    store.add(entityId, comp);

    expect(comp.entity).toBe(entityId);
  });
});
