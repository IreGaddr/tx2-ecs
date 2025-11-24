/**
 * Tests for restoreSnapshot reactivity preservation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../core/world.js';
import { Component, ComponentId, defineComponent } from '../core/component.js';
import { Serializer } from './serialization.js';
import { Signal } from '../reactive/signal.js';
import { effect } from '../reactive/signal.js';

class TestComponent extends Component {
  static readonly componentId = 'Test' as ComponentId;
  static readonly componentName = 'Test';

  private valueSignal: Signal<number>;
  private dataSignal: Signal<string>;

  constructor(data?: { value?: number; data?: string }) {
    super();
    this.valueSignal = this.defineReactive('value', data?.value ?? 0);
    this.dataSignal = this.defineReactive('data', data?.data ?? '');
  }

  get value(): number {
    return this.valueSignal.get();
  }

  set value(v: number) {
    this.valueSignal.set(v);
  }

  get data(): string {
    return this.dataSignal.get();
  }

  set data(v: string) {
    this.dataSignal.set(v);
  }

  clone(): this {
    return new TestComponent({
      value: this.valueSignal.peek(),
      data: this.dataSignal.peek(),
    }) as this;
  }
}

const Test = defineComponent('Test', () => TestComponent);

describe('Serializer reactivity preservation', () => {
  let world: World;
  let serializer: Serializer;

  beforeEach(() => {
    world = new World();
    serializer = new Serializer();
  });

  it('should preserve signal instances when restoring snapshot', () => {
    const entity = world.createEntity();
    const component = new TestComponent({ value: 1, data: 'initial' });
    world.addComponent(entity.id, component);

    const componentRef = world.getComponent<TestComponent>(entity.id, Test.id);
    expect(componentRef).toBe(component);

    const snapshot1 = serializer.createSnapshot(world);

    component.value = 2;
    component.data = 'updated';

    const snapshot2 = serializer.createSnapshot(world);

    serializer.restoreSnapshot(world, snapshot1);

    const componentAfterRestore = world.getComponent<TestComponent>(entity.id, Test.id);

    expect(componentAfterRestore).toBe(component);
    expect(componentAfterRestore?.value).toBe(1);
    expect(componentAfterRestore?.data).toBe('initial');
  });

  it('should trigger effects when restoring snapshot updates component values', () => {
    const entity = world.createEntity();
    const component = new TestComponent({ value: 1, data: 'initial' });
    world.addComponent(entity.id, component);

    let effectRunCount = 0;
    let lastSeenValue = 0;

    const dispose = effect(() => {
      const comp = world.getComponent<TestComponent>(entity.id, Test.id);
      if (comp) {
        lastSeenValue = comp.value;
        effectRunCount++;
      }
    });

    expect(effectRunCount).toBe(1);
    expect(lastSeenValue).toBe(1);

    component.value = 5;
    expect(effectRunCount).toBe(2);
    expect(lastSeenValue).toBe(5);

    const snapshot = serializer.createSnapshot(world);
    snapshot.entities[0].components[0].data.value = 10;

    serializer.restoreSnapshot(world, snapshot);

    expect(effectRunCount).toBe(3);
    expect(lastSeenValue).toBe(10);

    dispose();
  });

  it('should handle adding new components during snapshot restore', () => {
    const entity = world.createEntity();
    const snapshot1 = serializer.createSnapshot(world);

    const component = new TestComponent({ value: 42 });
    world.addComponent(entity.id, component);

    let effectRunCount = 0;
    let lastSeenValue: number | undefined;

    const dispose = effect(() => {
      const comp = world.getComponent<TestComponent>(entity.id, Test.id);
      lastSeenValue = comp?.value;
      effectRunCount++;
    });

    expect(effectRunCount).toBe(1);
    expect(lastSeenValue).toBe(42);

    serializer.restoreSnapshot(world, snapshot1);

    const compAfterRestore = world.getComponent<TestComponent>(entity.id, Test.id);
    expect(compAfterRestore).toBeUndefined();

    dispose();
  });

  it('should handle removing components during snapshot restore', () => {
    const entity = world.createEntity();
    const component = new TestComponent({ value: 99 });
    world.addComponent(entity.id, component);

    const snapshot1 = serializer.createSnapshot(world);

    world.removeComponent(entity.id, Test.id);

    const snapshot2 = serializer.createSnapshot(world);

    serializer.restoreSnapshot(world, snapshot1);
    const compAfterRestore1 = world.getComponent<TestComponent>(entity.id, Test.id);
    expect(compAfterRestore1?.value).toBe(99);

    serializer.restoreSnapshot(world, snapshot2);
    const compAfterRestore2 = world.getComponent<TestComponent>(entity.id, Test.id);
    expect(compAfterRestore2).toBeUndefined();
  });

  it('should update nested object values correctly', () => {
    class NestedComponent extends Component {
      static readonly componentId = 'Nested' as ComponentId;
      static readonly componentName = 'Nested';

      private itemsSignal: Signal<Array<{ id: number; name: string }>>;

      constructor(data?: { items?: Array<{ id: number; name: string }> }) {
        super();
        this.itemsSignal = this.defineReactive('items', data?.items ?? []);
      }

      get items(): Array<{ id: number; name: string }> {
        return this.itemsSignal.get();
      }

      set items(v: Array<{ id: number; name: string }>) {
        this.itemsSignal.set(v);
      }

      clone(): this {
        return new NestedComponent({
          items: this.itemsSignal.peek().map(item => ({ ...item })),
        }) as this;
      }
    }

    const Nested = defineComponent('Nested', () => NestedComponent);

    const entity = world.createEntity();
    const component = new NestedComponent({
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
    });
    world.addComponent(entity.id, component);

    let effectRunCount = 0;
    let lastSeenItemCount = 0;

    const dispose = effect(() => {
      const comp = world.getComponent<NestedComponent>(entity.id, Nested.id);
      if (comp) {
        lastSeenItemCount = comp.items.length;
        effectRunCount++;
      }
    });

    expect(effectRunCount).toBe(1);
    expect(lastSeenItemCount).toBe(2);

    const snapshot = serializer.createSnapshot(world);
    snapshot.entities[0].components[0].data.items = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ];

    serializer.restoreSnapshot(world, snapshot);

    expect(effectRunCount).toBe(2);
    expect(lastSeenItemCount).toBe(3);

    const comp = world.getComponent<NestedComponent>(entity.id, Nested.id);
    expect(comp?.items).toHaveLength(3);
    expect(comp?.items[2]).toEqual({ id: 3, name: 'Item 3' });

    dispose();
  });
});
