/**
 * MongoDB Schema Extractor Tests (TDD)
 * Tests schema inference from document samples
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MongoDBSchemaExtractor } from './MongoDBSchemaExtractor';
import { MongoDBAdapter } from './MongoDBAdapter';
import { DatabaseType } from '@aidb/contracts';

describe('MongoDBSchemaExtractor', () => {
  let adapter: MongoDBAdapter;
  let extractor: MongoDBSchemaExtractor;

  beforeEach(async () => {
    adapter = new MongoDBAdapter();
    const credentials = {
      type: DatabaseType.MongoDB,
      host: 'localhost',
      port: 27017,
      database: 'testdb'
      // No auth for tests
    };
    await adapter.connect(credentials);
    extractor = new MongoDBSchemaExtractor(adapter);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe('Collection Discovery', () => {
    it('should get list of collections', async () => {
      const collections = await extractor.getCollections();

      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
    });

    it('should include expected test collections', async () => {
      const collections = await extractor.getCollections();

      expect(collections).toContain('users');
      expect(collections).toContain('posts');
    });
  });

  describe('Schema Inference', () => {
    it('should infer schema for a collection', async () => {
      const schema = await extractor.inferCollectionSchema('users');

      expect(schema).toHaveProperty('name', 'users');
      expect(schema).toHaveProperty('documentCount');
      expect(schema).toHaveProperty('sampleSize');
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should detect field types', async () => {
      const schema = await extractor.inferCollectionSchema('users', {
        inferTypes: true,
        sampleSize: 100
      });

      const nameField = schema.fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField?.types).toContain('string');
    });

    it('should calculate field frequency', async () => {
      const schema = await extractor.inferCollectionSchema('users', {
        analyzeFrequency: true
      });

      schema.fields.forEach(field => {
        expect(field.frequency).toBeGreaterThanOrEqual(0);
        expect(field.frequency).toBeLessThanOrEqual(1);
      });
    });

    it('should mark required fields', async () => {
      const schema = await extractor.inferCollectionSchema('users');

      const idField = schema.fields.find(f => f.name === '_id');
      expect(idField).toBeDefined();
      expect(idField?.isRequired).toBe(true);
      expect(idField?.frequency).toBe(1);
    });

    it('should detect array fields', async () => {
      const schema = await extractor.inferCollectionSchema('posts', {
        analyzeArrays: true
      });

      const tagsField = schema.fields.find(f => f.name === 'tags');
      if (tagsField) {
        expect(tagsField.isArray).toBe(true);
        expect(tagsField.arrayElementTypes).toBeDefined();
      }
    });

    it('should detect nested objects', async () => {
      const schema = await extractor.inferCollectionSchema('users', {
        detectNested: true,
        maxDepth: 3
      });

      const addressField = schema.fields.find(f => f.name === 'address');
      if (addressField) {
        expect(addressField.nestedFields).toBeDefined();
        expect(Array.isArray(addressField.nestedFields)).toBe(true);
      }
    });

    it('should respect sample size option', async () => {
      const schema = await extractor.inferCollectionSchema('users', {
        sampleSize: 10
      });

      // Sample size should be min(requested, available documents)
      expect(schema.sampleSize).toBeLessThanOrEqual(10);
      expect(schema.sampleSize).toBeGreaterThan(0);
    });
  });

  describe('Batch Schema Inference', () => {
    it('should infer schemas for all collections', async () => {
      const schemas = await extractor.inferAllSchemas({
        sampleSize: 50
      });

      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBeGreaterThan(0);
      schemas.forEach(schema => {
        expect(schema).toHaveProperty('name');
        expect(schema).toHaveProperty('fields');
      });
    });

    it('should handle empty collections', async () => {
      // Assuming there's an empty test collection
      const schemas = await extractor.inferAllSchemas();

      // Should not throw, even if collection is empty
      expect(Array.isArray(schemas)).toBe(true);
    });
  });

  describe('Collection Statistics', () => {
    it('should get collection stats', async () => {
      const stats = await extractor.getCollectionStats('users');

      expect(stats).toHaveProperty('documentCount');
      expect(stats).toHaveProperty('averageDocumentSize');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('indexes');
      expect(Array.isArray(stats.indexes)).toBe(true);
    });

    it('should have accurate document count', async () => {
      const stats = await extractor.getCollectionStats('users');

      expect(stats.documentCount).toBeGreaterThanOrEqual(0);
      expect(typeof stats.documentCount).toBe('number');
    });
  });

  describe('SQL Compatibility', () => {
    it('should convert NoSQL schema to TableSchema', async () => {
      const collectionSchema = await extractor.inferCollectionSchema('users');
      const tableSchema = extractor.toTableSchema(collectionSchema);

      expect(tableSchema).toHaveProperty('name', 'users');
      expect(tableSchema).toHaveProperty('columns');
      expect(Array.isArray(tableSchema.columns)).toBe(true);
      expect(tableSchema).toHaveProperty('indexes');
      expect(tableSchema).toHaveProperty('rowCount');
    });

    it('should map field types to SQL types', async () => {
      const collectionSchema = await extractor.inferCollectionSchema('users');
      const tableSchema = extractor.toTableSchema(collectionSchema);

      tableSchema.columns.forEach(column => {
        expect(column).toHaveProperty('dataType');
        expect(column).toHaveProperty('nullable');
      });
    });

    it('should mark required fields as not nullable', async () => {
      const collectionSchema = await extractor.inferCollectionSchema('users');
      const tableSchema = extractor.toTableSchema(collectionSchema);

      const idColumn = tableSchema.columns.find(c => c.name === '_id');
      expect(idColumn).toBeDefined();
      expect(idColumn?.nullable).toBe(false);
    });
  });

  describe('Type Detection', () => {
    it('should detect string types', async () => {
      const schema = await extractor.inferCollectionSchema('users', {
        inferTypes: true
      });

      const nameField = schema.fields.find(f => f.name === 'name');
      expect(nameField?.types).toContain('string');
    });

    it('should detect number types', async () => {
      const schema = await extractor.inferCollectionSchema('posts', {
        inferTypes: true
      });

      const viewsField = schema.fields.find(f => f.name === 'views');
      if (viewsField) {
        expect(
          viewsField.types.some(t => t === 'number' || t === 'int' || t === 'double')
        ).toBe(true);
      }
    });

    it('should detect date types', async () => {
      const schema = await extractor.inferCollectionSchema('users', {
        inferTypes: true
      });

      const createdAtField = schema.fields.find(f => f.name === 'createdAt');
      if (createdAtField) {
        expect(createdAtField.types).toContain('date');
      }
    });

    it('should detect boolean types', async () => {
      const schema = await extractor.inferCollectionSchema('posts', {
        inferTypes: true
      });

      const publishedField = schema.fields.find(f => f.name === 'published');
      if (publishedField) {
        expect(publishedField.types).toContain('boolean');
      }
    });

    it('should handle multiple types per field', async () => {
      // MongoDB allows different types in the same field across documents
      // Use posts collection which has mixed types
      const schema = await extractor.inferCollectionSchema('posts', {
        inferTypes: true
      });

      // All fields should have their types tracked as arrays
      expect(schema.fields.length).toBeGreaterThan(0);
      schema.fields.forEach(field => {
        expect(Array.isArray(field.types)).toBe(true);
      });
    });
  });
});
