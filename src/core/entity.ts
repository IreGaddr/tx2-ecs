/**
 * Entity implementation - entities are just unique IDs with associated components
 */

export type EntityId = number & { readonly __entityId: unique symbol };

let nextEntityId = 1;

export function createEntityId(): EntityId {
  return nextEntityId++ as EntityId;
}

export function resetEntityIdCounter(start = 1): void {
  nextEntityId = start;
}

export class Entity {
  readonly id: EntityId;

  constructor(id?: EntityId) {
    this.id = id ?? createEntityId();
  }

  equals(other: Entity): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `Entity(${this.id})`;
  }

  toJSON(): number {
    return this.id;
  }
}
