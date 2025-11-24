/**
 * DOM manipulation utilities and virtual DOM types
 */

import { effect } from '../reactive/signal.js';

export type VNodeType = string | symbol | ComponentFunction;
export type VNodeProps = Record<string, any> | null;
export type VNodeChild = VNode | string | number | boolean | null | undefined;
export type VNodeChildren = VNodeChild | VNodeChild[];

export interface VNode {
  type: VNodeType;
  props: VNodeProps;
  children: VNodeChild[];
  key: string | number | null;
  ref?: Ref<any>;
}

export type ComponentFunction = (props: any) => VNode | VNode[];

export interface Ref<T = any> {
  current: T | null;
}

export const Fragment = Symbol('Fragment');
export const Text = Symbol('Text');

export function createRef<T = any>(): Ref<T> {
  return { current: null };
}

export function h(
  type: VNodeType,
  props: VNodeProps,
  ...children: VNodeChildren[]
): VNode {
  const flatChildren = flattenChildren(children);
  const key = props?.key ?? null;
  const ref = props?.ref;

  const cleanProps = props ? { ...props } : null;
  if (cleanProps) {
    delete cleanProps.key;
    delete cleanProps.ref;
  }

  return {
    type,
    props: cleanProps,
    children: flatChildren,
    key,
    ref,
  };
}

function flattenChildren(children: VNodeChildren[]): VNodeChild[] {
  const result: VNodeChild[] = [];

  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) {
      continue;
    }

    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else if (typeof child === 'object' && 'type' in child) {
      result.push(child);
    } else {
      result.push(String(child));
    }
  }

  return result;
}

export function normalizeVNode(vnode: VNodeChild): VNode | null {
  if (vnode === null || vnode === undefined || vnode === false || vnode === true) {
    return null;
  }

  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return {
      type: Text,
      props: null,
      children: [String(vnode)],
      key: null,
    };
  }

  return vnode;
}

export interface DOMPatch {
  type: 'create' | 'update' | 'remove' | 'replace' | 'reorder';
  parent?: Node;
  node?: Node;
  vnode?: VNode;
  oldVNode?: VNode;
  index?: number;
  props?: Record<string, any>;
  oldProps?: Record<string, any>;
}

export class DOMRenderer {
  private vnodeToDOM = new WeakMap<VNode, Node>();
  private domToVNode = new WeakMap<Node, VNode>();
  private componentInstances = new WeakMap<VNode, any>();

  render(vnode: VNode | null, container: Element): void {
    const oldVNode = this.domToVNode.get(container);

    if (!vnode) {
      if (oldVNode) {
        this.unmount(container.firstChild!);
        container.textContent = '';
      }
      return;
    }

    if (!oldVNode) {
      const dom = this.create(vnode);
      container.appendChild(dom);
      this.domToVNode.set(container, vnode);
    } else {
      const patched = this.diff(oldVNode, vnode);
      if (patched) {
        this.domToVNode.set(container, vnode);
      }
    }
  }

  private create(vnode: VNode): Node {
    if (vnode.type === Text) {
      const text = document.createTextNode(vnode.children[0] as string);
      this.vnodeToDOM.set(vnode, text);
      this.domToVNode.set(text, vnode);
      return text;
    }

    if (vnode.type === Fragment) {
      const fragment = document.createDocumentFragment();
      vnode.children = vnode.children
        .map(child => normalizeVNode(child))
        .filter((c): c is VNode => c !== null);
      for (const child of vnode.children as VNode[]) {
        fragment.appendChild(this.create(child));
      }
      return fragment;
    }

    if (typeof vnode.type === 'function') {
      const componentResult = vnode.type(vnode.props || {});
      const componentVNode = Array.isArray(componentResult)
        ? h(Fragment, null, ...componentResult)
        : componentResult;
      const normalized = normalizeVNode(componentVNode);
      if (!normalized) {
        return document.createTextNode('');
      }
      const dom = this.create(normalized);
      this.componentInstances.set(vnode, normalized);
      this.vnodeToDOM.set(vnode, dom);
      return dom;
    }

    const element = document.createElement(vnode.type as string);

    if (vnode.props) {
      this.updateProps(element, {}, vnode.props);
    }

    if (vnode.ref) {
      vnode.ref.current = element;
    }

    vnode.children = vnode.children
      .map(child => normalizeVNode(child))
      .filter((c): c is VNode => c !== null);

    for (const child of vnode.children as VNode[]) {
      element.appendChild(this.create(child));
    }

    this.vnodeToDOM.set(vnode, element);
    this.domToVNode.set(element, vnode);
    return element;
  }

  private diff(oldVNode: VNode, newVNode: VNode): boolean {
    if (oldVNode.type !== newVNode.type || oldVNode.key !== newVNode.key) {
      const dom = this.vnodeToDOM.get(oldVNode);
      if (dom && dom.parentNode) {
        const newDom = this.create(newVNode);
        dom.parentNode.replaceChild(newDom, dom);
        this.unmount(dom);
      }
      return true;
    }

    if (newVNode.type === Text) {
      const dom = this.vnodeToDOM.get(oldVNode) as Text;
      if (dom && oldVNode.children[0] !== newVNode.children[0]) {
        dom.textContent = newVNode.children[0] as string;
      }
      this.vnodeToDOM.set(newVNode, dom);
      return true;
    }

    if (newVNode.type === Fragment) {
      // Fragments don't have a DOM node - they merge into their parent
      // Just diff the children arrays directly
      oldVNode.children = oldVNode.children
        .map(child => normalizeVNode(child))
        .filter((c): c is VNode => c !== null);
      newVNode.children = newVNode.children
        .map(child => normalizeVNode(child))
        .filter((c): c is VNode => c !== null);

      // Diff each pair of children
      const maxLen = Math.max(oldVNode.children.length, newVNode.children.length);
      for (let i = 0; i < maxLen; i++) {
        const oldChild = (oldVNode.children as VNode[])[i];
        const newChild = (newVNode.children as VNode[])[i];

        if (oldChild && newChild) {
          this.diff(oldChild, newChild);
        } else if (newChild) {
          // New child added - need to find where to insert it
          // For now, just re-create the whole thing
          return false;
        } else if (oldChild) {
          // Child removed - need to remove it
          const dom = this.vnodeToDOM.get(oldChild);
          if (dom && dom.parentNode) {
            this.unmount(dom);
            dom.parentNode.removeChild(dom);
          }
        }
      }
      return true;
    }

    if (typeof newVNode.type === 'function') {
      const oldComponentVNode = this.componentInstances.get(oldVNode);
      const componentResult = newVNode.type(newVNode.props || {});
      const newComponentVNode = normalizeVNode(
        Array.isArray(componentResult)
          ? h(Fragment, null, ...componentResult)
          : componentResult
      );

      if (!newComponentVNode) {
        const dom = this.vnodeToDOM.get(oldVNode);
        if (dom && dom.parentNode) {
          this.unmount(dom);
          dom.parentNode.removeChild(dom);
        }
        return true;
      }

      if (oldComponentVNode) {
        this.diff(oldComponentVNode, newComponentVNode);
      } else {
        const dom = this.create(newComponentVNode);
        const oldDom = this.vnodeToDOM.get(oldVNode);
        if (oldDom && oldDom.parentNode) {
          oldDom.parentNode.replaceChild(dom, oldDom);
          this.unmount(oldDom);
        }
      }

      this.componentInstances.set(newVNode, newComponentVNode);
      const dom = this.vnodeToDOM.get(oldComponentVNode);
      if (dom) {
        this.vnodeToDOM.set(newVNode, dom);
      }
      return true;
    }

    const dom = this.vnodeToDOM.get(oldVNode) as Element;
    if (!dom) {
      return false;
    }

    if (newVNode.ref) {
      newVNode.ref.current = dom;
    }

    this.updateProps(dom, oldVNode.props || {}, newVNode.props || {});
    this.diffChildren(dom, oldVNode.children, newVNode.children);

    this.vnodeToDOM.set(newVNode, dom);
    this.domToVNode.set(dom, newVNode);
    return true;
  }

  private diffChildren(parent: Element, oldChildren: VNodeChild[], newChildren: VNodeChild[]): void {
    const oldNormalized = oldChildren.map(normalizeVNode).filter((v): v is VNode => v !== null);
    const newNormalized = newChildren.map(normalizeVNode).filter((v): v is VNode => v !== null);

    // Persist normalized children on the incoming vnode so future diffs reuse the same references.
    (newChildren as VNodeChild[]).length = 0;
    (newChildren as VNodeChild[]).push(...newNormalized);

    const oldKeyed = new Map<string | number, { vnode: VNode; index: number }>();
    const newKeyed = new Map<string | number, { vnode: VNode; index: number }>();

    for (let i = 0; i < oldNormalized.length; i++) {
      const vnode = oldNormalized[i]!;
      if (vnode?.key !== null) {
        oldKeyed.set(vnode.key!, { vnode, index: i });
      }
    }

    for (let i = 0; i < newNormalized.length; i++) {
      const vnode = newNormalized[i]!;
      if (vnode?.key !== null) {
        newKeyed.set(vnode.key!, { vnode, index: i });
      }
    }

    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldNormalized.length || newIndex < newNormalized.length) {
      const oldVNode = oldNormalized[oldIndex];
      const newVNode = newNormalized[newIndex];

      if (!oldVNode && newVNode) {
        const newDom = this.create(newVNode);
        if (newIndex < parent.childNodes.length) {
          parent.insertBefore(newDom, parent.childNodes[newIndex]!);
        } else {
          parent.appendChild(newDom);
        }
        newIndex++;
        continue;
      }

      if (oldVNode && !newVNode) {
        const oldDom = this.vnodeToDOM.get(oldVNode);
        if (oldDom) {
          this.unmount(oldDom);
          parent.removeChild(oldDom);
        }
        oldIndex++;
        continue;
      }

      if (!oldVNode || !newVNode) {
        break;
      }

      if (oldVNode.key !== null && newVNode.key !== null) {
        if (oldVNode.key === newVNode.key) {
          this.diff(oldVNode, newVNode);
          oldIndex++;
          newIndex++;
        } else if (newKeyed.has(oldVNode.key)) {
          const newDom = this.create(newVNode);
          const oldDom = this.vnodeToDOM.get(oldVNode);
          if (oldDom) {
            parent.insertBefore(newDom, oldDom);
          }
          newIndex++;
        } else {
          const oldDom = this.vnodeToDOM.get(oldVNode);
          if (oldDom) {
            this.unmount(oldDom);
            parent.removeChild(oldDom);
          }
          oldIndex++;
        }
      } else {
        this.diff(oldVNode, newVNode);
        oldIndex++;
        newIndex++;
      }
    }
  }

  private updateProps(element: Element, oldProps: Record<string, any>, newProps: Record<string, any>): void {
    const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

    for (const key of allKeys) {
      const oldValue = oldProps[key];
      const newValue = newProps[key];

      if (key.startsWith('on') && key.length > 2) {
        const eventName = key.slice(2).toLowerCase();
        if (typeof oldValue === 'function') {
          element.removeEventListener(eventName, oldValue);
        } else if (oldValue) {
          element.removeAttribute(key.toLowerCase());
        }

        if (typeof newValue === 'function') {
          element.addEventListener(eventName, newValue);
        } else if (typeof newValue === 'string') {
          // Inline handler string; assign as attribute so the browser wires it to `on...`.
          element.setAttribute(key.toLowerCase(), newValue);
        }
        continue;
      }

      if (key === 'style') {
        this.updateStyle(element as HTMLElement, oldValue, newValue);
        continue;
      }

      if (key === 'className' || key === 'class') {
        if (newValue !== undefined && newValue !== null) {
          element.setAttribute('class', newValue);
        } else {
          (element as any).className = '';
          element.removeAttribute('class');
        }
        continue;
      }

      if (newValue === undefined || newValue === null || newValue === false) {
        if (key in element) {
          (element as any)[key] = '';
        }
        element.removeAttribute(key);
        continue;
      }

      if (oldValue === newValue) {
        continue;
      }

      if (key in element) {
        (element as any)[key] = newValue;
      } else {
        element.setAttribute(key, newValue === true ? '' : newValue);
      }
    }
  }

  private updateStyle(element: HTMLElement, oldStyle: any, newStyle: any): void {
    if (!oldStyle) {
      oldStyle = {};
    }
    if (!newStyle) {
      newStyle = {};
    }

    if (typeof newStyle === 'string') {
      element.style.cssText = newStyle;
      return;
    }

    if (typeof oldStyle === 'string') {
      element.style.cssText = '';
      oldStyle = {};
    }

    const allKeys = new Set([...Object.keys(oldStyle), ...Object.keys(newStyle)]);

    for (const key of allKeys) {
      const value = newStyle[key];
      if (value !== undefined && value !== null) {
        const normalizedValue = typeof value === 'number' ? `${value}px` : value;
        if (key in element.style) {
          (element.style as any)[key] = normalizedValue;
        } else {
          element.style.setProperty(key, normalizedValue);
        }
      } else {
        if (key in element.style) {
          (element.style as any)[key] = '';
        }
        element.style.removeProperty(key);
      }
    }
  }

  private unmount(node: Node): void {
    const vnode = this.domToVNode.get(node);
    if (vnode) {
      if (vnode.ref) {
        vnode.ref.current = null;
      }
      this.vnodeToDOM.delete(vnode);
      this.domToVNode.delete(node);
      this.componentInstances.delete(vnode);
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      this.unmount(node.childNodes[i]!);
    }
  }
}

export function mount(vnode: VNode | (() => VNode), container: Element): () => void {
  const renderer = new DOMRenderer();

  if (typeof vnode === 'function') {
    const dispose = effect(() => {
      const result = vnode();
      renderer.render(result, container);
    });
    return dispose;
  } else {
    renderer.render(vnode, container);
    return () => {
      renderer.render(null, container);
    };
  }
}
