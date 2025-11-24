/**
 * Storefront backend entrypoint (SSR + RPC + snapshot API).
 */

import http from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { World } from '../../../src/core/world.ts';
import { renderDocument } from '../../../src/server/ssr.ts';
import { createSerializer } from '../../../src/shared/serialization.ts';
import { Render } from '../../../src/client/renderer.ts';
import { CartComponent, UiStateComponent, ProductComponent } from '../shared/index.ts';
import { catalogSeed } from './catalog.ts';
import { mountRenderEntity } from './view.ts';
import { createRpcRegistry } from './rpc.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const world = new World();
const serializer = createSerializer();

function seedProducts(): void {
  for (const entry of catalogSeed) {
    const entity = world.createEntity();
    const product = new ProductComponent(entry);
    world.addComponent(entity.id, product);
  }
}

function createCartEntity(): number {
  const entity = world.createEntity();
  world.addComponent(entity.id, new CartComponent());
  return entity.id;
}

function createUiStateEntity(): number {
  const entity = world.createEntity();
  world.addComponent(
    entity.id,
    new UiStateComponent({
      search: '',
      filterTag: 'all',
      sort: 'featured',
    })
  );
  return entity.id;
}

seedProducts();
const cartEntityId = createCartEntity();
const uiStateEntityId = createUiStateEntity();

const rpcRegistry = createRpcRegistry({ world });

function inlineStyles(): string {
  return `
    :root {
      --bg: #0f172a;
      --panel: #0b1224;
      --muted: #9fb0c6;
      --accent: #7c3aed;
      --primary: #e2e8f0;
      --border: #1e293b;
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: var(--bg); color: var(--primary); font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    a { color: inherit; }
    .layout { max-width: 1200px; margin: 0 auto; padding: 32px 24px 72px; display: flex; flex-direction: column; gap: 32px; }
    .hero { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: center; background: linear-gradient(135deg, rgba(124,58,237,.15), rgba(14,165,233,.12)); border: 1px solid var(--border); border-radius: 16px; padding: 28px; }
    .hero__copy h1 { margin: 12px 0 8px; font-size: 34px; line-height: 1.1; }
    .hero__copy .lede { color: var(--muted); margin: 0; }
    .hero__media { justify-self: end; display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
    .hero-card { background: rgba(15,23,42,0.65); border: 1px solid var(--border); border-radius: 12px; padding: 16px; width: 100%; max-width: 320px; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-size: 12px; margin: 0; }
    .lede { font-size: 15px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 4px 10px; font-size: 12px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--primary); }
    .pill--accent { background: rgba(124,58,237,0.15); border-color: rgba(124,58,237,0.4); color: #dcd3ff; }
    .pill--ghost { background: rgba(255,255,255,0.02); }
    .btn { border: 1px solid var(--border); background: rgba(255,255,255,0.02); color: var(--primary); padding: 10px 14px; border-radius: 10px; font-weight: 600; cursor: pointer; }
    .btn.primary { background: linear-gradient(135deg, #7c3aed, #0ea5e9); border: none; color: white; }
    .btn.secondary { background: rgba(255,255,255,0.08); }
    .btn.ghost { background: transparent; }
    .btn:hover { opacity: 0.92; }
    .cta-row { display: flex; gap: 10px; margin-top: 12px; }
    .filters { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; flex-wrap: wrap; }
    .chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--muted); border-radius: 999px; padding: 8px 12px; cursor: pointer; }
    .chip--active { color: white; border-color: #7c3aed; box-shadow: 0 0 0 1px rgba(124,58,237,0.5); }
    .controls { display: flex; gap: 12px; align-items: center; }
    input, select { background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--primary); padding: 10px 12px; border-radius: 10px; }
    input::placeholder { color: var(--muted); }
    .content { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; gap: 12px; }
    .card__image { height: 180px; background-size: cover; background-position: center; border-bottom: 1px solid var(--border); }
    .card__body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .card__meta { display: flex; align-items: center; justify-content: space-between; }
    .muted { color: var(--muted); margin: 0; }
    .price { font-weight: 700; }
    .tag-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .card__actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .cart { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; position: sticky; top: 20px; display: flex; flex-direction: column; gap: 12px; }
    .cart-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .qty { display: inline-flex; align-items: center; gap: 8px; }
    .qty button { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: var(--primary); cursor: pointer; }
    .link { background: none; border: none; color: #93c5fd; cursor: pointer; }
    .cart__footer { display: flex; align-items: center; justify-content: space-between; }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; }
      .content { grid-template-columns: 1fr; }
      .cart { position: relative; top: auto; }
    }
  `;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    // Create temporary render entity for SSR
    mountRenderEntity(world);

    const html = renderDocument(
      world,
      { includeHydrationData: true },
      {
        title: 'WECS Storefront',
        scripts: ['/client.js'],
        head: `<style>${inlineStyles()}</style>`,
      }
    );

    // Remove render entity after SSR to prevent it from being included in snapshots
    const renderQuery = world.query({ all: [Render.id] });
    for (const id of renderQuery.execute()) {
      world.destroyEntity(id);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && req.url === '/client.js') {
    try {
      const { readFile } = await import('fs/promises');
      const code = await readFile(join(projectRoot, 'frontend', 'dist', 'client.js'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(code);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Missing client bundle. Run: node examples/storefront/frontend/build.js');
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/rpc') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const ip = req.socket.remoteAddress || '127.0.0.1';
        const response = await rpcRegistry.execute(request, { world, ip });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/snapshot') {
    const snapshot = serializer.createSnapshot(world, {
      excludeComponents: new Set([Render.id]),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(snapshot));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Storefront running at http://localhost:${PORT}`);
});
