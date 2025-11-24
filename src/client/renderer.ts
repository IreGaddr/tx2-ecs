/**
 * ECS-integrated renderer for client-side DOM rendering
 */

import { Entity, EntityId } from '../core/entity.js';
import { Component, ComponentId, defineComponent } from '../core/component.js';
import { World } from '../core/world.js';
import { defineSystem, createSystemId, SystemContext } from '../core/system.js';
import { Signal, effect } from '../reactive/signal.js';
import { h, VNode, DOMRenderer, Fragment } from './dom.js';

export interface RenderComponentData {
  render: (entity: Entity, world: World) => VNode | VNode[] | null;
  priority?: number;
}

export class RenderComponent extends Component {
  static readonly componentId = 'Render' as ComponentId;
  static readonly componentName = 'Render';

  private renderFn: Signal<(entity: Entity, world: World) => VNode | VNode[] | null>;
  private prioritySignal: Signal<number>;

  constructor(data?: Partial<RenderComponentData>) {
    super();
    this.renderFn = this.defineReactive('render', data?.render ?? (() => null));
    this.prioritySignal = this.defineReactive('priority', data?.priority ?? 0);
  }

  get render(): (entity: Entity, world: World) => VNode | VNode[] | null {
    return this.renderFn.get();
  }

  set render(fn: (entity: Entity, world: World) => VNode | VNode[] | null) {
    this.renderFn.set(fn);
  }

  get priority(): number {
    return this.prioritySignal.get();
  }

  set priority(value: number) {
    this.prioritySignal.set(value);
  }

  clone(): this {
    return new RenderComponent({
      render: this.renderFn.peek(),
      priority: this.prioritySignal.peek(),
    }) as this;
  }
}

export const Render = defineComponent('Render', () => RenderComponent);

export interface TransformComponentData {
  parent?: EntityId;
  children?: EntityId[];
  localPosition?: { x: number; y: number; z: number };
  localRotation?: { x: number; y: number; z: number };
  localScale?: { x: number; y: number; z: number };
}

export class TransformComponent extends Component {
  static readonly componentId = 'Transform' as ComponentId;
  static readonly componentName = 'Transform';

  private parentSignal: Signal<EntityId | undefined>;
  private childrenSignal: Signal<EntityId[]>;
  private localPositionSignal: Signal<{ x: number; y: number; z: number }>;
  private localRotationSignal: Signal<{ x: number; y: number; z: number }>;
  private localScaleSignal: Signal<{ x: number; y: number; z: number }>;

  constructor(data?: Partial<TransformComponentData>) {
    super();
    this.parentSignal = this.defineReactive('parent', data?.parent);
    this.childrenSignal = this.defineReactive('children', data?.children ?? []);
    this.localPositionSignal = this.defineReactive('localPosition', data?.localPosition ?? { x: 0, y: 0, z: 0 });
    this.localRotationSignal = this.defineReactive('localRotation', data?.localRotation ?? { x: 0, y: 0, z: 0 });
    this.localScaleSignal = this.defineReactive('localScale', data?.localScale ?? { x: 1, y: 1, z: 1 });
  }

  get parent(): EntityId | undefined {
    return this.parentSignal.get();
  }

  set parent(value: EntityId | undefined) {
    this.parentSignal.set(value);
  }

  get children(): EntityId[] {
    return this.childrenSignal.get();
  }

  set children(value: EntityId[]) {
    this.childrenSignal.set(value);
  }

  addChild(childId: EntityId): void {
    const current = this.childrenSignal.peek();
    if (!current.includes(childId)) {
      this.childrenSignal.set([...current, childId]);
    }
  }

  removeChild(childId: EntityId): boolean {
    const current = this.childrenSignal.peek();
    const filtered = current.filter(id => id !== childId);
    if (filtered.length !== current.length) {
      this.childrenSignal.set(filtered);
      return true;
    }
    return false;
  }

  get localPosition(): { x: number; y: number; z: number } {
    return this.localPositionSignal.get();
  }

  set localPosition(value: { x: number; y: number; z: number }) {
    this.localPositionSignal.set(value);
  }

  get localRotation(): { x: number; y: number; z: number } {
    return this.localRotationSignal.get();
  }

  set localRotation(value: { x: number; y: number; z: number }) {
    this.localRotationSignal.set(value);
  }

  get localScale(): { x: number; y: number; z: number } {
    return this.localScaleSignal.get();
  }

  set localScale(value: { x: number; y: number; z: number }) {
    this.localScaleSignal.set(value);
  }

  clone(): this {
    return new TransformComponent({
      parent: this.parentSignal.peek(),
      children: [...this.childrenSignal.peek()],
      localPosition: { ...this.localPositionSignal.peek() },
      localRotation: { ...this.localRotationSignal.peek() },
      localScale: { ...this.localScaleSignal.peek() },
    }) as this;
  }
}

export const Transform = defineComponent('Transform', () => TransformComponent);

export interface DOMComponentData {
  element?: Element;
  container?: Element;
}

export class DOMComponent extends Component {
  static readonly componentId = 'DOM' as ComponentId;
  static readonly componentName = 'DOM';

  private elementSignal: Signal<Element | undefined>;
  private containerSignal: Signal<Element | undefined>;

  constructor(data?: Partial<DOMComponentData>) {
    super();
    this.elementSignal = this.defineReactive('element', data?.element);
    this.containerSignal = this.defineReactive('container', data?.container);
  }

  get element(): Element | undefined {
    return this.elementSignal.get();
  }

  set element(value: Element | undefined) {
    this.elementSignal.set(value);
  }

  get container(): Element | undefined {
    return this.containerSignal.get();
  }

  set container(value: Element | undefined) {
    this.containerSignal.set(value);
  }

  clone(): this {
    return new DOMComponent({
      element: this.elementSignal.peek(),
      container: this.containerSignal.peek(),
    }) as this;
  }
}

export const DOM = defineComponent('DOM', () => DOMComponent);

export class ECSRenderer {
  private renderer = new DOMRenderer();
  private entityVNodes = new Map<EntityId, VNode>();
  private mountedEntities = new Set<EntityId>();

  constructor(private world: World, private rootContainer: Element) { }

  renderEntity(entityId: EntityId): VNode | null {
    const entity = this.world.getEntity(entityId);
    if (!entity) {
      return null;
    }

    const renderComp = this.world.getComponent<RenderComponent>(entityId, Render.id);
    if (!renderComp) {
      return null;
    }

    const result = renderComp.render(entity, this.world);

    if (!result) {
      return null;
    }

    if (Array.isArray(result)) {
      return h(Fragment, null, ...result);
    }

    return result;
  }

  renderHierarchy(entityId: EntityId): VNode | null {
    const vnode = this.renderEntity(entityId);
    if (!vnode) {
      return null;
    }

    const transform = this.world.getComponent<TransformComponent>(entityId, Transform.id);
    if (transform && transform.children.length > 0) {
      const childVNodes = transform.children
        .map(childId => this.renderHierarchy(childId))
        .filter((v): v is VNode => v !== null);

      if (childVNodes.length > 0) {
        return h(
          vnode.type,
          vnode.props,
          ...vnode.children,
          ...childVNodes
        );
      }
    }

    return vnode;
  }

  render(): void {
    const query = this.world.query({ all: [Render.id], none: [Transform.id] });
    const rootEntities = query.execute();

    const vnodes: VNode[] = [];
    for (const entityId of rootEntities) {
      const vnode = this.renderHierarchy(entityId);
      if (vnode) {
        vnodes.push(vnode);
        this.entityVNodes.set(entityId, vnode);
        this.mountedEntities.add(entityId);
      }
    }

    const transformQuery = this.world.query({ all: [Render.id, Transform.id] });
    for (const entityId of transformQuery.execute()) {
      const transform = this.world.getComponent<TransformComponent>(entityId, Transform.id);
      if (!transform?.parent) {
        const vnode = this.renderHierarchy(entityId);
        if (vnode) {
          vnodes.push(vnode);
          this.entityVNodes.set(entityId, vnode);
          this.mountedEntities.add(entityId);
        }
      }
    }

    const rootVNode = h(Fragment, null, ...vnodes);
    this.renderer.render(rootVNode, this.rootContainer);
  }

  unmountEntity(entityId: EntityId): void {
    this.entityVNodes.delete(entityId);
    this.mountedEntities.delete(entityId);
  }

  clear(): void {
    this.entityVNodes.clear();
    this.mountedEntities.clear();
    this.renderer.render(null, this.rootContainer);
  }
}

export function createRenderSystem(container: Element) {
  let renderer: ECSRenderer | null = null;
  let disposeEffect: (() => void) | null = null;

  return defineSystem(
    {
      id: createSystemId('RenderSystem'),
      name: 'RenderSystem',
      phases: ['init', 'lateUpdate', 'cleanup'],
      priority: -1000,
      reactive: false,
    },
    (ctx: SystemContext) => {
      if (ctx.phase === 'init') {
        renderer = new ECSRenderer(ctx.world, container);

        disposeEffect = effect(() => {
          if (renderer) {
            renderer.render();
          }
        });
      } else if (ctx.phase === 'lateUpdate') {
        // Disabled to reduce console spam
        // if (renderer) {
        //   renderer.render();
        // }
      } else if (ctx.phase === 'cleanup') {
        if (disposeEffect) {
          disposeEffect();
          disposeEffect = null;
        }
        if (renderer) {
          renderer.clear();
          renderer = null;
        }
      }
    }
  );
}
