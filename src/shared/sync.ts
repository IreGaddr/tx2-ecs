/**
 * State synchronization system for client-server communication
 */

import { World } from '../core/world.js';
import { EntityId } from '../core/entity.js';
import { ComponentId } from '../core/component.js';
import { Serializer, Delta, DeltaCompressor, WorldSnapshot, SerializationOptions } from './serialization.js';

export type SyncMode = 'full' | 'delta' | 'manual';

export interface SyncConfig {
  mode?: SyncMode;
  syncInterval?: number;
  includeComponents?: Set<ComponentId>;
  excludeComponents?: Set<ComponentId>;
  includeEntities?: Set<EntityId>;
  excludeEntities?: Set<EntityId>;
}

export interface SyncMessage {
  type: 'snapshot' | 'delta' | 'request_snapshot' | 'ack';
  payload?: WorldSnapshot | Delta;
  timestamp: number;
  id: string;
}

export type SyncMessageHandler = (message: SyncMessage) => void;

export class SyncManager {
  private serializer = new Serializer();
  private deltaCompressor = new DeltaCompressor();
  private config: Required<SyncConfig>;
  private syncIntervalId: any = null;
  private lastSyncTimestamp = 0;
  private messageHandlers = new Set<SyncMessageHandler>();
  private pendingAcks = new Map<string, { timestamp: number; callback: () => void }>();

  constructor(
    private world: World,
    config: SyncConfig = {}
  ) {
    this.config = {
      mode: config.mode ?? 'delta',
      syncInterval: config.syncInterval ?? 100,
      includeComponents: config.includeComponents ?? new Set(),
      excludeComponents: config.excludeComponents ?? new Set(),
      includeEntities: config.includeEntities ?? new Set(),
      excludeEntities: config.excludeEntities ?? new Set(),
    };
  }

  start(): void {
    if (this.syncIntervalId !== null) {
      return;
    }

    if (this.config.mode === 'manual') {
      return;
    }

    this.syncIntervalId = setInterval(() => {
      this.sync();
    }, this.config.syncInterval);
  }

  stop(): void {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  sync(): void {
    if (this.config.mode === 'full') {
      this.sendSnapshot();
    } else if (this.config.mode === 'delta') {
      this.sendDelta();
    }
  }

  sendSnapshot(): void {
    const options: SerializationOptions = {
      includeComponents: this.config.includeComponents.size > 0 ? this.config.includeComponents : undefined,
      excludeComponents: this.config.excludeComponents.size > 0 ? this.config.excludeComponents : undefined,
      includeEntities: this.config.includeEntities.size > 0 ? this.config.includeEntities : undefined,
      excludeEntities: this.config.excludeEntities.size > 0 ? this.config.excludeEntities : undefined,
    };

    const snapshot = this.serializer.createSnapshot(this.world, options);
    const message: SyncMessage = {
      type: 'snapshot',
      payload: snapshot,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    this.sendMessage(message);
    this.lastSyncTimestamp = message.timestamp;
  }

  sendDelta(): void {
    const options: SerializationOptions = {
      includeComponents: this.config.includeComponents.size > 0 ? this.config.includeComponents : undefined,
      excludeComponents: this.config.excludeComponents.size > 0 ? this.config.excludeComponents : undefined,
      includeEntities: this.config.includeEntities.size > 0 ? this.config.includeEntities : undefined,
      excludeEntities: this.config.excludeEntities.size > 0 ? this.config.excludeEntities : undefined,
    };

    const delta = this.deltaCompressor.createDelta(this.world, options);

    if (delta.changes.length === 0) {
      return;
    }

    const message: SyncMessage = {
      type: 'delta',
      payload: delta,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    this.sendMessage(message);
    this.lastSyncTimestamp = message.timestamp;
  }

  requestSnapshot(): void {
    const message: SyncMessage = {
      type: 'request_snapshot',
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    this.sendMessage(message);
  }

  receiveMessage(message: SyncMessage): void {
    switch (message.type) {
      case 'snapshot':
        if (message.payload && 'entities' in message.payload) {
          this.serializer.restoreSnapshot(this.world, message.payload);
          this.deltaCompressor.reset();
          this.sendAck(message.id);
        }
        break;

      case 'delta':
        if (message.payload && 'changes' in message.payload) {
          try {
            this.deltaCompressor.applyDelta(this.world, message.payload);
            this.sendAck(message.id);
          } catch (error) {
            console.error('Failed to apply delta, requesting full snapshot', error);
            this.requestSnapshot();
          }
        }
        break;

      case 'request_snapshot':
        this.sendSnapshot();
        break;

      case 'ack':
        this.handleAck(message.id);
        break;
    }
  }

  private sendMessage(message: SyncMessage): void {
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  private sendAck(messageId: string): void {
    const message: SyncMessage = {
      type: 'ack',
      timestamp: Date.now(),
      id: messageId,
    };

    this.sendMessage(message);
  }

  private handleAck(messageId: string): void {
    const pending = this.pendingAcks.get(messageId);
    if (pending) {
      pending.callback();
      this.pendingAcks.delete(messageId);
    }
  }

  onMessage(handler: SyncMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getLastSyncTimestamp(): number {
    return this.lastSyncTimestamp;
  }

  setMode(mode: SyncMode): void {
    const wasRunning = this.syncIntervalId !== null;
    this.stop();
    this.config.mode = mode;
    if (wasRunning && mode !== 'manual') {
      this.start();
    }
  }

  getMode(): SyncMode {
    return this.config.mode;
  }

  setSyncInterval(interval: number): void {
    this.config.syncInterval = interval;
    if (this.syncIntervalId !== null) {
      this.stop();
      this.start();
    }
  }

  getSyncInterval(): number {
    return this.config.syncInterval;
  }

  destroy(): void {
    this.stop();
    this.messageHandlers.clear();
    this.pendingAcks.clear();
  }
}

export function createSyncManager(world: World, config?: SyncConfig): SyncManager {
  return new SyncManager(world, config);
}
