import { describe, it, expect, beforeEach } from 'vitest';
import { Entity, createEntityId, resetEntityIdCounter } from './entity.js';

describe('Entity', () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it('should create entity with auto-generated ID', () => {
    const entity = new Entity();
    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('number');
  });

  it('should create entity with specific ID', () => {
    const id = createEntityId();
    const entity = new Entity(id);
    expect(entity.id).toBe(id);
  });

  it('should generate sequential IDs', () => {
    const id1 = createEntityId();
    const id2 = createEntityId();
    const id3 = createEntityId();

    expect(id2).toBe(id1 + 1);
    expect(id3).toBe(id2 + 1);
  });

  it('should compare entities correctly', () => {
    const entity1 = new Entity();
    const entity2 = new Entity();
    const entity3 = new Entity(entity1.id);

    expect(entity1.equals(entity2)).toBe(false);
    expect(entity1.equals(entity3)).toBe(true);
  });

  it('should convert to string', () => {
    const entity = new Entity();
    const str = entity.toString();
    expect(str).toContain('Entity');
    expect(str).toContain(String(entity.id));
  });

  it('should serialize to JSON', () => {
    const entity = new Entity();
    const json = JSON.parse(JSON.stringify({ entity }));
    expect(json.entity).toBe(entity.id);
  });

  it('should reset ID counter', () => {
    createEntityId();
    createEntityId();
    resetEntityIdCounter();

    const id = createEntityId();
    expect(id).toBe(1);
  });

  it('should reset ID counter to specific value', () => {
    resetEntityIdCounter(100);
    const id = createEntityId();
    expect(id).toBe(100);
  });
});
