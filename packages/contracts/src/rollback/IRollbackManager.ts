/**
 * IRollbackManager - Interface for schema modification with rollback support
 *
 * Enables safe schema modifications by:
 * 1. Creating snapshots before changes
 * 2. Generating forward/backward DDL migrations
 * 3. Supporting rollback to previous states
 * 4. Tracking modification history
 */

import { DatabaseSchema } from '../types/schema-types';

/**
 * Schema snapshot for rollback
 */
export interface SchemaSnapshot {
  id: string;
  databaseName: string;
  timestamp: Date;
  schema: DatabaseSchema;
  description?: string;
  tags?: string[];
}

/**
 * DDL migration representing schema changes
 */
export interface DDLMigration {
  id: string;
  snapshotId: string;
  timestamp: Date;
  description: string;
  forwardDDL: string[];  // SQL statements to apply changes
  backwardDDL: string[]; // SQL statements to rollback changes
  affectedTables: string[];
  estimatedImpact: MigrationImpact;
}

/**
 * Impact assessment for migrations
 */
export interface MigrationImpact {
  isDestructive: boolean;        // Will data be lost?
  tablesAffected: number;
  estimatedDowntimeMs?: number;
  warnings: string[];
  requiresBackup: boolean;
}

/**
 * Schema modification operation
 */
export interface SchemaModification {
  type: ModificationType;
  table: string;
  column?: string;
  details: Record<string, any>;
}

export enum ModificationType {
  ADD_TABLE = 'ADD_TABLE',
  DROP_TABLE = 'DROP_TABLE',
  RENAME_TABLE = 'RENAME_TABLE',
  ADD_COLUMN = 'ADD_COLUMN',
  DROP_COLUMN = 'DROP_COLUMN',
  MODIFY_COLUMN = 'MODIFY_COLUMN',
  RENAME_COLUMN = 'RENAME_COLUMN',
  ADD_INDEX = 'ADD_INDEX',
  DROP_INDEX = 'DROP_INDEX',
  ADD_CONSTRAINT = 'ADD_CONSTRAINT',
  DROP_CONSTRAINT = 'DROP_CONSTRAINT'
}

/**
 * Rollback result
 */
export interface RollbackResult {
  success: boolean;
  snapshotId: string;
  statementsExecuted: number;
  errors: string[];
  rollbackDuration: number;
}

/**
 * Modification result
 */
export interface ModificationResult {
  success: boolean;
  migrationId: string;
  snapshotId: string;
  statementsExecuted: number;
  errors: string[];
  duration: number;
}

/**
 * IRollbackManager - Manage schema modifications with rollback support
 */
export interface IRollbackManager {
  /**
   * Create a snapshot of current schema state
   */
  createSnapshot(
    databaseName: string,
    description?: string,
    tags?: string[]
  ): Promise<SchemaSnapshot>;

  /**
   * List all snapshots for a database
   */
  listSnapshots(databaseName: string): Promise<SchemaSnapshot[]>;

  /**
   * Get a specific snapshot by ID
   */
  getSnapshot(snapshotId: string): Promise<SchemaSnapshot | null>;

  /**
   * Delete a snapshot
   */
  deleteSnapshot(snapshotId: string): Promise<void>;

  /**
   * Generate DDL migration from modifications
   */
  generateMigration(
    currentSchema: DatabaseSchema,
    modifications: SchemaModification[]
  ): Promise<DDLMigration>;

  /**
   * Apply schema modifications
   */
  applyModifications(
    databaseName: string,
    modifications: SchemaModification[],
    options?: ModificationOptions
  ): Promise<ModificationResult>;

  /**
   * Rollback to a specific snapshot
   */
  rollback(
    databaseName: string,
    snapshotId: string,
    options?: RollbackOptions
  ): Promise<RollbackResult>;

  /**
   * Get modification history
   */
  getHistory(databaseName: string, limit?: number): Promise<DDLMigration[]>;

  /**
   * Preview migration without applying
   */
  previewMigration(
    currentSchema: DatabaseSchema,
    modifications: SchemaModification[]
  ): Promise<DDLMigration>;

  /**
   * Validate modifications before applying
   */
  validateModifications(
    currentSchema: DatabaseSchema,
    modifications: SchemaModification[]
  ): Promise<ValidationResult>;
}

/**
 * Options for applying modifications
 */
export interface ModificationOptions {
  createSnapshot?: boolean;      // Create snapshot before applying (default: true)
  dryRun?: boolean;              // Preview only, don't execute (default: false)
  continueOnError?: boolean;     // Continue if a statement fails (default: false)
  timeout?: number;              // Timeout in milliseconds
  backupData?: boolean;          // Backup affected tables (default: false)
}

/**
 * Options for rollback
 */
export interface RollbackOptions {
  dryRun?: boolean;              // Preview only, don't execute (default: false)
  continueOnError?: boolean;     // Continue if a statement fails (default: false)
  timeout?: number;              // Timeout in milliseconds
  verifyData?: boolean;          // Verify data integrity after rollback (default: true)
}

/**
 * Validation result for modifications
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  impact: MigrationImpact;
}
