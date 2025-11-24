import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from './world.js';
import { Component } from './component.js';
import { defineSystem, createSystemId } from './system.js';
import { resetEntityIdCounter } from './entity.js';

class TestComp extends Component {
  static readonly componentId = 'TestComp' as any;
  static readonly componentName = 'TestComp';

  private valueSignal = this.defineReactive('value', 0);

  get value() {
    return this.valueSignal.get();
  }

  set value(val: number) {
    this.valueSignal.set(val);
  }

  clone(): this {
    return new TestComp({ value: this.valueSignal.peek() }) as this;
  }

  constructor(data?: { value?: number }) {
    super();
    if (data?.value !== undefined) {
      this.value = data.value;
    }
  }
}

describe('World', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    resetEntityIdCounter();
  });

  describe('Entity Management', () => {
    it('should create entities', () => {
      const entity = world.createEntity();
      expect(entity).toBeDefined();
      expect(entity.id).toBeDefined();
    });

    it('should create entity with specific ID', () => {
      const entity = world.createEntityWithId(100 as any);
      expect(entity.id).toBe(100);
    });

    it('should throw error for duplicate entity ID', () => {
      const entity = world.createEntity();
      expect(() => {
        world.createEntityWithId(entity.id);
      }).toThrow();
    });

    it('should get entity by ID', () => {
      const entity = world.createEntity();
      const retrieved = world.getEntity(entity.id);
      expect(retrieved).toBe(entity);
    });

    it('should check if entity exists', () => {
      const entity = world.createEntity();
      expect(world.hasEntity(entity.id)).toBe(true);
      expect(world.hasEntity(999 as any)).toBe(false);
    });

    it('should get all entities', () => {
      world.createEntity();
      world.createEntity();
      world.createEntity();

      const entities = world.getAllEntities();
      expect(entities).toHaveLength(3);
    });

    it('should get entity count', () => {
      world.createEntity();
      world.createEntity();

      expect(world.getEntityCount()).toBe(2);
    });

    it('should destroy entity', () => {
      const entity = world.createEntity();
      const destroyed = world.destroyEntity(entity.id);

      expect(destroyed).toBe(true);
      expect(world.hasEntity(entity.id)).toBe(false);
    });

    it('should return false when destroying non-existent entity', () => {
      const destroyed = world.destroyEntity(999 as any);
      expect(destroyed).toBe(false);
    });
  });

  describe('Component Management', () => {
    it('should add component to entity', () => {
      const entity = world.createEntity();
      const comp = new TestComp({ value: 42 });

      world.addComponent(entity.id, comp);

      const retrieved = world.getComponent(entity.id, TestComp.componentId);
      expect(retrieved).toBe(comp);
    });

    it('should throw error when adding component to non-existent entity', () => {
      const comp = new TestComp();
      expect(() => {
        world.addComponent(999 as any, comp);
      }).toThrow();
    });

    it('should remove component from entity', () => {
      const entity = world.createEntity();
      const comp = new TestComp();

      world.addComponent(entity.id, comp);
      const removed = world.removeComponent(entity.id, TestComp.componentId);

      expect(removed).toBe(true);
      expect(world.hasComponent(entity.id, TestComp.componentId)).toBe(false);
    });

    it('should check if entity has component', () => {
      const entity = world.createEntity();
      const comp = new TestComp();

      expect(world.hasComponent(entity.id, TestComp.componentId)).toBe(false);

      world.addComponent(entity.id, comp);

      expect(world.hasComponent(entity.id, TestComp.componentId)).toBe(true);
    });

    it('should get all components from entity', () => {
      const entity = world.createEntity();
      const comp1 = new TestComp({ value: 1 });
      const comp2 = new TestComp({ value: 2 });

      world.addComponent(entity.id, comp1);
      world.addComponent(entity.id, comp2);

      const components = world.getAllComponents(entity.id);
      expect(components).toHaveLength(2);
    });

    it('should remove all components when destroying entity', () => {
      const entity = world.createEntity();
      world.addComponent(entity.id, new TestComp());

      world.destroyEntity(entity.id);

      const components = world.getAllComponents(entity.id);
      expect(components).toHaveLength(0);
    });
  });

  describe('Query System', () => {
    it('should create queries', () => {
      const query = world.query({ all: [TestComp.componentId] });
      expect(query).toBeDefined();
    });

    it('should query entities with components', () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.addComponent(e1.id, new TestComp());
      world.addComponent(e2.id, new TestComp());

      const query = world.query({ all: [TestComp.componentId] });
      const results = query.execute();

      expect(results.size).toBe(2);
      expect(results.has(e1.id)).toBe(true);
      expect(results.has(e2.id)).toBe(true);
      expect(results.has(e3.id)).toBe(false);
    });

    it('should create query builder', () => {
      const builder = world.queryBuilder();
      expect(builder).toBeDefined();

      const query = builder.all(TestComp.componentId).build();
      expect(query).toBeDefined();
    });
  });

  describe('System Management', () => {
    it('should add system', () => {
      const system = defineSystem(
        {
          id: createSystemId('TestSystem'),
          name: 'TestSystem',
        },
        () => {}
      );

      world.addSystem(system);

      expect(world.hasSystem(system.id)).toBe(true);
    });

    it('should remove system', () => {
      const system = defineSystem(
        {
          id: createSystemId('TestSystem2'),
          name: 'TestSystem2',
        },
        () => {}
      );

      world.addSystem(system);
      const removed = world.removeSystem(system.id);

      expect(removed).toBe(true);
      expect(world.hasSystem(system.id)).toBe(false);
    });

    it('should get system', () => {
      const system = defineSystem(
        {
          id: createSystemId('TestSystem3'),
          name: 'TestSystem3',
        },
        () => {}
      );

      world.addSystem(system);
      const retrieved = world.getSystem(system.id);

      expect(retrieved).toBe(system);
    });

    it('should get all systems', () => {
      const system1 = defineSystem({ id: createSystemId('S1'), name: 'S1' }, () => {});
      const system2 = defineSystem({ id: createSystemId('S2'), name: 'S2' }, () => {});

      world.addSystem(system1);
      world.addSystem(system2);

      const systems = world.getAllSystems();
      expect(systems).toHaveLength(2);
    });
  });

  describe('Update Loop', () => {
    it('should call init on all systems', async () => {
      const spy = vi.fn();
      const system = defineSystem(
        {
          id: createSystemId('InitSystem'),
          name: 'InitSystem',
          phases: ['init'],
        },
        spy
      );

      world.addSystem(system);
      await world.init();

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0]![0].phase).toBe('init');
    });

    it('should call update systems with delta time', async () => {
      const spy = vi.fn();
      const system = defineSystem(
        {
          id: createSystemId('UpdateSystem'),
          name: 'UpdateSystem',
          phases: ['update'],
        },
        spy
      );

      world.addSystem(system);
      await world.update(16);

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0]![0].deltaTime).toBe(16);
    });

    it('should track world time', async () => {
      await world.update(16);
      expect(world.getTime()).toBe(16);

      await world.update(16);
      expect(world.getTime()).toBe(32);
    });

    it('should handle fixed update', async () => {
      const spy = vi.fn();
      const system = defineSystem(
        {
          id: createSystemId('FixedUpdateSystem'),
          name: 'FixedUpdateSystem',
          phases: ['fixedUpdate'],
        },
        spy
      );

      world.addSystem(system);
      await world.update(32);

      expect(spy).toHaveBeenCalled();
    });

    it('should pause and resume', async () => {
      const spy = vi.fn();
      const system = defineSystem(
        {
          id: createSystemId('PauseSystem'),
          name: 'PauseSystem',
          phases: ['update'],
        },
        spy
      );

      world.addSystem(system);

      world.pause();
      await world.update(16);

      expect(spy).not.toHaveBeenCalled();

      world.resume();
      await world.update(16);

      expect(spy).toHaveBeenCalled();
    });

    it('should check if paused', () => {
      expect(world.isPaused()).toBe(false);

      world.pause();
      expect(world.isPaused()).toBe(true);

      world.resume();
      expect(world.isPaused()).toBe(false);
    });

    it('should start and stop', () => {
      world.start();
      expect(world.isRunning()).toBe(true);

      world.stop();
      expect(world.isRunning()).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should call cleanup on systems', async () => {
      const spy = vi.fn();
      const system = defineSystem(
        {
          id: createSystemId('CleanupSystem'),
          name: 'CleanupSystem',
          phases: ['cleanup'],
        },
        spy
      );

      world.addSystem(system);
      await world.cleanup();

      expect(spy).toHaveBeenCalled();
    });

    it('should destroy world', async () => {
      world.createEntity();
      world.createEntity();

      await world.destroy();

      expect(world.getEntityCount()).toBe(0);
      expect(world.getTime()).toBe(0);
    });

    it('should clear world', () => {
      world.createEntity();
      world.createEntity();

      world.clear();

      expect(world.getEntityCount()).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should create world with custom config', () => {
      const customWorld = new World({
        fixedTimestep: 30,
        maxFixedUpdates: 10,
      });

      expect(customWorld).toBeDefined();
    });

    it('should use default config values', () => {
      const defaultWorld = new World();
      expect(defaultWorld).toBeDefined();
    });
  });
});
