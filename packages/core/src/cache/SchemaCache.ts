/**
 * SchemaCache - Persistent storage for database schemas
 *
 * Features:
 * - JSON-based schema storage
 * - SHA-256 hash for change detection
 * - Optional gzip compression
 * - Metadata tracking (last refresh, version, size)
 * - Fast retrieval (<100ms target)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { ISchemaCache, DatabaseSchema, CacheMetadata } from '@aidb/contracts';
import { DirectoryManager } from '../infrastructure/DirectoryManager';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export class SchemaCache implements ISchemaCache {
  private readonly directoryManager: DirectoryManager;
  private readonly compressionEnabled: boolean;

  constructor(directoryManager: DirectoryManager, compressionEnabled = true) {
    this.directoryManager = directoryManager;
    this.compressionEnabled = compressionEnabled;
  }

  /**
   * Save schema to cache
   */
  async save(databaseName: string, schema: DatabaseSchema): Promise<void> {
    this.validateDatabaseName(databaseName);

    // Generate schema hash
    const schemaHash = this.generateHash(schema);

    // Update schema with hash
    schema.schemaHash = schemaHash;
    schema.generatedAt = new Date();

    // Serialize to JSON
    const schemaJson = JSON.stringify(schema, this.jsonReplacer, 2);

    // Optionally compress
    let content: Buffer;
    if (this.compressionEnabled) {
      content = await gzipAsync(schemaJson);
    } else {
      content = Buffer.from(schemaJson, 'utf-8');
    }

    // Write schema file
    const schemaPath = this.getSchemaFilePath(databaseName);
    await fs.writeFile(schemaPath, content);

    // Write metadata file
    const metadata: CacheMetadata = {
      databaseName,
      schemaHash,
      lastRefresh: schema.generatedAt,
      version: schema.version,
      compressed: this.compressionEnabled,
      sizeBytes: content.length
    };

    const metadataPath = this.getMetadataFilePath(databaseName);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    // Set readable permissions
    await fs.chmod(schemaPath, 0o644);
    await fs.chmod(metadataPath, 0o644);
  }

  /**
   * Load schema from cache
   */
  async load(databaseName: string): Promise<DatabaseSchema | null> {
    this.validateDatabaseName(databaseName);

    const schemaPath = this.getSchemaFilePath(databaseName);

    try {
      // Read file
      const content = await fs.readFile(schemaPath);

      // Decompress if needed
      let schemaJson: string;
      if (this.compressionEnabled) {
        const decompressed = await gunzipAsync(content);
        schemaJson = decompressed.toString('utf-8');
      } else {
        schemaJson = content.toString('utf-8');
      }

      // Parse JSON with custom reviver
      const schema: DatabaseSchema = JSON.parse(schemaJson, this.jsonReviver);

      return schema;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw new Error(`Failed to load schema for '${databaseName}': ${error.message}`);
    }
  }

  /**
   * Invalidate (delete) cached schema
   */
  async invalidate(databaseName: string): Promise<void> {
    this.validateDatabaseName(databaseName);

    const schemaPath = this.getSchemaFilePath(databaseName);
    const metadataPath = this.getMetadataFilePath(databaseName);

    // Delete schema file
    try {
      await fs.unlink(schemaPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Delete metadata file
    try {
      await fs.unlink(metadataPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get cache metadata without loading full schema
   */
  async getMetadata(databaseName: string): Promise<CacheMetadata | null> {
    this.validateDatabaseName(databaseName);

    const metadataPath = this.getMetadataFilePath(databaseName);

    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata: CacheMetadata = JSON.parse(content, this.jsonReviver);
      return metadata;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to load metadata for '${databaseName}': ${error.message}`);
    }
  }

  /**
   * Check if cache exists for database
   */
  async exists(databaseName: string): Promise<boolean> {
    this.validateDatabaseName(databaseName);

    const schemaPath = this.getSchemaFilePath(databaseName);

    try {
      await fs.access(schemaPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all cached databases
   */
  async list(): Promise<string[]> {
    const schemasPath = this.directoryManager.getSchemasPath();

    try {
      const files = await fs.readdir(schemasPath);

      // Filter for schema files (*.json or *.json.gz)
      const databases = files
        .filter(file => file.endsWith('.json') || file.endsWith('.json.gz'))
        .map(file => {
          // Remove extension
          return file.replace(/\.(json|json\.gz)$/, '');
        });

      return databases;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []; // Directory doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Get cache directory path
   */
  getCachePath(databaseName: string): string {
    return this.getSchemaFilePath(databaseName);
  }

  /**
   * Compare schema hashes to detect changes
   */
  async hasSchemaChanged(databaseName: string, newSchema: DatabaseSchema): Promise<boolean> {
    const metadata = await this.getMetadata(databaseName);

    if (!metadata) {
      return true; // No cache exists, consider it changed
    }

    const newHash = this.generateHash(newSchema);
    return metadata.schemaHash !== newHash;
  }

  /**
   * Get cache statistics
   */
  async getStats(databaseName: string): Promise<CacheStats | null> {
    const metadata = await this.getMetadata(databaseName);

    if (!metadata) {
      return null;
    }

    const schemaPath = this.getSchemaFilePath(databaseName);
    const stats = await fs.stat(schemaPath);

    return {
      databaseName,
      sizeBytes: stats.size,
      compressed: metadata.compressed,
      lastModified: stats.mtime,
      lastRefresh: metadata.lastRefresh,
      schemaHash: metadata.schemaHash
    };
  }

  /**
   * Generate SHA-256 hash of schema
   */
  private generateHash(schema: DatabaseSchema): string {
    // Create a normalized copy for hashing (exclude generatedAt and hash)
    const normalized = {
      ...schema,
      generatedAt: undefined,
      schemaHash: undefined
    };

    const schemaJson = JSON.stringify(normalized, null, 0);
    const hash = createHash('sha256');
    hash.update(schemaJson);

    return hash.digest('hex');
  }

  /**
   * Get schema file path
   */
  private getSchemaFilePath(databaseName: string): string {
    const extension = this.compressionEnabled ? '.json.gz' : '.json';
    const filename = `${databaseName}${extension}`;
    return path.join(this.directoryManager.getSchemasPath(), filename);
  }

  /**
   * Get metadata file path
   */
  private getMetadataFilePath(databaseName: string): string {
    const filename = `${databaseName}.meta`;
    return path.join(this.directoryManager.getMetadataPath(), filename);
  }

  /**
   * Validate database name
   */
  private validateDatabaseName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Database name cannot be empty');
    }

    // Prevent path traversal
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error('Invalid database name: cannot contain path separators');
    }
  }

  /**
   * JSON replacer for serialization (handles Map, Date, etc.)
   */
  private jsonReplacer(_key: string, value: any): any {
    if (value instanceof Map) {
      return {
        _type: 'Map',
        _value: Array.from(value.entries())
      };
    }
    if (value instanceof Date) {
      return {
        _type: 'Date',
        _value: value.toISOString()
      };
    }
    return value;
  }

  /**
   * JSON reviver for deserialization (restores Map, Date, etc.)
   */
  private jsonReviver(_key: string, value: any): any {
    if (value && typeof value === 'object' && value._type) {
      if (value._type === 'Map') {
        return new Map(value._value);
      }
      if (value._type === 'Date') {
        return new Date(value._value);
      }
    }
    return value;
  }
}

// Types
export interface CacheStats {
  databaseName: string;
  sizeBytes: number;
  compressed: boolean;
  lastModified: Date;
  lastRefresh: Date;
  schemaHash: string;
}
