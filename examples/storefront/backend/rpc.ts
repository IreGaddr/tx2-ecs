import { createRPCRegistry, defineRPC, RPCError } from '../../../src/server/rpc.ts';
import { World } from '../../../src/core/world.ts';
import { Cart, CartComponent, Product, ProductComponent, UiState, UiStateComponent } from '../shared/index.ts';
import type { SortOption } from '../shared/uiState.ts';

interface RpcContext {
  world: World;
}

function getProduct(world: World, entityId: number): ProductComponent | null {
  return world.getComponent<ProductComponent>(entityId, Product.id) ?? null;
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

export function createRpcRegistry(ctx: RpcContext) {
  const registry = createRPCRegistry();

  registry.register(
    defineRPC('addToCart', async (args: { productEntity: number; quantity?: number }) => {
      const product = getProduct(ctx.world, args.productEntity);
      if (!product) throw new RPCError('NOT_FOUND', 'Product not found');
      if (product.stock <= 0) {
        throw new RPCError('OUT_OF_STOCK', 'Item is out of stock');
      }
      const cart = getCart(ctx.world);
      if (!cart) throw new RPCError('INVARIANT', 'Cart missing');

      // Get current quantity and add to it
      const currentLine = cart.lines.find(line => line.productEntity === args.productEntity);
      const currentQty = currentLine?.quantity ?? 0;
      const qtyToAdd = Math.max(1, args.quantity ?? 1);
      const newQty = currentQty + qtyToAdd;

      if (newQty > product.stock) {
        throw new RPCError('OUT_OF_STOCK', 'Not enough stock');
      }

      cart.upsert(args.productEntity, newQty);
      return { success: true };
    })
  );

  registry.register(
    defineRPC('updateQuantity', async (args: { productEntity: number; quantity: number }) => {
      const product = getProduct(ctx.world, args.productEntity);
      if (!product) throw new RPCError('NOT_FOUND', 'Product not found');
      const qty = Math.max(0, args.quantity);
      const cart = getCart(ctx.world);
      if (!cart) throw new RPCError('INVARIANT', 'Cart missing');
      if (qty === 0) {
        cart.remove(args.productEntity);
        return { success: true };
      }
      if (qty > product.stock) {
        throw new RPCError('OUT_OF_STOCK', 'Not enough stock');
      }
      cart.upsert(args.productEntity, qty);
      return { success: true };
    })
  );

  registry.register(
    defineRPC('removeFromCart', async (args: { productEntity: number }) => {
      const cart = getCart(ctx.world);
      if (!cart) throw new RPCError('INVARIANT', 'Cart missing');
      cart.remove(args.productEntity);
      return { success: true };
    })
  );

  registry.register(
    defineRPC('clearCart', async () => {
      const cart = getCart(ctx.world);
      if (!cart) throw new RPCError('INVARIANT', 'Cart missing');
      cart.clear();
      return { success: true };
    })
  );

  registry.register(
    defineRPC('setFilter', async (args: { filterTag: string }) => {
      const state = getUiState(ctx.world);
      if (state) state.filterTag = args.filterTag;
      return { success: true };
    })
  );

  registry.register(
    defineRPC('setSort', async (args: { sort: SortOption }) => {
      const state = getUiState(ctx.world);
      if (state) state.sort = args.sort;
      return { success: true };
    })
  );

  registry.register(
    defineRPC('setSearch', async (args: { search: string }) => {
      const state = getUiState(ctx.world);
      if (state) state.search = args.search;
      return { success: true };
    })
  );

  return registry;
}
