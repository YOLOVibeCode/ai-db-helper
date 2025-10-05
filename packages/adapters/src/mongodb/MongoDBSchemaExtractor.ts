/**
 * MongoDBSchemaExtractor - Extract and infer schema from MongoDB collections
 *
 * Features:
 * - Collection discovery
 * - Schema inference from document samples
 * - Field type detection
 * - Field frequency analysis
 * - Array and nested object detection
 * - Conversion to SQL-compatible schema
 */

import {
  INoSQLSchemaExtractor,
  SchemaInferenceOptions,
  NoSQLCollectionSchema,
  InferredField,
  TableSchema,
  ColumnSchema
} from '@aidb/contracts';
import { MongoDBAdapter } from './MongoDBAdapter';

export class MongoDBSchemaExtractor implements INoSQLSchemaExtractor {
  constructor(private adapter: MongoDBAdapter) {}

  /**
   * Get list of all collections
   */
  async getCollections(): Promise<string[]> {
    const db = this.adapter.getDb();
    if (!db) {
      throw new Error('Not connected to database');
    }

    const collections = await db.listCollections().toArray();
    return collections.map(c => c.name);
  }

  /**
   * Infer schema for a specific collection by sampling documents
   */
  async inferCollectionSchema(
    collectionName: string,
    options?: SchemaInferenceOptions
  ): Promise<NoSQLCollectionSchema> {
    const db = this.adapter.getDb();
    if (!db) {
      throw new Error('Not connected to database');
    }

    const collection = db.collection(collectionName);

    // Set default options
    const opts: Required<SchemaInferenceOptions> = {
      sampleSize: options?.sampleSize ?? 100,
      analyzeFrequency: options?.analyzeFrequency ?? true,
      inferTypes: options?.inferTypes ?? true,
      detectNested: options?.detectNested ?? true,
      analyzeArrays: options?.analyzeArrays ?? true,
      maxDepth: options?.maxDepth ?? 3
    };

    // Get document count
    const documentCount = await collection.countDocuments();

    // Sample documents
    const sampleSize = Math.min(opts.sampleSize, documentCount);
    const documents = await collection
      .find({})
      .limit(sampleSize)
      .toArray();

    // Infer fields from sampled documents
    const fieldMap = new Map<string, InferredField>();

    for (const doc of documents) {
      this.analyzeDocument(doc, fieldMap, opts, '', 0);
    }

    // Calculate frequencies and mark required fields
    const fields = Array.from(fieldMap.values()).map(field => {
      field.frequency = field.frequency / sampleSize;
      field.isRequired = field.frequency === 1.0;
      return field;
    });

    // Get indexes
    const indexes = await collection.listIndexes().toArray();
    const indexNames = indexes.map(idx => idx.name);

    return {
      name: collectionName,
      documentCount,
      sampleSize,
      fields,
      indexes: indexNames
    };
  }

  /**
   * Analyze a document and extract field information
   */
  private analyzeDocument(
    doc: any,
    fieldMap: Map<string, InferredField>,
    options: Required<SchemaInferenceOptions>,
    prefix: string,
    depth: number
  ): void {
    if (depth > options.maxDepth) {
      return;
    }

    for (const [key, value] of Object.entries(doc)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      let field = fieldMap.get(fieldName);

      if (!field) {
        field = {
          name: fieldName,
          types: [],
          frequency: 0,
          isRequired: false,
          isArray: false
        };
        fieldMap.set(fieldName, field);
      }

      // Increment frequency counter
      field.frequency++;

      if (value === null || value === undefined) {
        if (options.inferTypes && !field.types.includes('null')) {
          field.types.push('null');
        }
        continue;
      }

      // Detect type
      if (options.inferTypes) {
        const type = this.getValueType(value);
        if (!field.types.includes(type)) {
          field.types.push(type);
        }
      }

      // Detect arrays
      if (Array.isArray(value)) {
        field.isArray = true;

        if (options.analyzeArrays && value.length > 0) {
          const elementTypes = new Set<string>();
          for (const elem of value) {
            const elemType = this.getValueType(elem);
            elementTypes.add(elemType);
          }
          field.arrayElementTypes = Array.from(elementTypes);
        }
      }

      // Detect nested objects
      if (options.detectNested && this.isPlainObject(value)) {
        if (!field.nestedFields) {
          field.nestedFields = [];
        }

        // Create a nested field map
        const nestedFieldMap = new Map<string, InferredField>();
        this.analyzeDocument(value, nestedFieldMap, options, '', depth + 1);

        // Merge nested fields
        for (const nestedField of nestedFieldMap.values()) {
          const existingNested = field.nestedFields.find(f => f.name === nestedField.name);
          if (existingNested) {
            // Merge types
            for (const type of nestedField.types) {
              if (!existingNested.types.includes(type)) {
                existingNested.types.push(type);
              }
            }
            existingNested.frequency += nestedField.frequency;
          } else {
            field.nestedFields.push(nestedField);
          }
        }
      }
    }
  }

  /**
   * Get the type of a value
   */
  private getValueType(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return 'array';
    }

    if (value instanceof Date) {
      return 'date';
    }

    if (this.isPlainObject(value)) {
      return 'object';
    }

    const type = typeof value;

    if (type === 'number') {
      return Number.isInteger(value) ? 'number' : 'number';
    }

    return type;
  }

  /**
   * Check if value is a plain object (not an array, date, etc.)
   */
  private isPlainObject(value: any): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      value.constructor === Object
    );
  }

  /**
   * Infer schema for all collections
   */
  async inferAllSchemas(options?: SchemaInferenceOptions): Promise<NoSQLCollectionSchema[]> {
    const collections = await this.getCollections();
    const schemas: NoSQLCollectionSchema[] = [];

    for (const collectionName of collections) {
      try {
        const schema = await this.inferCollectionSchema(collectionName, options);
        schemas.push(schema);
      } catch (error) {
        // Continue with other collections even if one fails
        console.error(`Failed to infer schema for ${collectionName}:`, error);
      }
    }

    return schemas;
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName: string): Promise<{
    documentCount: number;
    averageDocumentSize: number;
    totalSize: number;
    indexes: string[];
  }> {
    const db = this.adapter.getDb();
    if (!db) {
      throw new Error('Not connected to database');
    }

    const collection = db.collection(collectionName);

    // Get collection stats from MongoDB using the stats command
    const stats = await db.command({ collStats: collectionName });

    // Get indexes
    const indexes = await collection.listIndexes().toArray();
    const indexNames = indexes.map(idx => idx.name);

    return {
      documentCount: stats.count || 0,
      averageDocumentSize: stats.avgObjSize || 0,
      totalSize: stats.size || 0,
      indexes: indexNames
    };
  }

  /**
   * Convert NoSQL schema to SQL-compatible TableSchema
   */
  toTableSchema(collectionSchema: NoSQLCollectionSchema): TableSchema {
    const columns: ColumnSchema[] = collectionSchema.fields.map(field => {
      return {
        name: field.name,
        dataType: this.mapToSQLType(field),
        nativeType: field.types.join(' | '),
        nullable: !field.isRequired || field.frequency < 1.0,
        frequency: field.frequency
      };
    });

    return {
      name: collectionSchema.name,
      columns,
      indexes: collectionSchema.indexes.map(indexName => ({
        name: indexName,
        tableName: collectionSchema.name,
        columns: [], // MongoDB index structure is different
        unique: false,
        type: 'btree' as any
      })),
      constraints: [],
      rowCount: collectionSchema.documentCount,
      sizeBytes: collectionSchema.sizeBytes
    };
  }

  /**
   * Map MongoDB types to SQL types
   */
  private mapToSQLType(field: InferredField): string {
    // Get the primary type
    const types = field.types;

    if (types.length === 0) {
      return 'TEXT';
    }

    // If array, return array type
    if (field.isArray) {
      return 'JSON';
    }

    // If object, return JSON
    if (types.includes('object')) {
      return 'JSON';
    }

    // Map the first non-null type
    const primaryType = types.find(t => t !== 'null') || types[0];

    switch (primaryType) {
      case 'string':
        return 'TEXT';
      case 'number':
        return 'NUMERIC';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'TIMESTAMP';
      case 'array':
        return 'JSON';
      case 'object':
        return 'JSON';
      default:
        return 'TEXT';
    }
  }
}
