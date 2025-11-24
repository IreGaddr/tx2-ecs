/**
 * Server-side rendering system
 */

import { World } from '../core/world.js';
import { EntityId } from '../core/entity.js';
import { VNode, Fragment, Text, h } from '../client/dom.js';
import { RenderComponent, Render, TransformComponent, Transform } from '../client/renderer.js';
import { HydrationManager, HYDRATION_ATTR } from '../shared/hydration.js';

export interface SSRContext {
  world: World;
  hydrationManager: HydrationManager;
}

export interface SSROptions {
  includeHydrationData?: boolean;
  prettyPrint?: boolean;
}

export class SSRRenderer {
  private selfClosingTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);

  renderToString(vnode: VNode | null, context?: SSRContext): string {
    if (!vnode) {
      return '';
    }

    if (vnode.type === Text) {
      return this.escapeHtml(String(vnode.children[0] ?? ''));
    }

    if (vnode.type === Fragment) {
      return vnode.children
        .map(child => {
          if (typeof child === 'string' || typeof child === 'number') {
            return this.escapeHtml(String(child));
          }
          if (child && typeof child === 'object' && 'type' in child) {
            return this.renderToString(child, context);
          }
          return '';
        })
        .join('');
    }

    if (typeof vnode.type === 'function') {
      const result = vnode.type(vnode.props || {});
      if (Array.isArray(result)) {
        return result
          .map(child => this.renderToString(child, context))
          .join('');
      }
      return this.renderToString(result, context);
    }

    const tag = vnode.type as string;
    const props = vnode.props || {};
    const attributes = this.renderAttributes(props);
    const isSelfClosing = this.selfClosingTags.has(tag);

    if (isSelfClosing) {
      return `<${tag}${attributes} />`;
    }

    const childrenHtml = vnode.children
      .map(child => {
        if (typeof child === 'string' || typeof child === 'number') {
          return this.escapeHtml(String(child));
        }
        if (child && typeof child === 'object' && 'type' in child) {
          return this.renderToString(child, context);
        }
        return '';
      })
      .join('');

    return `<${tag}${attributes}>${childrenHtml}</${tag}>`;
  }

  private renderAttributes(props: Record<string, any>): string {
    const attributes: string[] = [];

    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) {
        continue;
      }

      if (key.startsWith('on')) {
        continue;
      }

      if (key === 'className' || key === 'class') {
        attributes.push(`class="${this.escapeHtml(value)}"`);
        continue;
      }

      if (key === 'style') {
        const styleStr = this.renderStyle(value);
        if (styleStr) {
          attributes.push(`style="${this.escapeHtml(styleStr)}"`);
        }
        continue;
      }

      if (key === 'dangerouslySetInnerHTML') {
        continue;
      }

      if (value === true) {
        attributes.push(key);
      } else {
        attributes.push(`${key}="${this.escapeHtml(String(value))}"`);
      }
    }

    return attributes.length > 0 ? ' ' + attributes.join(' ') : '';
  }

  private renderStyle(style: any): string {
    if (typeof style === 'string') {
      return style;
    }

    if (typeof style === 'object' && style !== null) {
      return Object.entries(style)
        .map(([key, value]) => {
          const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${kebabKey}:${value}`;
        })
        .join(';');
    }

    return '';
  }

  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, char => htmlEscapes[char] || char);
  }

  renderEntity(entityId: EntityId, world: World, hydrationManager?: HydrationManager): string {
    const entity = world.getEntity(entityId);
    if (!entity) {
      return '';
    }

    const renderComp = world.getComponent<RenderComponent>(entityId, Render.id);
    if (!renderComp) {
      return '';
    }

    const vnode = renderComp.render(entity, world);
    if (!vnode) {
      return '';
    }

    let finalVNode: VNode;

    if (Array.isArray(vnode)) {
      finalVNode = h(Fragment, null, ...vnode);
    } else {
      finalVNode = vnode;
    }

    if (hydrationManager && finalVNode.type !== Text && finalVNode.type !== Fragment) {
      const props = finalVNode.props || {};
      finalVNode = {
        ...finalVNode,
        props: {
          ...props,
          [HYDRATION_ATTR]: String(entityId),
        },
      };
    }

    return this.renderToString(finalVNode);
  }

  renderEntityHierarchy(entityId: EntityId, world: World, hydrationManager?: HydrationManager): string {
    const html = this.renderEntity(entityId, world, hydrationManager);

    const transform = world.getComponent<TransformComponent>(entityId, Transform.id);
    if (transform && transform.children.length > 0) {
      const childrenHtml = transform.children
        .map(childId => this.renderEntityHierarchy(childId, world, hydrationManager))
        .join('');

      return html + childrenHtml;
    }

    return html;
  }

  renderWorld(world: World, options: SSROptions = {}): string {
    const hydrationManager = options.includeHydrationData ? new HydrationManager() : undefined;

    const query = world.query({ all: [Render.id], none: [Transform.id] });
    const rootEntities = query.execute();

    const htmlParts: string[] = [];

    for (const entityId of rootEntities) {
      htmlParts.push(this.renderEntityHierarchy(entityId, world, hydrationManager));
    }

    const transformQuery = world.query({ all: [Render.id, Transform.id] });
    for (const entityId of transformQuery.execute()) {
      const transform = world.getComponent<TransformComponent>(entityId, Transform.id);
      if (!transform?.parent) {
        htmlParts.push(this.renderEntityHierarchy(entityId, world, hydrationManager));
      }
    }

    let html = htmlParts.join('');

    if (options.includeHydrationData && hydrationManager) {
      const hydrationData = hydrationManager.createHydrationData(world);
      const escapeJsonForScript = (json: string) => {
        return json
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u003e')
          .replace(/\//g, '\\u002f')
          .replace(/\u2028/g, '\\u2028')
          .replace(/\u2029/g, '\\u2029');
      };

      html += `\n<script type="application/json" id="wecs-hydration-data">${escapeJsonForScript(JSON.stringify(hydrationData))}</script>`;
    }

    if (options.prettyPrint) {
      html = this.prettyPrint(html);
    }

    return html;
  }

  private prettyPrint(html: string): string {
    let formatted = '';
    let indent = 0;
    const tab = '  ';

    const tokens = html.split(/(<[^>]+>)/g).filter(token => token.trim());

    for (const token of tokens) {
      if (token.startsWith('</')) {
        indent = Math.max(0, indent - 1);
        formatted += tab.repeat(indent) + token + '\n';
      } else if (token.startsWith('<')) {
        formatted += tab.repeat(indent) + token + '\n';
        if (!token.endsWith('/>') && !this.selfClosingTags.has(token.slice(1, -1).split(/\s/)[0] || '')) {
          indent++;
        }
      } else {
        formatted += tab.repeat(indent) + token.trim() + '\n';
      }
    }

    return formatted;
  }
}

export function renderToString(vnode: VNode | null, _options?: SSROptions): string {
  const renderer = new SSRRenderer();
  return renderer.renderToString(vnode);
}

export function renderWorldToString(world: World, options?: SSROptions): string {
  const renderer = new SSRRenderer();
  return renderer.renderWorld(world, options);
}

export interface DocumentOptions {
  title?: string;
  head?: string;
  bodyAttributes?: Record<string, string>;
  scripts?: string[];
  styles?: string[];
}

export function renderDocument(world: World, ssrOptions?: SSROptions, docOptions?: DocumentOptions): string {
  const body = renderWorldToString(world, ssrOptions);

  const title = docOptions?.title ?? 'WECS App';
  const head = docOptions?.head ?? '';
  const bodyAttrs = docOptions?.bodyAttributes
    ? ' ' + Object.entries(docOptions.bodyAttributes).map(([k, v]) => `${k}="${v}"`).join(' ')
    : '';
  const scripts = docOptions?.scripts ?? [];
  const styles = docOptions?.styles ?? [];

  const stylesTags = styles.map(href => `<link rel="stylesheet" href="${href}">`).join('\n');
  const scriptTags = scripts.map(src => `<script src="${src}"></script>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${stylesTags}
  ${head}
</head>
<body${bodyAttrs}>
  <div id="app">${body}</div>
  ${scriptTags}
</body>
</html>`;
}
