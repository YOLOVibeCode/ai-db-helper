/**
 * RollbackManager - Manage schema modifications with rollback support
 *
 * Features:
 * - Create snapshots before schema changes
 * - Generate forward/backward DDL migrations
 * - Apply modifications with automatic rollback support
 * - Validate modifications before applying
 * - Track modification history
 */

import { v4 as uuidv4 } from 'uuid';
import {
  IRollbackManager,
  SchemaSnapshot,
  DDLMigration,
  SchemaModification,
  ModificationType,
  RollbackResult,
  ModificationResult,
  ModificationOptions,
  RollbackOptions,
  ValidationResult,
  DatabaseSchema,
  DatabaseType,
  TableSchema,
  ColumnSchema,
  IDatabaseAdapter
} from '@aidb/contracts';

export class RollbackManager implements IRollbackManager {
  private snapshots: Map<string, SchemaSnapshot> = new Map();
  private migrations: Map<string, DDLMigration> = new Map();
  private adapter?: IDatabaseAdapter;
  private currentSchema?: DatabaseSchema;

  /**
   * Set database adapter for executing DDL
   */
  setAdapter(adapter: IDatabaseAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Set current schema (for testing or when schema is already loaded)
   */
  setCurrentSchema(schema: DatabaseSchema): void {
    this.currentSchema = schema;
  }

  /**
   * Create a snapshot of current schema state
   */
  async createSnapshot(
    databaseName: string,
    description?: string,
    tags?: string[]
  ): Promise<SchemaSnapshot> {
    const snapshot: SchemaSnapshot = {
      id: uuidv4(),
      databaseName,
      timestamp: new Date(),
      schema: {
        databaseName,
        databaseType: this.adapter?.getDatabaseType() || DatabaseType.MySQL,
        version: '1.0.0',
        generatedAt: new Date(),
        schemaHash: uuidv4(),
        tables: [],
        views: [],
        procedures: []
      },
      description,
      tags
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  /**
   * List all snapshots for a database
   */
  async listSnapshots(databaseName: string): Promise<SchemaSnapshot[]> {
    const snapshots = Array.from(this.snapshots.values())
      .filter(s => s.databaseName === databaseName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

    return snapshots;
  }

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<SchemaSnapshot | null> {
    return this.snapshots.get(snapshotId) || null;
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    this.snapshots.delete(snapshotId);
  }

  /**
   * Generate DDL migration from modifications
   */
  async generateMigration(
    currentSchema: DatabaseSchema,
    modifications: SchemaModification[]
  ): Promise<DDLMigration> {
    const forwardDDL: string[] = [];
    const backwardDDL: string[] = [];
    const affectedTables = new Set<string>();
    let isDestructive = false;
    const warnings: string[] = [];

    for (const mod of modifications) {
      affectedTables.add(mod.table);

      switch (mod.type) {
        case ModificationType.ADD_COLUMN:
          forwardDDL.push(this.generateAddColumn(mod));
          backwardDDL.unshift(this.generateDropColumn(mod.table, mod.column!));
          break;

        case ModificationType.DROP_COLUMN:
          const column = this.findColumn(currentSchema, mod.table, mod.column!);
          if (column) {
            forwardDDL.push(this.generateDropColumn(mod.table, mod.column!));
            backwardDDL.unshift(this.generateAddColumnFromSchema(mod.table, column));
            isDestructive = true;
            warnings.push('Dropping column will permanently delete data');
          }
          break;

        case ModificationType.ADD_TABLE:
          forwardDDL.push(this.generateAddTable(mod));
          backwardDDL.unshift(`DROP TABLE ${mod.table}`);
          break;

        case ModificationType.DROP_TABLE:
          const table = this.findTable(currentSchema, mod.table);
          if (table) {
            forwardDDL.push(`DROP TABLE ${mod.table}`);
            backwardDDL.unshift(this.generateCreateTableFromSchema(table));
            isDestructive = true;
            warnings.push('Dropping table will permanently delete all data');
          }
          break;

        case ModificationType.RENAME_COLUMN:
          forwardDDL.push(
            `ALTER TABLE ${mod.table} RENAME COLUMN ${mod.column} TO ${mod.details.newName}`
          );
          backwardDDL.unshift(
            `ALTER TABLE ${mod.table} RENAME COLUMN ${mod.details.newName} TO ${mod.column}`
          );
          break;

        case ModificationType.RENAME_TABLE:
          forwardDDL.push(`ALTER TABLE ${mod.table} RENAME TO ${mod.details.newName}`);
          backwardDDL.unshift(`ALTER TABLE ${mod.details.newName} RENAME TO ${mod.table}`);
          break;

        case ModificationType.ADD_INDEX:
          forwardDDL.push(this.generateAddIndex(mod));
          backwardDDL.unshift(`DROP INDEX ${mod.details.name} ON ${mod.table}`);
          break;

        case ModificationType.DROP_INDEX:
          forwardDDL.push(`DROP INDEX ${mod.details.name} ON ${mod.table}`);
          // Note: Cannot recreate index without knowing its definition
          warnings.push('Dropping index cannot be fully reversed without original definition');
          break;

        case ModificationType.MODIFY_COLUMN:
          forwardDDL.push(this.generateModifyColumn(mod));
          const originalColumn = this.findColumn(currentSchema, mod.table, mod.column!);
          if (originalColumn) {
            backwardDDL.unshift(this.generateModifyColumnFromSchema(mod.table, originalColumn));
          }
          break;

        case ModificationType.ADD_CONSTRAINT:
          forwardDDL.push(this.generateAddConstraint(mod));
          backwardDDL.unshift(`ALTER TABLE ${mod.table} DROP CONSTRAINT ${mod.details.name}`);
          break;

        case ModificationType.DROP_CONSTRAINT:
          forwardDDL.push(`ALTER TABLE ${mod.table} DROP CONSTRAINT ${mod.details.name}`);
          warnings.push('Dropping constraint cannot be fully reversed without original definition');
          break;
      }
    }

    const migration: DDLMigration = {
      id: uuidv4(),
      snapshotId: '',
      timestamp: new Date(),
      description: `Applied ${modifications.length} modification(s)`,
      forwardDDL,
      backwardDDL,
      affectedTables: Array.from(affectedTables),
      estimatedImpact: {
        isDestructive,
        tablesAffected: affectedTables.size,
        warnings,
        requiresBackup: isDestructive
      }
    };

    return migration;
  }

  /**
   * Apply schema modifications
   */
  async applyModifications(
    databaseName: string,
    modifications: SchemaModification[],
    options: ModificationOptions = {}
  ): Promise<ModificationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let statementsExecuted = 0;
    let snapshotId = '';

    try {
      // Validate modifications first
      const schema = await this.getCurrentSchema(databaseName);
      const validation = await this.validateModifications(schema, modifications);

      if (!validation.isValid && !options.continueOnError) {
        return {
          success: false,
          migrationId: '',
          snapshotId: '',
          statementsExecuted: 0,
          errors: validation.errors,
          duration: Date.now() - startTime
        };
      }

      // Create snapshot if requested
      if (options.createSnapshot !== false) {
        const snapshot = await this.createSnapshot(databaseName, 'Pre-modification snapshot');
        snapshotId = snapshot.id;
      }

      // Generate migration
      const migration = await this.generateMigration(schema, modifications);
      migration.snapshotId = snapshotId;
      this.migrations.set(migration.id, migration);

      // Dry run mode
      if (options.dryRun) {
        return {
          success: true,
          migrationId: migration.id,
          snapshotId,
          statementsExecuted: 0,
          errors: [],
          duration: Date.now() - startTime
        };
      }

      // Execute DDL statements
      if (this.adapter) {
        for (const ddl of migration.forwardDDL) {
          try {
            await this.adapter.executeQuery(ddl);
            statementsExecuted++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to execute: ${ddl} - ${errorMsg}`);

            if (!options.continueOnError) {
              break;
            }
          }
        }
      }

      return {
        success: errors.length === 0,
        migrationId: migration.id,
        snapshotId,
        statementsExecuted,
        errors,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        migrationId: '',
        snapshotId,
        statementsExecuted,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Rollback to a specific snapshot
   */
  async rollback(
    _databaseName: string,
    snapshotId: string,
    options: RollbackOptions = {}
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let statementsExecuted = 0;

    try {
      // Get snapshot
      const snapshot = await this.getSnapshot(snapshotId);
      if (!snapshot) {
        return {
          success: false,
          snapshotId,
          statementsExecuted: 0,
          errors: [`Snapshot "${snapshotId}" not found`],
          rollbackDuration: Date.now() - startTime
        };
      }

      // Find migrations after this snapshot
      const migrationsToRevert = Array.from(this.migrations.values())
        .filter(m => m.timestamp > snapshot.timestamp)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Reverse order

      // Dry run mode
      if (options.dryRun) {
        return {
          success: true,
          snapshotId,
          statementsExecuted: 0,
          errors: [],
          rollbackDuration: Date.now() - startTime
        };
      }

      // Execute backward DDL
      if (this.adapter) {
        for (const migration of migrationsToRevert) {
          for (const ddl of migration.backwardDDL) {
            try {
              await this.adapter.executeQuery(ddl);
              statementsExecuted++;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              errors.push(`Failed to execute: ${ddl} - ${errorMsg}`);

              if (!options.continueOnError) {
                break;
              }
            }
          }
        }
      }

      return {
        success: errors.length === 0,
        snapshotId,
        statementsExecuted,
        errors,
        rollbackDuration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        snapshotId,
        statementsExecuted,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        rollbackDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Get modification history
   */
  async getHistory(_databaseName: string, limit?: number): Promise<DDLMigration[]> {
    let migrations = Array.from(this.migrations.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    if (limit) {
      migrations = migrations.slice(0, limit);
    }

    return migrations;
  }

  /**
   * Preview migration without applying
   */
  async previewMigration(
    currentSchema: DatabaseSchema,
    modifications: SchemaModification[]
  ): Promise<DDLMigration> {
    return this.generateMigration(currentSchema, modifications);
  }

  /**
   * Validate modifications before applying
   */
  async validateModifications(
    currentSchema: DatabaseSchema,
    modifications: SchemaModification[]
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let isDestructive = false;
    const affectedTables = new Set<string>();

    for (const mod of modifications) {
      affectedTables.add(mod.table);

      switch (mod.type) {
        case ModificationType.ADD_COLUMN:
        case ModificationType.DROP_COLUMN:
        case ModificationType.MODIFY_COLUMN:
        case ModificationType.RENAME_COLUMN:
          const table = this.findTable(currentSchema, mod.table);
          if (!table) {
            errors.push(`Table "${mod.table}" does not exist`);
            continue;
          }

          if (mod.type === ModificationType.ADD_COLUMN) {
            const existingCol = this.findColumn(currentSchema, mod.table, mod.column!);
            if (existingCol) {
              errors.push(`Column "${mod.column}" already exists in table "${mod.table}"`);
            }
          }

          if (
            mod.type === ModificationType.DROP_COLUMN ||
            mod.type === ModificationType.MODIFY_COLUMN ||
            mod.type === ModificationType.RENAME_COLUMN
          ) {
            const column = this.findColumn(currentSchema, mod.table, mod.column!);
            if (!column) {
              errors.push(`Column "${mod.column}" does not exist in table "${mod.table}"`);
            }
          }

          if (mod.type === ModificationType.DROP_COLUMN) {
            isDestructive = true;
            warnings.push(`Dropping column "${mod.column}" will permanently delete data`);
          }
          break;

        case ModificationType.DROP_TABLE:
          const tableExists = this.findTable(currentSchema, mod.table);
          if (!tableExists) {
            errors.push(`Table "${mod.table}" does not exist`);
          } else {
            isDestructive = true;
            warnings.push(`Dropping table "${mod.table}" will permanently delete all data`);
          }
          break;

        case ModificationType.ADD_TABLE:
          const tableAlreadyExists = this.findTable(currentSchema, mod.table);
          if (tableAlreadyExists) {
            errors.push(`Table "${mod.table}" already exists`);
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      impact: {
        isDestructive,
        tablesAffected: affectedTables.size,
        warnings,
        requiresBackup: isDestructive
      }
    };
  }

  // Helper methods

  private async getCurrentSchema(_databaseName: string): Promise<DatabaseSchema> {
    // If schema was set explicitly (for testing), use it
    if (this.currentSchema) {
      return this.currentSchema;
    }

    // In a real implementation, this would load from cache or extract from database
    // For now, return a minimal schema
    return {
      databaseName: _databaseName,
      databaseType: this.adapter?.getDatabaseType() || DatabaseType.MySQL,
      version: '1.0.0',
      generatedAt: new Date(),
      schemaHash: uuidv4(),
      tables: [],
      views: [],
      procedures: []
    };
  }

  private findTable(schema: DatabaseSchema, tableName: string): TableSchema | undefined {
    return schema.tables.find(t => t.name === tableName);
  }

  private findColumn(
    schema: DatabaseSchema,
    tableName: string,
    columnName: string
  ): ColumnSchema | undefined {
    const table = this.findTable(schema, tableName);
    return table?.columns.find(c => c.name === columnName);
  }

  private generateAddColumn(mod: SchemaModification): string {
    const nullable = mod.details.nullable ? 'NULL' : 'NOT NULL';
    const autoIncrement = mod.details.autoIncrement ? 'AUTO_INCREMENT' : '';
    const defaultValue = mod.details.defaultValue ? `DEFAULT ${mod.details.defaultValue}` : '';

    return `ALTER TABLE ${mod.table} ADD COLUMN ${mod.column} ${mod.details.dataType} ${nullable} ${autoIncrement} ${defaultValue}`.trim();
  }

  private generateDropColumn(tableName: string, columnName: string): string {
    return `ALTER TABLE ${tableName} DROP COLUMN ${columnName}`;
  }

  private generateAddColumnFromSchema(tableName: string, column: ColumnSchema): string {
    const nullable = column.nullable ? 'NULL' : 'NOT NULL';
    const autoIncrement = column.autoIncrement ? 'AUTO_INCREMENT' : '';
    const defaultValue = column.defaultValue ? `DEFAULT ${column.defaultValue}` : '';

    return `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.nativeType} ${nullable} ${autoIncrement} ${defaultValue}`.trim();
  }

  private generateAddTable(mod: SchemaModification): string {
    const columns = mod.details.columns
      .map((col: any) => {
        const nullable = col.nullable ? 'NULL' : 'NOT NULL';
        const autoIncrement = col.autoIncrement ? 'AUTO_INCREMENT' : '';
        return `${col.name} ${col.dataType} ${nullable} ${autoIncrement}`.trim();
      })
      .join(', ');

    const primaryKey = mod.details.primaryKey
      ? `, PRIMARY KEY (${mod.details.primaryKey.join(', ')})`
      : '';

    return `CREATE TABLE ${mod.table} (${columns}${primaryKey})`;
  }

  private generateCreateTableFromSchema(table: TableSchema): string {
    const columns = table.columns
      .map(col => {
        const nullable = col.nullable ? 'NULL' : 'NOT NULL';
        const autoIncrement = col.autoIncrement ? 'AUTO_INCREMENT' : '';
        const defaultValue = col.defaultValue ? `DEFAULT ${col.defaultValue}` : '';
        return `${col.name} ${col.nativeType} ${nullable} ${autoIncrement} ${defaultValue}`.trim();
      })
      .join(', ');

    const primaryKey = table.primaryKey
      ? `, PRIMARY KEY (${table.primaryKey.columns.join(', ')})`
      : '';

    return `CREATE TABLE ${table.name} (${columns}${primaryKey})`;
  }

  private generateAddIndex(mod: SchemaModification): string {
    const unique = mod.details.unique ? 'UNIQUE' : '';
    const columns = mod.details.columns.join(', ');
    return `CREATE ${unique} INDEX ${mod.details.name} ON ${mod.table} (${columns})`.trim();
  }

  private generateModifyColumn(mod: SchemaModification): string {
    const nullable = mod.details.nullable ? 'NULL' : 'NOT NULL';
    return `ALTER TABLE ${mod.table} MODIFY COLUMN ${mod.column} ${mod.details.dataType} ${nullable}`;
  }

  private generateModifyColumnFromSchema(tableName: string, column: ColumnSchema): string {
    const nullable = column.nullable ? 'NULL' : 'NOT NULL';
    return `ALTER TABLE ${tableName} MODIFY COLUMN ${column.name} ${column.nativeType} ${nullable}`;
  }

  private generateAddConstraint(mod: SchemaModification): string {
    const type = mod.details.type || 'FOREIGN KEY';
    const columns = mod.details.columns?.join(', ') || '';
    const references = mod.details.references
      ? `REFERENCES ${mod.details.references.table}(${mod.details.references.columns.join(', ')})`
      : '';

    return `ALTER TABLE ${mod.table} ADD CONSTRAINT ${mod.details.name} ${type} (${columns}) ${references}`.trim();
  }
}
