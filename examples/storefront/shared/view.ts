import { h, Fragment } from '../../../src/client/dom.ts';
import type { World } from '../../../src/core/world.ts';
import { Render } from '../../../src/client/renderer.ts';
import { Cart, CartComponent } from './cart.ts';
import { Product, ProductComponent } from './product.ts';
import { UiState, UiStateComponent } from './uiState.ts';

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function callAction(name: string, ...args: any[]): void {
  const fn = (globalThis as any)[name];
  if (typeof fn === 'function') {
    fn(...args);
  }
}

function getProducts(world: World): Array<{ id: number; comp: ProductComponent }> {
  const query = world.query({ all: [Product.id] });
  return Array.from(query.execute()).map(id => ({
    id,
    comp: world.getComponent<ProductComponent>(id, Product.id)!,
  }));
}

function getCart(world: World): CartComponent | null {
  const query = world.query({ all: [Cart.id] });
  const id = query.first();
  if (!id) return null;
  return world.getComponent<CartComponent>(id, Cart.id) ?? null;
}

function getUiState(world: World): UiStateComponent | null {
  const query = world.query({ all: [UiState.id] });
  const id = query.first();
  if (!id) return null;
  return world.getComponent<UiStateComponent>(id, UiState.id) ?? null;
}

export function renderStorefront(world: World) {
  const state = getUiState(world);
  const cart = getCart(world);
  const products = getProducts(world);

  if (!state || !cart) {
    return h('div', null, 'Storefront unavailable');
  }

  const filtered = products
    .filter(({ comp }) => {
      const tagMatch = state.filterTag === 'all' || comp.tags.includes(state.filterTag);
      const search = state.search.trim().toLowerCase();
      const searchMatch =
        search.length === 0 ||
        comp.name.toLowerCase().includes(search) ||
        comp.description.toLowerCase().includes(search);
      return tagMatch && searchMatch;
    })
    .sort((a, b) => {
      switch (state.sort) {
        case 'price-asc':
          return a.comp.price - b.comp.price;
        case 'price-desc':
          return b.comp.price - a.comp.price;
        case 'rating':
          return b.comp.rating - a.comp.rating;
        default:
          return (b.comp.badge ? 1 : 0) - (a.comp.badge ? 1 : 0);
      }
    });

  const cartLines = Array.isArray(cart.lines) ? cart.lines : [];

  const cartTotal = cartLines.reduce((sum, line) => {
    const product = world.getComponent<ProductComponent>(line.productEntity, Product.id);
    return product ? sum + product.price * line.quantity : sum;
  }, 0);

  const hero = h(
    'section',
    { className: 'hero' },
    h('div', { className: 'hero__copy' },
      h('p', { className: 'eyebrow' }, 'New collection'),
      h('h1', null, 'Minimal hardware for intentional spaces'),
      h('p', { className: 'lede' },
        'A curated shop of tactile objects designed to last. Carbon-neutral shipping on all orders.'
      ),
      h('div', { className: 'cta-row' },
        h('button', { className: 'btn primary', onclick: () => callAction('setFilter', 'all') }, 'View all'),
        h('button', { className: 'btn ghost', onclick: () => callAction('setFilter', 'lighting') }, 'Lighting')
      )
    ),
    h('div', { className: 'hero__media' },
      h('div', { className: 'badge' }, 'Free 30-day returns'),
      h('div', { className: 'hero-card' },
        h('span', { className: 'pill' }, 'In-stock picks'),
        h('strong', null, 'Built for quiet, focused workspaces'),
        h('small', null, 'Curated weekly by our design team.')
      )
    )
  );

  const filters = h(
    'section',
    { className: 'filters' },
    h('div', { className: 'chip-row' },
      ...['all', 'lighting', 'work', 'audio', 'kitchen', 'textiles', 'smart-home'].map(tag =>
        h(
          'button',
          {
            className: `chip ${state.filterTag === tag ? 'chip--active' : ''}`,
            onclick: () => callAction('setFilter', tag),
          },
          tag === 'all' ? 'All items' : tag.replace('-', ' ')
        )
      )
    ),
    h('div', { className: 'controls' },
      h('input', {
        id: 'search',
        type: 'search',
        placeholder: 'Search products...',
        value: state.search,
        oninput: (e: Event) => callAction('setSearch', (e.target as HTMLInputElement).value),
      }),
      h('select', { onchange: (e: Event) => callAction('setSort', (e.target as HTMLSelectElement).value) },
        h('option', { value: 'featured', selected: state.sort === 'featured' }, 'Featured'),
        h('option', { value: 'price-asc', selected: state.sort === 'price-asc' }, 'Price: Low to High'),
        h('option', { value: 'price-desc', selected: state.sort === 'price-desc' }, 'Price: High to Low'),
        h('option', { value: 'rating', selected: state.sort === 'rating' }, 'Rating')
      )
    )
  );

  const grid = h(
    'section',
    { className: 'grid' },
    ...filtered.map(({ id, comp }) =>
      h(
        'article',
        { className: 'card' },
        comp.badge ? h('span', { className: 'pill pill--accent' }, comp.badge) : null,
        h('div', {
          className: 'card__image',
          style: `background-image: linear-gradient(120deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02)), url('${comp.image}')`,
        }),
        h('div', { className: 'card__body' },
          h('div', { className: 'card__meta' },
            h('h3', null, comp.name),
            h('span', { className: 'price' }, formatPrice(comp.price))
          ),
          h('p', { className: 'muted' }, comp.description),
          h('div', { className: 'tag-row' },
            ...comp.tags.map(tag => h('span', { className: 'pill pill--ghost' }, tag))
          ),
          h('div', { className: 'card__actions' },
            h('button', { className: 'btn primary', onclick: () => callAction('addToCart', id) }, 'Add to cart'),
            h('span', { className: 'muted' }, `${comp.stock} in stock`)
          )
        )
      )
    )
  );

  const cartList =
    cartLines.length === 0
      ? [h('p', { className: 'muted' }, 'Your cart is empty.')]
      : cartLines.map(line => {
          const product = world.getComponent<ProductComponent>(line.productEntity, Product.id);
          if (!product) {
            return null;
          }
          return h(
            'div',
            { className: 'cart-line' },
            h('div', null,
              h('strong', null, product.name),
              h('p', { className: 'muted' }, formatPrice(product.price))
            ),
            h('div', { className: 'qty' },
              h('button', { onclick: () => callAction('updateQuantity', line.productEntity, line.quantity - 1) }, '−'),
              h('span', null, String(line.quantity)),
              h('button', { onclick: () => callAction('updateQuantity', line.productEntity, line.quantity + 1) }, '+')
            ),
            h('button', { className: 'link', onclick: () => callAction('removeFromCart', line.productEntity) }, 'Remove')
          );
        }).filter(Boolean);

  const cartSummary = h(
    'aside',
    { className: 'cart' },
    h('h3', null, 'Cart'),
    ...cartList,
    h('div', { className: 'cart__footer' },
      h('strong', null, `Total ${formatPrice(cartTotal)}`),
      h('button', { className: 'btn secondary', onclick: () => callAction('clearCart') }, 'Clear cart')
    )
  );

  return h(
    Fragment,
    null,
    h(
      'div',
      { className: 'layout' },
      hero,
      filters,
      h('div', { className: 'content' }, grid, cartSummary)
    )
  );
}

export function mountRenderEntity(world: World): void {
  // Remove any stale render entities (e.g., from snapshot restores)
  const existing = world.query({ all: [Render.id] });
  for (const id of existing.execute()) {
    world.destroyEntity(id);
  }

  const entity = world.createEntity();
  world.addComponent(
    entity.id,
    Render.create({
      render: () => renderStorefront(world),
      priority: 1,
    })
  );
}
