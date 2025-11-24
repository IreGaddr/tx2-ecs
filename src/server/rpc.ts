/**
 * RPC (Remote Procedure Call) system for client-server communication
 */

import { World } from '../core/world.js';
import { EntityId } from '../core/entity.js';
import { ComponentId } from '../core/component.js';

export type RPCHandler<TArgs = any, TResult = any> = (args: TArgs, context: RPCContext) => TResult | Promise<TResult>;

export interface RPCContext {
  world: World;
  clientId?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

export interface RPCDefinition<TArgs = any, TResult = any> {
  name: string;
  handler: RPCHandler<TArgs, TResult>;
  requiresAuth?: boolean;
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

export interface RPCRequest<TArgs = any> {
  id: string;
  method: string;
  args: TArgs;
  timestamp: number;
  clientId?: string;
}

export interface RPCResponse<TResult = any> {
  id: string;
  result?: TResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

export class RPCError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RPCError';
  }
}

export class RPCRegistry {
  private handlers = new Map<string, RPCDefinition>();
  private rateLimitTracking = new Map<string, { count: number; resetTime: number }>();

  register<TArgs, TResult>(definition: RPCDefinition<TArgs, TResult>): void {
    if (this.handlers.has(definition.name)) {
      throw new Error(`RPC method "${definition.name}" is already registered`);
    }

    this.handlers.set(definition.name, definition);
  }

  unregister(name: string): boolean {
    return this.handlers.delete(name);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  get<TArgs, TResult>(name: string): RPCDefinition<TArgs, TResult> | undefined {
    return this.handlers.get(name) as RPCDefinition<TArgs, TResult> | undefined;
  }

  getAll(): RPCDefinition[] {
    return Array.from(this.handlers.values());
  }

  async execute<TArgs, TResult>(
    request: RPCRequest<TArgs>,
    context: RPCContext
  ): Promise<RPCResponse<TResult>> {


    try {
      const definition = this.handlers.get(request.method);

      if (!definition) {
        throw new RPCError(
          'METHOD_NOT_FOUND',
          `RPC method "${request.method}" not found`
        );
      }

      if (definition.requiresAuth && !context.clientId) {
        throw new RPCError(
          'UNAUTHORIZED',
          'Authentication required for this method'
        );
      }

      if (definition.rateLimit) {
        this.checkRateLimit(request, definition.rateLimit, context);
      }

      const result = await definition.handler(request.args, context);

      return {
        id: request.id,
        result,
        timestamp: Date.now(),
      };
    } catch (error) {
      if (error instanceof RPCError) {
        return {
          id: request.id,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          timestamp: Date.now(),
        };
      }

      return {
        id: request.id,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: Date.now(),
      };
    }
  }

  private checkRateLimit(request: RPCRequest, rateLimit: NonNullable<RPCDefinition['rateLimit']>, context: RPCContext): void {
    const key = `${request.method}:${context.clientId ?? context.ip ?? 'anonymous'}`;
    const now = Date.now();
    const tracking = this.rateLimitTracking.get(key);

    if (!tracking || now >= tracking.resetTime) {
      this.rateLimitTracking.set(key, {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      });
      return;
    }

    if (tracking.count >= rateLimit.maxCalls) {
      throw new RPCError(
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded for method "${request.method}". Max ${rateLimit.maxCalls} calls per ${rateLimit.windowMs}ms`,
        {
          resetTime: tracking.resetTime,
          maxCalls: rateLimit.maxCalls,
          windowMs: rateLimit.windowMs,
        }
      );
    }

    tracking.count++;
  }

  clear(): void {
    this.handlers.clear();
    this.rateLimitTracking.clear();
  }
}

export class RPCClient {
  private pendingRequests = new Map<string, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout: any;
  }>();
  private requestIdCounter = 0;
  private messageHandlers = new Set<(request: RPCRequest) => void>();

  constructor(private defaultTimeout = 30000) { }

  async call<TArgs, TResult>(method: string, args: TArgs, timeout?: number): Promise<TResult> {
    const requestId = this.generateRequestId();
    const actualTimeout = timeout ?? this.defaultTimeout;

    const request: RPCRequest<TArgs> = {
      id: requestId,
      method,
      args,
      timestamp: Date.now(),
    };

    return new Promise<TResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new RPCError('TIMEOUT', `RPC call to "${method}" timed out after ${actualTimeout}ms`));
      }, actualTimeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutId,
      });

      this.sendRequest(request);
    });
  }

  handleResponse<TResult>(response: RPCResponse<TResult>): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new RPCError(
        response.error.code,
        response.error.message,
        response.error.details
      ));
    } else {
      pending.resolve(response.result);
    }
  }

  private sendRequest(request: RPCRequest): void {
    for (const handler of this.messageHandlers) {
      handler(request);
    }
  }

  onRequest(handler: (request: RPCRequest) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  private generateRequestId(): string {
    return `rpc-${Date.now()}-${this.requestIdCounter++}`;
  }

  clear(): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new RPCError('CANCELLED', 'RPC client was cleared'));
    }
    this.pendingRequests.clear();
    this.messageHandlers.clear();
  }
}

export function defineRPC<TArgs, TResult>(
  name: string,
  handler: RPCHandler<TArgs, TResult>,
  options?: {
    requiresAuth?: boolean;
    rateLimit?: {
      maxCalls: number;
      windowMs: number;
    };
  }
): RPCDefinition<TArgs, TResult> {
  return {
    name,
    handler,
    requiresAuth: options?.requiresAuth,
    rateLimit: options?.rateLimit,
  };
}

export interface EntityRPCArgs {
  entityId: EntityId;
  [key: string]: any;
}

export interface ComponentRPCArgs {
  entityId: EntityId;
  componentId: ComponentId;
  [key: string]: any;
}

export function createEntityRPC<TArgs extends EntityRPCArgs, TResult>(
  name: string,
  handler: (entity: EntityId, args: Omit<TArgs, 'entityId'>, context: RPCContext) => TResult | Promise<TResult>,
  options?: {
    requiresAuth?: boolean;
    rateLimit?: {
      maxCalls: number;
      windowMs: number;
    };
  }
): RPCDefinition<TArgs, TResult> {
  return defineRPC<TArgs, TResult>(
    name,
    async (args, context) => {
      if (!context.world.hasEntity(args.entityId)) {
        throw new RPCError('ENTITY_NOT_FOUND', `Entity ${args.entityId} not found`);
      }

      const { entityId, ...restArgs } = args;
      return handler(entityId, restArgs as Omit<TArgs, 'entityId'>, context);
    },
    options
  );
}

export function createComponentRPC<TArgs extends ComponentRPCArgs, TResult>(
  name: string,
  handler: (
    entityId: EntityId,
    componentId: ComponentId,
    args: Omit<TArgs, 'entityId' | 'componentId'>,
    context: RPCContext
  ) => TResult | Promise<TResult>,
  options?: {
    requiresAuth?: boolean;
    rateLimit?: {
      maxCalls: number;
      windowMs: number;
    };
  }
): RPCDefinition<TArgs, TResult> {
  return defineRPC<TArgs, TResult>(
    name,
    async (args, context) => {
      if (!context.world.hasEntity(args.entityId)) {
        throw new RPCError('ENTITY_NOT_FOUND', `Entity ${args.entityId} not found`);
      }

      if (!context.world.hasComponent(args.entityId, args.componentId)) {
        throw new RPCError('COMPONENT_NOT_FOUND', `Component ${args.componentId} not found on entity ${args.entityId}`);
      }

      const { entityId, componentId, ...restArgs } = args;
      return handler(entityId, componentId, restArgs as Omit<TArgs, 'entityId' | 'componentId'>, context);
    },
    options
  );
}

export function createRPCRegistry(): RPCRegistry {
  return new RPCRegistry();
}

export function createRPCClient(timeout?: number): RPCClient {
  return new RPCClient(timeout);
}
