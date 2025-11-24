# TX-2 - Web Entity Component System
In 1963, Ivan Sutherland invented the perfect data structure for interactive graphics. We ignored it for 60 years. It's time to bring it back.
A fullstack Entity Component System framework for building reactive web applications with first-class support for server-side rendering, state synchronization, and real-time updates.

## Features

### Core ECS Architecture
- **Entities**: Unique identifiers for game objects, UI elements, or any application concept
- **Components**: Pure data containers with reactive properties
- **Systems**: Functions that process entities with specific components
- **Queries**: Efficient filtering of entities by component requirements with caching and indexing

### Reactive System
- **Fine-grained reactivity**: Signals, computed values, and effects with automatic dependency tracking
- **Batched updates**: Efficient update batching for optimal performance
- **Cycle detection**: Prevents infinite loops in reactive graphs
- **Automatic cleanup**: Memory-safe reactive subscriptions

### Client-Side Rendering
- **Reactive DOM updates**: Efficient DOM manipulation based on component changes
- **Virtual DOM**: Minimal re-renders with intelligent diffing
- **Component hierarchy**: Transform-based parent-child relationships
- **Event handling**: First-class event support with proper cleanup

### Server-Side Rendering (SSR)
- **HTML generation**: Render entities to HTML strings on the server
- **Hydration markers**: Automatic injection of hydration data
- **SEO-friendly**: Full HTML sent to clients for better SEO
- **Performance**: Fast initial page loads with progressive enhancement

### State Synchronization
- **Delta compression**: Only sync what changed between snapshots
- **Bidirectional sync**: Client-server and server-client synchronization
- **Configurable modes**: Full snapshot, delta-only, or manual sync
- **Filtering**: Include/exclude specific entities or components from sync

### RPC System
- **Type-safe calls**: Define remote procedures with full TypeScript support
- **Rate limiting**: Built-in rate limiting per method
- **Authentication**: Optional auth requirements per RPC method
- **Error handling**: Structured error responses with error codes

### Isomorphic Architecture
- **Shared code**: Write component definitions once, use everywhere
- **Component serialization**: Automatic serialization/deserialization
- **Universal queries**: Same query API on client and server
- **Cross-platform**: Works in Node.js and browsers

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        TX-2 Core                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ Entities │  │Components│  │ Systems  │  │ Queries ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│                                                          │
│                   ┌──────────────┐                      │
│                   │  Reactive    │                      │
│                   │   System     │                      │
│                   └──────────────┘                      │
└─────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌─────────────────────────┐
│      Client-Side     │      │      Server-Side        │
│  ┌────────────────┐  │      │  ┌──────────────────┐  │
│  │ DOM Renderer   │  │      │  │  SSR Renderer    │  │
│  └────────────────┘  │      │  └──────────────────┘  │
│  ┌────────────────┐  │      │  ┌──────────────────┐  │
│  │   Hydration    │  │      │  │   RPC Registry   │  │
│  └────────────────┘  │      │  └──────────────────┘  │
└──────────────────────┘      └─────────────────────────┘
           │                              │
           └──────────────┬───────────────┘
                          ▼
              ┌───────────────────────┐
              │   State Sync Layer    │
              │  ┌─────────────────┐  │
              │  │ Serialization   │  │
              │  └─────────────────┘  │
              │  ┌─────────────────┐  │
              │  │ Delta Compress  │  │
              │  └─────────────────┘  │
              └───────────────────────┘
```

## Quick Start

### Installation

```bash
npm install tx2-ecs
```

### Basic Example

```typescript
import { World, defineComponent, Component, defineSystem, createSystemId } from 'tx2-ecs';
import { signal } from 'tx2-ecs/reactive';
import { h, createRenderSystem } from 'tx2-ecs/client';

// Define a component
class PositionComponent extends Component {
  private xSignal = this.defineReactive('x', 0);
  private ySignal = this.defineReactive('y', 0);

  get x() { return this.xSignal.get(); }
  set x(value: number) { this.xSignal.set(value); }

  get y() { return this.ySignal.get(); }
  set y(value: number) { this.ySignal.set(value); }

  clone() {
    return new PositionComponent({
      x: this.xSignal.peek(),
      y: this.ySignal.peek()
    }) as this;
  }
}

const Position = defineComponent('Position', () => PositionComponent);

// Create world and entity
const world = new World();
const entity = world.createEntity();
const position = new PositionComponent({ x: 100, y: 200 });
world.addComponent(entity.id, position);

// Define a system
const MovementSystem = defineSystem(
  {
    id: createSystemId('MovementSystem'),
    name: 'MovementSystem',
    phases: ['update'],
  },
  (ctx) => {
    const query = ctx.world.query({ all: [Position.id] });
    for (const entityId of query.execute()) {
      const pos = ctx.world.getComponent<PositionComponent>(entityId, Position.id);
      if (pos) {
        pos.x += ctx.deltaTime * 0.1;
      }
    }
  }
);

world.addSystem(MovementSystem);

// Start the world
await world.init();
world.start();
```

### SSR Example

```typescript
import { World } from 'tx2-ecs';
import { renderDocument } from 'tx2-ecs/server';
import { Render } from 'tx2-ecs/client';
import { h } from 'tx2-ecs/client';

const world = new World();

const entity = world.createEntity();
world.addComponent(entity.id, Render.create({
  render: () => h('div', null,
    h('h1', null, 'Hello from TX-2!'),
    h('p', null, 'This was rendered on the server')
  )
}));

const html = renderDocument(world,
  { includeHydrationData: true },
  { title: 'TX-2 SSR Example' }
);

console.log(html);
```

## Project Structure

```
tx2-ecs/
├── src/
│   ├── core/           # Core ECS primitives
│   │   ├── entity.ts
│   │   ├── component.ts
│   │   ├── system.ts
│   │   ├── query.ts
│   │   └── world.ts
│   ├── reactive/       # Reactive system
│   │   └── signal.ts
│   ├── client/         # Client-side rendering
│   │   ├── dom.ts
│   │   └── renderer.ts
│   ├── server/         # Server-side features
│   │   ├── ssr.ts
│   │   └── rpc.ts
│   └── shared/         # Isomorphic utilities
│       ├── serialization.ts
│       ├── sync.ts
│       └── hydration.ts
├── examples/
│   └── todo-app/       # Full-featured example
└── package.json
```

## Core Concepts

### Entities

Entities are just unique IDs that components are attached to:

```typescript
const entity = world.createEntity();
console.log(entity.id); // 1
```

### Components

Components are pure data containers with reactive properties:

```typescript
class HealthComponent extends Component {
  private currentSignal = this.defineReactive('current', 100);
  private maxSignal = this.defineReactive('max', 100);

  get current() { return this.currentSignal.get(); }
  set current(value: number) { this.currentSignal.set(value); }

  get max() { return this.maxSignal.get(); }
  set max(value: number) { this.maxSignal.set(value); }

  clone() {
    return new HealthComponent({
      current: this.currentSignal.peek(),
      max: this.maxSignal.peek()
    }) as this;
  }
}

const Health = defineComponent('Health', () => HealthComponent);
```

### Systems

Systems are functions that process entities:

```typescript
const DamageSystem = defineSystem(
  {
    id: createSystemId('DamageSystem'),
    name: 'DamageSystem',
    phases: ['update'],
  },
  (ctx) => {
    const query = ctx.world.query({ all: [Health.id, Damage.id] });
    for (const entityId of query.execute()) {
      const health = ctx.world.getComponent<HealthComponent>(entityId, Health.id);
      const damage = ctx.world.getComponent<DamageComponent>(entityId, Damage.id);

      if (health && damage) {
        health.current -= damage.amount;
        ctx.world.removeComponent(entityId, Damage.id);
      }
    }
  }
);
```

### Queries

Queries efficiently filter entities by components:

```typescript
// All entities with Position AND Velocity
const query1 = world.query({ all: [Position.id, Velocity.id] });

// All entities with Render OR Sprite
const query2 = world.query({ any: [Render.id, Sprite.id] });

// All entities with Health but NOT Dead
const query3 = world.query({
  all: [Health.id],
  none: [Dead.id]
});

// Execute query and iterate
for (const entityId of query1.execute()) {
  // Process entity
}
```

### Reactivity

TX-2 includes a powerful reactive system:

```typescript
import { signal, computed, effect } from 'tx2-ecs/reactive';

const count = signal(0);
const doubled = computed(() => count.get() * 2);

effect(() => {
  console.log('Count:', count.get(), 'Doubled:', doubled.get());
});

count.set(5); // Logs: Count: 5 Doubled: 10
```

## Advanced Features

### State Synchronization

```typescript
import { createSyncManager } from 'tx2-ecs/shared';

const syncManager = createSyncManager(world, {
  mode: 'delta',
  syncInterval: 100,
});

syncManager.onMessage((message) => {
  // Send message to server/client via WebSocket
  ws.send(JSON.stringify(message));
});

syncManager.start();
```

### RPC Input Validation

TX-2 does not enforce input validation - this is your application's responsibility. We recommend using a validation library like `zod`:

```typescript
import { z } from 'zod';

const GetUserSchema = z.object({
  id: z.number().positive()
});

registry.register(defineRPC(
  'getUser',
  async (args, ctx) => {
    const { id } = GetUserSchema.parse(args); // Throws if invalid
    return await db.users.findById(id);
  }
));
```

### RPC System

```typescript
import { defineRPC, createRPCRegistry } from 'tx2-ecs/server';

const registry = createRPCRegistry();

registry.register(defineRPC(
  'createPlayer',
  async (args: { name: string }, ctx) => {
    const entity = ctx.world.createEntity();
    const player = new PlayerComponent({ name: args.name });
    ctx.world.addComponent(entity.id, player);
    return { entityId: entity.id };
  },
  {
    requiresAuth: true,
    rateLimit: { maxCalls: 10, windowMs: 60000 }
  }
));
```

### Hydration

```typescript
import { hydrateWorld } from 'tx2-ecs/shared';

// Client-side
await hydrateWorld(world, {
  root: document.getElementById('app'),
  clearMarkers: true,
  onHydrated: (world) => {
    console.log('Hydrated!');
  }
});
```

## Examples

See the `examples/storefront` directory for a complete fullstack application demonstrating:
- Server-side rendering
- Client-side hydration
- RPC calls
- State synchronization
- Reactive updates
- Component hierarchy

To run the example:

```bash
npm install
npm run build
npm run example:todo
```

Then open `http://localhost:3000` in your browser.

## Performance

TX-2 is designed for performance:

- **Query caching**: Queries are cached and only recomputed when entities/components change
- **Component indexing**: O(1) component lookups via hash maps
- **Batch updates**: Reactive updates are batched for minimal reflows
- **Delta compression**: Only sync what changed between snapshots
- **Efficient diffing**: Virtual DOM diffing minimizes DOM operations

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Credits

TX-2 is inspired by game engine ECS architectures (Unity, Bevy, specs) but adapted for web application development with modern web standards and practices.
