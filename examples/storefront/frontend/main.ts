import { createRenderSystem } from '../../../src/client/renderer.ts';
import { world, ensureRegisteredComponents, refreshWorld } from './api.ts';
import { mountRenderEntity } from '../shared/view.ts';
import * as actions from './actions.ts';

async function init(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) {
    console.error('Missing #app container');
    return;
  }

  ensureRegisteredComponents();

  // Start from scratch on the client to avoid SSR duplicates and stale handlers.
  root.innerHTML = '';

  await refreshWorld();
  mountRenderEntity(world);

  const renderSystem = createRenderSystem(root);
  world.addSystem(renderSystem);

  await world.init();
  world.start();
}

declare global {
  interface Window {
    addToCart: (productEntity: number) => void;
    updateQuantity: (productEntity: number, quantity: number) => void;
    removeFromCart: (productEntity: number) => void;
    clearCart: () => void;
    setFilter: (filterTag: string) => void;
    setSort: (sort: string) => void;
    setSearch: (search: string) => void;
  }
}

Object.assign(window, {
  addToCart: (id: number) => actions.addToCart(id),
  updateQuantity: (id: number, qty: number) => actions.updateQuantity(id, qty),
  removeFromCart: (id: number) => actions.removeFromCart(id),
  clearCart: () => actions.clearCart(),
  setFilter: (tag: string) => actions.setFilter(tag),
  setSort: (sort: string) => actions.setSort(sort),
  setSearch: (search: string) => actions.setSearch(search),
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => console.error(err));
  });
} else {
  init().catch(err => console.error(err));
}
