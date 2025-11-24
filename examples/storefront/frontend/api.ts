import { World } from '../../../src/core/world.ts';
import { createRPCClient } from '../../../src/server/rpc.ts';
import { createSerializer } from '../../../src/shared/serialization.ts';
import { Product, Cart, UiState } from '../shared/index.ts'; // ensure component classes are registered for hydration

export const world = new World();
export const serializer = createSerializer();
export const rpc = createRPCClient();

export function ensureRegisteredComponents(): string[] {
  // Touch the component ids so tree-shaking can't drop registration side effects.
  return [Product.id, Cart.id, UiState.id];
}

rpc.onRequest(request => {
  fetch('/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
    .then(res => res.json())
    .then(response => rpc.handleResponse(response))
    .catch(error => console.error('RPC error', error));
});

export async function refreshWorld(): Promise<void> {
  const res = await fetch('/api/snapshot');
  if (!res.ok) {
    console.error('[API] Snapshot fetch failed:', res.status);
    return;
  }
  const snapshot = await res.json();
  serializer.restoreSnapshot(world, snapshot);
}
