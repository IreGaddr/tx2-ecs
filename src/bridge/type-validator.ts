/**
 * Type Validator for Isomorphic State
 *
 * Ensures type consistency between Rust (WASM/Native) and TypeScript implementations.
 * Validates component schemas match across platforms.
 */

import type { ComponentId } from '../core/component.js';

export type PrimitiveType =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object';

export interface FieldSchema {
  name: string;
  type: PrimitiveType;
  optional?: boolean;
  arrayOf?: PrimitiveType;
  properties?: Record<string, FieldSchema>;
}

export interface ComponentSchema {
  componentId: ComponentId;
  version: number;
  fields: Record<string, FieldSchema>;
}

export interface TypeValidationError {
  componentId: ComponentId;
  field: string;
  expected: string;
  actual: string;
  path: string[];
}

export class TypeValidator {
  private schemas = new Map<ComponentId, ComponentSchema>();
  private errors: TypeValidationError[] = [];

  registerSchema(schema: ComponentSchema): void {
    const existing = this.schemas.get(schema.componentId);

    if (existing && existing.version !== schema.version) {
      console.warn(
        `Schema version mismatch for ${schema.componentId}: ` +
        `existing=${existing.version}, new=${schema.version}`
      );
    }

    this.schemas.set(schema.componentId, schema);
  }

  validateComponent(componentId: ComponentId, data: any): boolean {
    const schema = this.schemas.get(componentId);

    if (!schema) {
      console.warn(`No schema registered for component: ${componentId}`);
      return true;
    }

    this.errors = [];
    this.validateObject(componentId, data, schema.fields, []);

    if (this.errors.length > 0) {
      console.error(`Type validation failed for ${componentId}:`, this.errors);
      return false;
    }

    return true;
  }

  getErrors(): TypeValidationError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  getSchema(componentId: ComponentId): ComponentSchema | undefined {
    return this.schemas.get(componentId);
  }

  getAllSchemas(): ComponentSchema[] {
    return Array.from(this.schemas.values());
  }

  private validateObject(
    componentId: ComponentId,
    data: any,
    fields: Record<string, FieldSchema>,
    path: string[]
  ): void {
    if (typeof data !== 'object' || data === null) {
      this.errors.push({
        componentId,
        field: path.join('.') || 'root',
        expected: 'object',
        actual: typeof data,
        path,
      });
      return;
    }

    for (const [fieldName, fieldSchema] of Object.entries(fields)) {
      const fieldPath = [...path, fieldName];
      const value = data[fieldName];

      if (value === undefined) {
        if (!fieldSchema.optional) {
          this.errors.push({
            componentId,
            field: fieldPath.join('.'),
            expected: `required field of type ${fieldSchema.type}`,
            actual: 'undefined',
            path: fieldPath,
          });
        }
        continue;
      }

      this.validateField(componentId, value, fieldSchema, fieldPath);
    }
  }

  private validateField(
    componentId: ComponentId,
    value: any,
    schema: FieldSchema,
    path: string[]
  ): void {
    const actualType = this.getTypeString(value);

    if (schema.type === 'null' && value === null) {
      return;
    }

    if (schema.type === 'boolean' && typeof value === 'boolean') {
      return;
    }

    if (schema.type === 'number' && typeof value === 'number') {
      return;
    }

    if (schema.type === 'string' && typeof value === 'string') {
      return;
    }

    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        this.errors.push({
          componentId,
          field: path.join('.'),
          expected: 'array',
          actual: actualType,
          path,
        });
        return;
      }

      if (schema.arrayOf) {
        for (let i = 0; i < value.length; i++) {
          const elementPath = [...path, `[${i}]`];
          const elementType = this.getTypeString(value[i]);

          if (schema.arrayOf === 'object' && typeof value[i] === 'object' && value[i] !== null) {
            continue;
          }

          if (elementType !== schema.arrayOf) {
            this.errors.push({
              componentId,
              field: elementPath.join(''),
              expected: schema.arrayOf,
              actual: elementType,
              path: elementPath,
            });
          }
        }
      }
      return;
    }

    if (schema.type === 'object') {
      if (typeof value !== 'object' || value === null) {
        this.errors.push({
          componentId,
          field: path.join('.'),
          expected: 'object',
          actual: actualType,
          path,
        });
        return;
      }

      if (schema.properties) {
        this.validateObject(componentId, value, schema.properties, path);
      }
      return;
    }

    this.errors.push({
      componentId,
      field: path.join('.'),
      expected: schema.type,
      actual: actualType,
      path,
    });
  }

  private getTypeString(value: any): PrimitiveType {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'object';
  }
}

const globalValidator = new TypeValidator();

export function validateComponentTypes(componentId: ComponentId, data: any): boolean {
  return globalValidator.validateComponent(componentId, data);
}

export function createTypeSchema(
  componentId: ComponentId,
  fields: Record<string, FieldSchema>,
  version: number = 1
): ComponentSchema {
  const schema: ComponentSchema = {
    componentId,
    version,
    fields,
  };

  globalValidator.registerSchema(schema);

  return schema;
}

export function inferTypeSchema(componentId: ComponentId, sampleData: any): ComponentSchema {
  const fields: Record<string, FieldSchema> = {};

  for (const [key, value] of Object.entries(sampleData)) {
    fields[key] = inferFieldSchema(key, value);
  }

  return createTypeSchema(componentId, fields);
}

function inferFieldSchema(name: string, value: any): FieldSchema {
  if (value === null) {
    return { name, type: 'null', optional: true };
  }

  if (typeof value === 'boolean') {
    return { name, type: 'boolean' };
  }

  if (typeof value === 'number') {
    return { name, type: 'number' };
  }

  if (typeof value === 'string') {
    return { name, type: 'string' };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { name, type: 'array' };
    }

    const firstElement = value[0];
    const elementType = inferFieldSchema('element', firstElement).type;

    return {
      name,
      type: 'array',
      arrayOf: elementType,
    };
  }

  if (typeof value === 'object') {
    const properties: Record<string, FieldSchema> = {};

    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferFieldSchema(key, val);
    }

    return {
      name,
      type: 'object',
      properties,
    };
  }

  return { name, type: 'object' };
}

export function compareSchemas(
  schema1: ComponentSchema,
  schema2: ComponentSchema
): {
  compatible: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  if (schema1.componentId !== schema2.componentId) {
    differences.push(`Component ID mismatch: ${schema1.componentId} !== ${schema2.componentId}`);
  }

  if (schema1.version !== schema2.version) {
    differences.push(`Version mismatch: ${schema1.version} !== ${schema2.version}`);
  }

  const fields1 = Object.keys(schema1.fields);
  const fields2 = Object.keys(schema2.fields);

  const missingInSchema2 = fields1.filter(f => !fields2.includes(f));
  const missingInSchema1 = fields2.filter(f => !fields1.includes(f));

  for (const field of missingInSchema2) {
    if (!schema1.fields[field]?.optional) {
      differences.push(`Required field "${field}" missing in second schema`);
    }
  }

  for (const field of missingInSchema1) {
    if (!schema2.fields[field]?.optional) {
      differences.push(`Required field "${field}" missing in first schema`);
    }
  }

  for (const field of fields1.filter(f => fields2.includes(f))) {
    const field1 = schema1.fields[field];
    const field2 = schema2.fields[field];

    if (field1 && field2 && field1.type !== field2.type) {
      differences.push(
        `Field "${field}" type mismatch: ${field1.type} !== ${field2.type}`
      );
    }
  }

  return {
    compatible: differences.length === 0,
    differences,
  };
}

export function serializeSchema(schema: ComponentSchema): string {
  return JSON.stringify(schema, null, 2);
}

export function deserializeSchema(json: string): ComponentSchema {
  return JSON.parse(json) as ComponentSchema;
}

export { globalValidator };
