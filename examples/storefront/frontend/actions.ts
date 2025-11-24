import { rpc, refreshWorld } from './api.ts';

async function callAndRefresh<T extends object>(method: string, params: T): Promise<void> {
  await rpc.call(method, params);
  await refreshWorld();
}

export async function addToCart(productEntity: number): Promise<void> {
  await callAndRefresh('addToCart', { productEntity });
}

export async function updateQuantity(productEntity: number, quantity: number): Promise<void> {
  await callAndRefresh('updateQuantity', { productEntity, quantity });
}

export async function removeFromCart(productEntity: number): Promise<void> {
  await callAndRefresh('removeFromCart', { productEntity });
}

export async function clearCart(): Promise<void> {
  await callAndRefresh('clearCart', {});
}

export async function setFilter(filterTag: string): Promise<void> {
  await callAndRefresh('setFilter', { filterTag });
}

export async function setSort(sort: string): Promise<void> {
  await callAndRefresh('setSort', { sort });
}

export async function setSearch(search: string): Promise<void> {
  await callAndRefresh('setSearch', { search });
}
