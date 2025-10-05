/**
 * Schema caching interface
 */

import { DatabaseSchema, CacheMetadata } from '../types/schema-types';

export interface ISchemaCache {
  /**
   * Save schema to cache
   */
  save(databaseName: string, schema: DatabaseSchema): Promise<void>;

  /**
   * Load schema from cache
   * @returns null if cache doesn't exist
   */
  load(databaseName: string): Promise<DatabaseSchema | null>;

  /**
   * Invalidate (delete) cached schema
   */
  invalidate(databaseName: string): Promise<void>;

  /**
   * Get cache metadata without loading full schema
   */
  getMetadata(databaseName: string): Promise<CacheMetadata | null>;

  /**
   * Check if cache exists for database
   */
  exists(databaseName: string): Promise<boolean>;

  /**
   * List all cached databases
   */
  list(): Promise<string[]>;

  /**
   * Get cache directory path
   */
  getCachePath(databaseName: string): string;
}
