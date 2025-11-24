import { describe, it, expect } from 'vitest';
import { SSRRenderer, renderToString, renderDocument } from './ssr.js';
import { h, Fragment } from '../client/dom.js';
import { World } from '../core/world.js';
import { Render } from '../client/renderer.js';

describe('SSRRenderer', () => {
  let renderer: SSRRenderer;

  beforeEach(() => {
    renderer = new SSRRenderer();
  });

  describe('Basic Rendering', () => {
    it('should render simple element', () => {
      const vnode = h('div', null, 'Hello');
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div>Hello</div>');
    });

    it('should render nested elements', () => {
      const vnode = h('div', null, h('span', null, 'Hello'));
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div><span>Hello</span></div>');
    });

    it('should render multiple children', () => {
      const vnode = h('div', null, h('span', null, 'A'), h('span', null, 'B'));
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div><span>A</span><span>B</span></div>');
    });

    it('should render text nodes', () => {
      const vnode = h('div', null, 'Plain text');
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div>Plain text</div>');
    });

    it('should render null as empty string', () => {
      const html = renderer.renderToString(null);

      expect(html).toBe('');
    });

    it('should render fragments', () => {
      const vnode = h(Fragment, null, h('div', null, 'A'), h('div', null, 'B'));
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div>A</div><div>B</div>');
    });
  });

  describe('Attributes', () => {
    it('should render attributes', () => {
      const vnode = h('div', { id: 'test', 'data-value': '123' });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('id="test"');
      expect(html).toContain('data-value="123"');
    });

    it('should render className', () => {
      const vnode = h('div', { className: 'test-class' });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('class="test-class"');
    });

    it('should render boolean attributes', () => {
      const vnode = h('input', { type: 'checkbox', checked: true, disabled: false });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('checked');
      expect(html).not.toContain('disabled');
    });

    it('should skip event handlers', () => {
      const vnode = h('button', { onClick: () => {} });
      const html = renderer.renderToString(vnode);

      expect(html).not.toContain('onClick');
      expect(html).not.toContain('onclick');
    });

    it('should escape attribute values', () => {
      const vnode = h('div', { title: 'Test "quoted" & <escaped>' });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('&quot;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&lt;');
    });
  });

  describe('Style', () => {
    it('should render style object', () => {
      const vnode = h('div', { style: { color: 'red', fontSize: '16px' } });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('style="color:red;font-size:16px"');
    });

    it('should render style string', () => {
      const vnode = h('div', { style: 'color: red; font-size: 16px' });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('style="color: red; font-size: 16px"');
    });

    it('should convert camelCase to kebab-case', () => {
      const vnode = h('div', { style: { backgroundColor: 'blue' } });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('background-color:blue');
    });
  });

  describe('Self-closing Tags', () => {
    it('should render self-closing tags', () => {
      const vnode = h('img', { src: 'test.jpg', alt: 'Test' });
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<img src="test.jpg" alt="Test" />');
    });

    it('should render br as self-closing', () => {
      const vnode = h('br', null);
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<br />');
    });

    it('should render input as self-closing', () => {
      const vnode = h('input', { type: 'text' });
      const html = renderer.renderToString(vnode);

      expect(html).toContain('<input');
      expect(html).toContain('/>');
    });
  });

  describe('HTML Escaping', () => {
    it('should escape text content', () => {
      const vnode = h('div', null, '<script>alert("xss")</script>');
      const html = renderer.renderToString(vnode);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape ampersands', () => {
      const vnode = h('div', null, 'A & B');
      const html = renderer.renderToString(vnode);

      expect(html).toContain('A &amp; B');
    });

    it('should escape quotes', () => {
      const vnode = h('div', null, 'She said "Hello"');
      const html = renderer.renderToString(vnode);

      expect(html).toContain('&quot;');
    });

    it('should escape single quotes', () => {
      const vnode = h('div', null, "It's working");
      const html = renderer.renderToString(vnode);

      expect(html).toContain('&#39;');
    });
  });

  describe('Component Functions', () => {
    it('should render component functions', () => {
      const Component = () => h('div', null, 'Component');
      const vnode = h(Component, {});
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div>Component</div>');
    });

    it('should pass props to components', () => {
      const Component = (props: { text: string }) => h('div', null, props.text);
      const vnode = h(Component, { text: 'Hello' });
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div>Hello</div>');
    });

    it('should render nested components', () => {
      const Inner = (props: { text: string }) => h('span', null, props.text);
      const Outer = () => h('div', null, h(Inner, { text: 'Nested' }));
      const vnode = h(Outer, {});
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div><span>Nested</span></div>');
    });

    it('should handle components returning arrays', () => {
      const Component = () => [h('div', null, 'A'), h('div', null, 'B')];
      const vnode = h(Component, {});
      const html = renderer.renderToString(vnode);

      expect(html).toBe('<div>A</div><div>B</div>');
    });
  });
});

describe('renderToString', () => {
  it('should render vnode to HTML string', () => {
    const vnode = h('div', { id: 'test' }, 'Hello World');
    const html = renderToString(vnode);

    expect(html).toContain('<div');
    expect(html).toContain('id="test"');
    expect(html).toContain('Hello World');
  });
});

describe('renderDocument', () => {
  it('should render complete HTML document', () => {
    const world = new World();
    const entity = world.createEntity();

    world.addComponent(
      entity.id,
      Render.create({
        render: () => h('div', null, 'Hello World'),
      })
    );

    const html = renderDocument(world);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('Hello World');
  });

  it('should include custom title', () => {
    const world = new World();
    const html = renderDocument(world, {}, { title: 'Custom Title' });

    expect(html).toContain('<title>Custom Title</title>');
  });

  it('should include custom scripts', () => {
    const world = new World();
    const html = renderDocument(world, {}, { scripts: ['/app.js', '/vendor.js'] });

    expect(html).toContain('<script src="/app.js"></script>');
    expect(html).toContain('<script src="/vendor.js"></script>');
  });

  it('should include custom styles', () => {
    const world = new World();
    const html = renderDocument(world, {}, { styles: ['/app.css'] });

    expect(html).toContain('<link rel="stylesheet" href="/app.css">');
  });

  it('should include custom head content', () => {
    const world = new World();
    const html = renderDocument(world, {}, { head: '<meta name="description" content="Test">' });

    expect(html).toContain('<meta name="description" content="Test">');
  });

  it('should include body attributes', () => {
    const world = new World();
    const html = renderDocument(world, {}, { bodyAttributes: { class: 'dark-mode' } });

    expect(html).toContain('<body class="dark-mode">');
  });

  it('should include hydration data when requested', () => {
    const world = new World();
    const entity = world.createEntity();
    world.addComponent(
      entity.id,
      Render.create({
        render: () => h('div', null, 'Test'),
      })
    );

    const html = renderDocument(world, { includeHydrationData: true });

    expect(html).toContain('wecs-hydration-data');
    expect(html).toContain('application/json');
  });
});
