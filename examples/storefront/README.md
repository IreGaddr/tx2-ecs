# WECS Storefront Demo (modular)

- Independent frontend, backend, and shared modules under `examples/storefront`.
- No monorepo coupling: backend serves SSR + RPC, frontend bundles separately, shared holds component definitions.

## Layout
- `shared/` — Product, Cart, and UI state components.
- `backend/` — Catalog seed, render views, RPC handlers, and HTTP server.
- `frontend/` — Client bootstrap, RPC calls, and build script.

## Run
```bash
# bundle frontend
node examples/storefront/frontend/build.js

# bundle backend
node examples/storefront/backend/build.js

# start backend bundle
node examples/storefront/backend/dist/server.js
```

Then open http://localhost:3000. (If you prefer running straight TS, use `node --loader ts-node/esm examples/storefront/backend/server.ts` after installing ts-node.)

## Notes
- SSR via `renderDocument` with hydration data, renders the ECS-driven page.
- RPC endpoints for cart + filters; snapshot endpoint keeps client in sync.
- Styling lives inline in the server HTML for simplicity of the demo. Feel free to extract to a static file. 
