import { describe, it, expect, beforeEach } from 'vitest';
import {
  Serializer,
  DeltaCompressor,
  createSerializer,
  createDeltaCompressor,
} from './serialization.js';
import { World } from '../core/world.js';
import { Component, defineComponent } from '../core/component.js';
import { resetEntityIdCounter } from '../core/entity.js';

class TestComp extends Component {
  static readonly componentId = 'TestComp' as any;
  static readonly componentName = 'TestComp';

  private valueSignal = this.defineReactive('value', 0);
  private textSignal = this.defineReactive('text', '');

  get value() {
    return this.valueSignal.get();
  }

  set value(val: number) {
    this.valueSignal.set(val);
  }

  get text() {
    return this.textSignal.get();
  }

  set text(val: string) {
    this.textSignal.set(val);
  }

  clone(): this {
    return new TestComp({
      value: this.valueSignal.peek(),
      text: this.textSignal.peek(),
    }) as this;
  }

  constructor(data?: { value?: number; text?: string }) {
    super();
    if (data?.value !== undefined) {
      this.value = data.value;
    }
    if (data?.text !== undefined) {
      this.text = data.text;
    }
  }
}

const TestComponentDef = defineComponent('TestComp', () => TestComp);

describe('Serializer', () => {
  let serializer: Serializer;
  let world: World;

  beforeEach(() => {
    serializer = createSerializer();
    world = new World();
    resetEntityIdCounter();
  });

  describe('Component Serialization', () => {
    it('should serialize component', () => {
      const comp = new TestComp({ value: 42, text: 'hello' });
      const serialized = serializer.serializeComponent(comp);

      expect(serialized.id).toBe('TestComp');
      expect(serialized.data).toEqual({ value: 42, text: 'hello' });
    });

    it('should deserialize component', () => {
      const serialized = { id: 'TestComp' as any, data: { value: 42, text: 'hello' } };
      const comp = serializer.deserializeComponent(serialized) as TestComp;

      expect(comp).toBeInstanceOf(TestComp);
      expect(comp.value).toBe(42);
      expect(comp.text).toBe('hello');
    });

    it('should handle nested objects', () => {
      class NestedComp extends Component {
        static readonly componentId = 'NestedComp' as any;
        static readonly componentName = 'NestedComp';

        private dataSignal = this.defineReactive('data', { nested: { value: 0 } });

        get data() {
          return this.dataSignal.get();
        }

        clone(): this {
          return new NestedComp({ data: this.dataSignal.peek() }) as this;
        }

        constructor(data?: { data?: { nested: { value: number } } }) {
          super();
          if (data?.data) {
            this.dataSignal.set(data.data);
          }
        }
      }

      defineComponent('NestedComp', () => NestedComp);

      const comp = new NestedComp({ data: { nested: { value: 42 } } });
      const serialized = serializer.serializeComponent(comp);
      const deserialized = serializer.deserializeComponent(serialized) as NestedComp;

      expect(deserialized.data).toEqual({ nested: { value: 42 } });
    });

    it('should handle arrays', () => {
      class ArrayComp extends Component {
        static readonly componentId = 'ArrayComp' as any;
        static readonly componentName = 'ArrayComp';

        private itemsSignal = this.defineReactive('items', [] as number[]);

        get items() {
          return this.itemsSignal.get();
        }

        clone(): this {
          return new ArrayComp({ items: this.itemsSignal.peek() }) as this;
        }

        constructor(data?: { items?: number[] }) {
          super();
          if (data?.items) {
            this.itemsSignal.set(data.items);
          }
        }
      }

      defineComponent('ArrayComp', () => ArrayComp);

      const comp = new ArrayComp({ items: [1, 2, 3] });
      const serialized = serializer.serializeComponent(comp);
      const deserialized = serializer.deserializeComponent(serialized) as ArrayComp;

      expect(deserialized.items).toEqual([1, 2, 3]);
    });

    it('should handle Date objects', () => {
      class DateComp extends Component {
        static readonly componentId = 'DateComp' as any;
        static readonly componentName = 'DateComp';

        private dateSignal = this.defineReactive('date', new Date());

        get date() {
          return this.dateSignal.get();
        }

        clone(): this {
          return new DateComp({ date: this.dateSignal.peek() }) as this;
        }

        constructor(data?: { date?: Date }) {
          super();
          if (data?.date) {
            this.dateSignal.set(data.date);
          }
        }
      }

      defineComponent('DateComp', () => DateComp);

      const now = new Date();
      const comp = new DateComp({ date: now });
      const serialized = serializer.serializeComponent(comp);
      const deserialized = serializer.deserializeComponent(serialized) as DateComp;

      expect(deserialized.date).toBeInstanceOf(Date);
      expect(deserialized.date.getTime()).toBe(now.getTime());
    });
  });

  describe('Entity Serialization', () => {
    it('should serialize entity', () => {
      const entity = world.createEntity();
      world.addComponent(entity.id, new TestComp({ value: 42 }));

      const serialized = serializer.serializeEntity(world, entity.id);

      expect(serialized).not.toBe(null);
      expect(serialized!.id).toBe(entity.id);
      expect(serialized!.components).toHaveLength(1);
      expect(serialized!.components[0]!.id).toBe('TestComp');
    });

    it('should deserialize entity', () => {
      const serialized = {
        id: 1 as any,
        components: [{ id: 'TestComp' as any, data: { value: 42, text: 'hello' } }],
      };

      const entity = serializer.deserializeEntity(world, serialized);

      expect(entity).not.toBe(null);
      expect(world.hasEntity(serialized.id)).toBe(true);

      const comp = world.getComponent<TestComp>(serialized.id, TestComp.componentId);
      expect(comp).toBeDefined();
      expect(comp!.value).toBe(42);
    });

    it('should filter excluded entities', () => {
      const entity = world.createEntity();
      world.addComponent(entity.id, new TestComp());

      const serialized = serializer.serializeEntity(world, entity.id, {
        excludeEntities: new Set([entity.id]),
      });

      expect(serialized).toBe(null);
    });

    it('should filter included entities', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();

      world.addComponent(e1.id, new TestComp());
      world.addComponent(e2.id, new TestComp());

      const serialized = serializer.serializeEntity(world, e2.id, {
        includeEntities: new Set([e1.id]),
      });

      expect(serialized).toBe(null);
    });

    it('should filter excluded components', () => {
      const entity = world.createEntity();
      world.addComponent(entity.id, new TestComp());

      const serialized = serializer.serializeEntity(world, entity.id, {
        excludeComponents: new Set([TestComp.componentId]),
      });

      expect(serialized!.components).toHaveLength(0);
    });
  });

  describe('World Snapshot', () => {
    it('should create world snapshot', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();

      world.addComponent(e1.id, new TestComp({ value: 1 }));
      world.addComponent(e2.id, new TestComp({ value: 2 }));

      const snapshot = serializer.createSnapshot(world);

      expect(snapshot.entities).toHaveLength(2);
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.version).toBeDefined();
    });

    it('should restore world snapshot', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp({ value: 42 }));

      const snapshot = serializer.createSnapshot(world);

      const newWorld = new World();
      serializer.restoreSnapshot(newWorld, snapshot);

      expect(newWorld.getEntityCount()).toBe(1);
      const comp = newWorld.getComponent<TestComp>(e1.id, TestComp.componentId);
      expect(comp!.value).toBe(42);
    });

    it('should serialize to JSON', () => {
      const entity = world.createEntity();
      world.addComponent(entity.id, new TestComp({ value: 42 }));

      const json = serializer.toJSON(world);

      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toHaveProperty('entities');
      expect(JSON.parse(json)).toHaveProperty('timestamp');
    });

    it('should deserialize from JSON', () => {
      const entity = world.createEntity();
      world.addComponent(entity.id, new TestComp({ value: 42 }));

      const json = serializer.toJSON(world);

      const newWorld = new World();
      serializer.fromJSON(newWorld, json);

      expect(newWorld.getEntityCount()).toBe(1);
      const comp = newWorld.getComponent<TestComp>(entity.id, TestComp.componentId);
      expect(comp!.value).toBe(42);
    });
  });
});

describe('DeltaCompressor', () => {
  let compressor: DeltaCompressor;
  let world: World;

  beforeEach(() => {
    compressor = createDeltaCompressor();
    world = new World();
    resetEntityIdCounter();
  });

  describe('Delta Creation', () => {
    it('should create initial delta with all entities', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();

      world.addComponent(e1.id, new TestComp({ value: 1 }));
      world.addComponent(e2.id, new TestComp({ value: 2 }));

      const delta = compressor.createDelta(world);

      expect(delta.changes.filter(c => c.type === 'entity_added')).toHaveLength(2);
      expect(delta.changes.filter(c => c.type === 'component_added')).toHaveLength(2);
    });

    it('should detect added entities', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp());

      compressor.createDelta(world);

      const e2 = world.createEntity();
      world.addComponent(e2.id, new TestComp());

      const delta = compressor.createDelta(world);

      const entityAdded = delta.changes.find(c => c.type === 'entity_added' && c.entityId === e2.id);
      expect(entityAdded).toBeDefined();
    });

    it('should detect removed entities', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp());

      compressor.createDelta(world);

      world.destroyEntity(e1.id);

      const delta = compressor.createDelta(world);

      const entityRemoved = delta.changes.find(c => c.type === 'entity_removed' && c.entityId === e1.id);
      expect(entityRemoved).toBeDefined();
    });

    it('should detect added components', () => {
      const e1 = world.createEntity();

      compressor.createDelta(world);

      world.addComponent(e1.id, new TestComp());

      const delta = compressor.createDelta(world);

      const compAdded = delta.changes.find(
        c => c.type === 'component_added' && c.componentId === TestComp.componentId
      );
      expect(compAdded).toBeDefined();
    });

    it('should detect removed components', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp());

      compressor.createDelta(world);

      world.removeComponent(e1.id, TestComp.componentId);

      const delta = compressor.createDelta(world);

      const compRemoved = delta.changes.find(c => c.type === 'component_removed');
      expect(compRemoved).toBeDefined();
    });

    it('should detect updated components', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp({ value: 1 }));

      compressor.createDelta(world);

      const comp = world.getComponent<TestComp>(e1.id, TestComp.componentId);
      comp!.value = 42;

      const delta = compressor.createDelta(world);

      const compUpdated = delta.changes.find(c => c.type === 'component_updated');
      expect(compUpdated).toBeDefined();
      expect(compUpdated!.data.value).toBe(42);
    });

    it('should not create delta for unchanged world', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp());

      compressor.createDelta(world);

      const delta = compressor.createDelta(world);

      expect(delta.changes).toHaveLength(0);
    });
  });

  describe('Delta Application', () => {
    it('should apply entity additions', () => {
      const sourceWorld = new World();
      const targetWorld = new World();

      const e1 = sourceWorld.createEntity();
      sourceWorld.addComponent(e1.id, new TestComp({ value: 42 }));

      const delta = compressor.createDelta(sourceWorld);
      compressor.applyDelta(targetWorld, delta);

      expect(targetWorld.hasEntity(e1.id)).toBe(true);
      const comp = targetWorld.getComponent<TestComp>(e1.id, TestComp.componentId);
      expect(comp!.value).toBe(42);
    });

    it('should apply entity removals', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp());

      compressor.createDelta(world);

      world.destroyEntity(e1.id);

      const delta = compressor.createDelta(world);

      const targetWorld = new World();
      targetWorld.createEntityWithId(e1.id);

      compressor.applyDelta(targetWorld, delta);

      expect(targetWorld.hasEntity(e1.id)).toBe(false);
    });

    it('should apply component updates', () => {
      const e1 = world.createEntity();
      world.addComponent(e1.id, new TestComp({ value: 1 }));

      compressor.createDelta(world);

      const comp = world.getComponent<TestComp>(e1.id, TestComp.componentId);
      comp!.value = 42;

      const delta = compressor.createDelta(world);

      const targetWorld = new World();
      targetWorld.createEntityWithId(e1.id);
      targetWorld.addComponent(e1.id, new TestComp({ value: 1 }));

      compressor.applyDelta(targetWorld, delta);

      const targetComp = targetWorld.getComponent<TestComp>(e1.id, TestComp.componentId);
      expect(targetComp!.value).toBe(42);
    });
  });

  describe('Reset', () => {
    it('should reset previous snapshot', () => {
      world.createEntity();
      compressor.createDelta(world);

      compressor.reset();

      const delta = compressor.createDelta(world);

      expect(delta.changes.filter(c => c.type === 'entity_added')).toHaveLength(1);
    });
  });
});
