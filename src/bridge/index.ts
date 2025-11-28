/**
 * TX2 Bridge Module
 *
 * Provides seamless switching between TypeScript and WASM backends
 * while maintaining isomorphic state by design.
 */

export {
  BridgeWorld,
  BridgeWorldConfig,
  createWorld,
  initWasm,
  isWasmAvailable,
  getWasmModule,
  getBenchmarkStats,
  WasmModule,
  WasmWorldInstance,
} from './wasm-bridge.js';

export { TypeValidator, validateComponentTypes, createTypeSchema } from './type-validator.js';
