/**
 * NoSQL Schema Extractor Interface
 * For document databases like MongoDB that don't have fixed schemas
 */

import { TableSchema } from '../types/schema-types';

/**
 * Schema inference options for NoSQL databases
 */
export interface SchemaInferenceOptions {
  /**
   * Number of documents to sample per collection
   */
  sampleSize?: number;

  /**
   * Include field frequency analysis (% of documents with each field)
   */
  analyzeFrequency?: boolean;

  /**
   * Infer data types from actual values
   */
  inferTypes?: boolean;

  /**
   * Detect nested object structures
   */
  detectNested?: boolean;

  /**
   * Detect array types and analyze their elements
   */
  analyzeArrays?: boolean;

  /**
   * Maximum depth for nested object analysis
   */
  maxDepth?: number;
}

/**
 * Inferred field information
 */
export interface InferredField {
  name: string;
  types: string[]; // Can have multiple types in NoSQL
  frequency: number; // 0-1, percentage of documents with this field
  isRequired: boolean; // true if frequency is 100%
  isArray: boolean;
  arrayElementTypes?: string[];
  nestedFields?: InferredField[]; // For nested objects
  examples?: any[]; // Sample values
}

/**
 * NoSQL collection schema (equivalent to table in SQL)
 */
export interface NoSQLCollectionSchema {
  name: string;
  documentCount: number;
  sampleSize: number;
  fields: InferredField[];
  indexes: string[];
  averageDocumentSize?: number;
  sizeBytes?: number;
}

/**
 * NoSQL Schema Extractor interface
 * Infers schema from document samples
 */
export interface INoSQLSchemaExtractor {
  /**
   * Get list of all collections (like tables in SQL)
   */
  getCollections(): Promise<string[]>;

  /**
   * Infer schema for a specific collection by sampling documents
   * @param collectionName - Name of the collection
   * @param options - Inference options
   */
  inferCollectionSchema(
    collectionName: string,
    options?: SchemaInferenceOptions
  ): Promise<NoSQLCollectionSchema>;

  /**
   * Infer schema for all collections
   * @param options - Inference options
   */
  inferAllSchemas(options?: SchemaInferenceOptions): Promise<NoSQLCollectionSchema[]>;

  /**
   * Convert NoSQL schema to SQL-like TableSchema for compatibility
   * @param collectionSchema - NoSQL collection schema
   */
  toTableSchema(collectionSchema: NoSQLCollectionSchema): TableSchema;

  /**
   * Get collection statistics
   * @param collectionName - Name of the collection
   */
  getCollectionStats(collectionName: string): Promise<{
    documentCount: number;
    averageDocumentSize: number;
    totalSize: number;
    indexes: string[];
  }>;
}
