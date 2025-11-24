import { describe, it, expect, beforeEach } from 'vitest';
import { h, Fragment, Text, DOMRenderer, normalizeVNode, createRef } from './dom.js';

describe('h (createElement)', () => {
  it('should create vnode with type and props', () => {
    const vnode = h('div', { id: 'test' });

    expect(vnode.type).toBe('div');
    expect(vnode.props).toEqual({ id: 'test' });
  });

  it('should create vnode with children', () => {
    const vnode = h('div', null, 'Hello', 'World');

    expect(vnode.children).toEqual(['Hello', 'World']);
  });

  it('should flatten nested children', () => {
    const vnode = h('div', null, ['Hello', ['World']]);

    expect(vnode.children).toEqual(['Hello', 'World']);
  });

  it('should filter out null and undefined children', () => {
    const vnode = h('div', null, 'Hello', null, undefined, 'World');

    expect(vnode.children).toEqual(['Hello', 'World']);
  });

  it('should filter out boolean children', () => {
    const vnode = h('div', null, 'Hello', false, true, 'World');

    expect(vnode.children).toEqual(['Hello', 'World']);
  });

  it('should extract key from props', () => {
    const vnode = h('div', { key: 'test-key', id: 'test' });

    expect(vnode.key).toBe('test-key');
    expect(vnode.props).toEqual({ id: 'test' });
  });

  it('should extract ref from props', () => {
    const ref = createRef();
    const vnode = h('div', { ref, id: 'test' });

    expect(vnode.ref).toBe(ref);
    expect(vnode.props).toEqual({ id: 'test' });
  });

  it('should create fragment vnode', () => {
    const vnode = h(Fragment, null, 'child1', 'child2');

    expect(vnode.type).toBe(Fragment);
    expect(vnode.children).toHaveLength(2);
  });

  it('should handle component functions', () => {
    const Component = () => h('div', null, 'test');
    const vnode = h(Component, { prop: 'value' });

    expect(vnode.type).toBe(Component);
    expect(vnode.props).toEqual({ prop: 'value' });
  });
});

describe('normalizeVNode', () => {
  it('should return null for null', () => {
    expect(normalizeVNode(null)).toBe(null);
  });

  it('should return null for undefined', () => {
    expect(normalizeVNode(undefined)).toBe(null);
  });

  it('should return null for booleans', () => {
    expect(normalizeVNode(false)).toBe(null);
    expect(normalizeVNode(true)).toBe(null);
  });

  it('should convert string to text vnode', () => {
    const vnode = normalizeVNode('Hello');

    expect(vnode).not.toBe(null);
    expect(vnode!.type).toBe(Text);
    expect(vnode!.children).toEqual(['Hello']);
  });

  it('should convert number to text vnode', () => {
    const vnode = normalizeVNode(42);

    expect(vnode).not.toBe(null);
    expect(vnode!.type).toBe(Text);
    expect(vnode!.children).toEqual(['42']);
  });

  it('should return vnode as-is', () => {
    const original = h('div', null);
    const normalized = normalizeVNode(original);

    expect(normalized).toBe(original);
  });
});

describe('createRef', () => {
  it('should create ref with null current', () => {
    const ref = createRef();

    expect(ref.current).toBe(null);
  });

  it('should allow setting current', () => {
    const ref = createRef<HTMLDivElement>();
    const element = document.createElement('div');

    ref.current = element;

    expect(ref.current).toBe(element);
  });
});

describe('DOMRenderer', () => {
  let renderer: DOMRenderer;
  let container: HTMLDivElement;

  beforeEach(() => {
    renderer = new DOMRenderer();
    container = document.createElement('div');
  });

  describe('Initial Render', () => {
    it('should render simple element', () => {
      const vnode = h('div', { id: 'test' }, 'Hello');

      renderer.render(vnode, container);

      expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
      expect((container.firstChild as HTMLElement).id).toBe('test');
      expect(container.textContent).toBe('Hello');
    });

    it('should render nested elements', () => {
      const vnode = h('div', null, h('span', null, 'Hello'), h('span', null, 'World'));

      renderer.render(vnode, container);

      expect(container.querySelectorAll('span')).toHaveLength(2);
    });

    it('should handle text nodes', () => {
      const vnode = h('div', null, 'Plain text');

      renderer.render(vnode, container);

      expect(container.textContent).toBe('Plain text');
    });

    it('should render fragments', () => {
      const vnode = h(Fragment, null, h('div', null, '1'), h('div', null, '2'));

      renderer.render(vnode, container);

      expect(container.children).toHaveLength(2);
    });

    it('should handle null vnode', () => {
      renderer.render(null, container);

      expect(container.childNodes).toHaveLength(0);
    });
  });

  describe('Props', () => {
    it('should set className', () => {
      const vnode = h('div', { className: 'test-class' });

      renderer.render(vnode, container);

      expect((container.firstChild as HTMLElement).className).toBe('test-class');
    });

    it('should set style object', () => {
      const vnode = h('div', { style: { color: 'red', fontSize: '16px' } });

      renderer.render(vnode, container);

      const element = container.firstChild as HTMLElement;
      expect(element.style.color).toBe('red');
      expect(element.style.fontSize).toBe('16px');
    });

    it('should set style string', () => {
      const vnode = h('div', { style: 'color: red' });

      renderer.render(vnode, container);

      expect((container.firstChild as HTMLElement).style.cssText).toContain('color');
    });

    it('should set attributes', () => {
      const vnode = h('div', { 'data-test': 'value' });

      renderer.render(vnode, container);

      expect((container.firstChild as HTMLElement).getAttribute('data-test')).toBe('value');
    });

    it('should handle boolean attributes', () => {
      const vnode = h('input', { type: 'checkbox', checked: true });

      renderer.render(vnode, container);

      expect((container.firstChild as HTMLInputElement).checked).toBe(true);
    });

    it('should set ref', () => {
      const ref = createRef<HTMLDivElement>();
      const vnode = h('div', { ref });

      renderer.render(vnode, container);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Updates', () => {
    it('should update text content', () => {
      const vnode1 = h('div', null, 'Hello');
      const vnode2 = h('div', null, 'World');

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect(container.textContent).toBe('World');
    });

    it('should update props', () => {
      const vnode1 = h('div', { id: 'old' });
      const vnode2 = h('div', { id: 'new' });

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect((container.firstChild as HTMLElement).id).toBe('new');
    });

    it('should add new props', () => {
      const vnode1 = h('div', {});
      const vnode2 = h('div', { id: 'test' });

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect((container.firstChild as HTMLElement).id).toBe('test');
    });

    it('should remove props', () => {
      const vnode1 = h('div', { id: 'test' });
      const vnode2 = h('div', {});

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect((container.firstChild as HTMLElement).hasAttribute('id')).toBe(false);
    });

    it('should replace element with different type', () => {
      const vnode1 = h('div', null, 'test');
      const vnode2 = h('span', null, 'test');

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect(container.firstChild).toBeInstanceOf(HTMLSpanElement);
    });

    it('should update children', () => {
      const vnode1 = h('div', null, h('span', null, '1'), h('span', null, '2'));
      const vnode2 = h('div', null, h('span', null, '1'), h('span', null, '2'), h('span', null, '3'));

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect(container.querySelectorAll('span')).toHaveLength(3);
    });

    it('should remove children', () => {
      const vnode1 = h('div', null, h('span', null, '1'), h('span', null, '2'));
      const vnode2 = h('div', null, h('span', null, '1'));

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect(container.querySelectorAll('span')).toHaveLength(1);
    });

    it('should handle keyed children', () => {
      const vnode1 = h('div', null, h('span', { key: 'a' }, 'A'), h('span', { key: 'b' }, 'B'));
      const vnode2 = h('div', null, h('span', { key: 'b' }, 'B'), h('span', { key: 'a' }, 'A'));

      renderer.render(vnode1, container);
      const firstSpan = container.firstChild!.childNodes[0];

      renderer.render(vnode2, container);

      expect(container.textContent).toBe('BA');
    });
  });

  describe('Component Functions', () => {
    it('should render component function', () => {
      const Component = () => h('div', null, 'Component');
      const vnode = h(Component, {});

      renderer.render(vnode, container);

      expect(container.textContent).toBe('Component');
    });

    it('should pass props to component function', () => {
      const Component = (props: { text: string }) => h('div', null, props.text);
      const vnode = h(Component, { text: 'Hello' });

      renderer.render(vnode, container);

      expect(container.textContent).toBe('Hello');
    });

    it('should update component props', () => {
      const Component = (props: { text: string }) => h('div', null, props.text);

      const vnode1 = h(Component, { text: 'Hello' });
      const vnode2 = h(Component, { text: 'World' });

      renderer.render(vnode1, container);
      renderer.render(vnode2, container);

      expect(container.textContent).toBe('World');
    });
  });

  describe('Cleanup', () => {
    it('should clear ref on unmount', () => {
      const ref = createRef<HTMLDivElement>();
      const vnode = h('div', { ref });

      renderer.render(vnode, container);
      expect(ref.current).not.toBe(null);

      renderer.render(null, container);
      expect(ref.current).toBe(null);
    });

    it('should clean up on replace', () => {
      const ref1 = createRef<HTMLDivElement>();
      const ref2 = createRef<HTMLSpanElement>();

      const vnode1 = h('div', { ref: ref1 });
      const vnode2 = h('span', { ref: ref2 });

      renderer.render(vnode1, container);
      expect(ref1.current).not.toBe(null);

      renderer.render(vnode2, container);
      expect(ref1.current).toBe(null);
      expect(ref2.current).not.toBe(null);
    });
  });
});
