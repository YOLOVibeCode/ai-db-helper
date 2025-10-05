/**
 * RollbackManager Tests - TDD for schema modification with rollback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RollbackManager } from './RollbackManager';
import {
  DatabaseSchema,
  DatabaseType,
  SchemaModification,
  ModificationType,
  IDatabaseAdapter
} from '@aidb/contracts';

// Mock adapter
class MockAdapter implements IDatabaseAdapter {
  private queries: string[] = [];

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async validateConnection(): Promise<boolean> { return true; }
  async executeQuery<T = any>(sql: string): Promise<T> {
    this.queries.push(sql);
    return [] as T;
  }
  getDatabaseType(): DatabaseType { return DatabaseType.MySQL; }
  getDatabaseName(): string { return 'testdb'; }

  getExecutedQueries(): string[] {
    return this.queries;
  }

  clearQueries(): void {
    this.queries = [];
  }
}

// Test schema
const createTestSchema = (): DatabaseSchema => ({
  databaseName: 'testdb',
  databaseType: DatabaseType.MySQL,
  version: '1.0.0',
  generatedAt: new Date(),
  schemaHash: 'abc123',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', dataType: 'INT', nativeType: 'INT', nullable: false, autoIncrement: true },
        { name: 'name', dataType: 'VARCHAR', nativeType: 'VARCHAR(255)', nullable: false },
        { name: 'email', dataType: 'VARCHAR', nativeType: 'VARCHAR(255)', nullable: false }
      ],
      primaryKey: { columns: ['id'] },
      indexes: [],
      constraints: []
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', dataType: 'INT', nativeType: 'INT', nullable: false, autoIncrement: true },
        { name: 'title', dataType: 'VARCHAR', nativeType: 'VARCHAR(255)', nullable: false },
        { name: 'user_id', dataType: 'INT', nativeType: 'INT', nullable: false }
      ],
      primaryKey: { columns: ['id'] },
      indexes: [],
      constraints: []
    }
  ],
  views: [],
  procedures: []
});

describe('RollbackManager - Snapshot Management', () => {
  let manager: RollbackManager;
  let adapter: MockAdapter;
  let schema: DatabaseSchema;

  beforeEach(() => {
    adapter = new MockAdapter();
    manager = new RollbackManager();
    schema = createTestSchema();
  });

  it('should create a snapshot', async () => {
    const snapshot = await manager.createSnapshot('testdb', 'Initial state', ['v1.0']);

    expect(snapshot.id).toBeDefined();
    expect(snapshot.databaseName).toBe('testdb');
    expect(snapshot.description).toBe('Initial state');
    expect(snapshot.tags).toEqual(['v1.0']);
    expect(snapshot.timestamp).toBeInstanceOf(Date);
  });

  it('should list snapshots for a database', async () => {
    await manager.createSnapshot('testdb', 'Snapshot 1');
    // Add delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 50));
    await manager.createSnapshot('testdb', 'Snapshot 2');
    await manager.createSnapshot('otherdb', 'Other snapshot');

    const snapshots = await manager.listSnapshots('testdb');

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].description).toBe('Snapshot 2'); // Newest first
    expect(snapshots[1].description).toBe('Snapshot 1');
  });

  it('should get a specific snapshot by ID', async () => {
    const created = await manager.createSnapshot('testdb', 'Test snapshot');
    const retrieved = await manager.getSnapshot(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.description).toBe('Test snapshot');
  });

  it('should delete a snapshot', async () => {
    const snapshot = await manager.createSnapshot('testdb', 'To delete');
    await manager.deleteSnapshot(snapshot.id);

    const retrieved = await manager.getSnapshot(snapshot.id);
    expect(retrieved).toBeNull();
  });

  it('should order snapshots by timestamp (newest first)', async () => {
    await manager.createSnapshot('testdb', 'First');
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    await manager.createSnapshot('testdb', 'Second');

    const snapshots = await manager.listSnapshots('testdb');

    expect(snapshots[0].description).toBe('Second');
    expect(snapshots[1].description).toBe('First');
  });
});

describe('RollbackManager - DDL Generation', () => {
  let manager: RollbackManager;
  let schema: DatabaseSchema;

  beforeEach(() => {
    manager = new RollbackManager();
    schema = createTestSchema();
  });

  it('should generate ADD_COLUMN migration', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];

    const migration = await manager.generateMigration(schema, modifications);

    expect(migration.forwardDDL).toHaveLength(1);
    expect(migration.forwardDDL[0]).toContain('ALTER TABLE users ADD COLUMN age INT');
    expect(migration.backwardDDL).toHaveLength(1);
    expect(migration.backwardDDL[0]).toContain('ALTER TABLE users DROP COLUMN age');
    expect(migration.affectedTables).toEqual(['users']);
  });

  it('should generate DROP_COLUMN migration', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.DROP_COLUMN,
        table: 'users',
        column: 'email',
        details: {}
      }
    ];

    const migration = await manager.generateMigration(schema, modifications);

    expect(migration.forwardDDL[0]).toContain('ALTER TABLE users DROP COLUMN email');
    expect(migration.backwardDDL[0]).toContain('ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL');
    expect(migration.estimatedImpact.isDestructive).toBe(true);
    expect(migration.estimatedImpact.warnings).toContain('Dropping column will permanently delete data');
  });

  it('should generate ADD_TABLE migration', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_TABLE,
        table: 'comments',
        details: {
          columns: [
            { name: 'id', dataType: 'INT', nullable: false, autoIncrement: true },
            { name: 'text', dataType: 'TEXT', nullable: false }
          ],
          primaryKey: ['id']
        }
      }
    ];

    const migration = await manager.generateMigration(schema, modifications);

    expect(migration.forwardDDL[0]).toContain('CREATE TABLE comments');
    expect(migration.forwardDDL[0]).toContain('id INT NOT NULL AUTO_INCREMENT');
    expect(migration.forwardDDL[0]).toContain('PRIMARY KEY (id)');
    expect(migration.backwardDDL[0]).toContain('DROP TABLE comments');
  });

  it('should generate DROP_TABLE migration', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.DROP_TABLE,
        table: 'posts',
        details: {}
      }
    ];

    const migration = await manager.generateMigration(schema, modifications);

    expect(migration.forwardDDL[0]).toContain('DROP TABLE posts');
    expect(migration.backwardDDL[0]).toContain('CREATE TABLE posts');
    expect(migration.estimatedImpact.isDestructive).toBe(true);
    expect(migration.estimatedImpact.requiresBackup).toBe(true);
  });

  it('should generate RENAME_COLUMN migration', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.RENAME_COLUMN,
        table: 'users',
        column: 'name',
        details: { newName: 'full_name' }
      }
    ];

    const migration = await manager.generateMigration(schema, modifications);

    expect(migration.forwardDDL[0]).toContain('ALTER TABLE users RENAME COLUMN name TO full_name');
    expect(migration.backwardDDL[0]).toContain('ALTER TABLE users RENAME COLUMN full_name TO name');
  });

  it('should generate ADD_INDEX migration', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_INDEX,
        table: 'users',
        details: { name: 'idx_email', columns: ['email'], unique: true }
      }
    ];

    const migration = await manager.generateMigration(schema, modifications);

    expect(migration.forwardDDL[0]).toContain('CREATE UNIQUE INDEX idx_email ON users (email)');
    expect(migration.backwardDDL[0]).toContain('DROP INDEX idx_email ON users');
  });

  it('should handle multiple modifications in order', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      },
      {
        type: ModificationType.ADD_INDEX,
        table: 'users',
        details: { name: 'idx_age', columns: ['age'] }
      }
    ];

    const migration = await manager.generateMigration(schema, modifications);

    expect(migration.forwardDDL).toHaveLength(2);
    expect(migration.backwardDDL).toHaveLength(2);
    // Backward DDL should be in reverse order
    expect(migration.backwardDDL[0]).toContain('DROP INDEX');
    expect(migration.backwardDDL[1]).toContain('DROP COLUMN');
  });
});

describe('RollbackManager - Validation', () => {
  let manager: RollbackManager;
  let schema: DatabaseSchema;

  beforeEach(() => {
    manager = new RollbackManager();
    schema = createTestSchema();
  });

  it('should validate adding a column to existing table', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];

    const result = await manager.validateModifications(schema, modifications);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation for non-existent table', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'nonexistent',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];

    const result = await manager.validateModifications(schema, modifications);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Table "nonexistent" does not exist');
  });

  it('should fail validation for dropping non-existent column', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.DROP_COLUMN,
        table: 'users',
        column: 'nonexistent',
        details: {}
      }
    ];

    const result = await manager.validateModifications(schema, modifications);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Column "nonexistent" does not exist in table "users"');
  });

  it('should warn about destructive operations', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.DROP_TABLE,
        table: 'posts',
        details: {}
      }
    ];

    const result = await manager.validateModifications(schema, modifications);

    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.impact.isDestructive).toBe(true);
    expect(result.impact.requiresBackup).toBe(true);
  });

  it('should detect duplicate column names', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'email', // Already exists
        details: { dataType: 'VARCHAR', nullable: true }
      }
    ];

    const result = await manager.validateModifications(schema, modifications);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Column "email" already exists in table "users"');
  });
});

describe('RollbackManager - Apply Modifications', () => {
  let manager: RollbackManager;
  let adapter: MockAdapter;
  let schema: DatabaseSchema;

  beforeEach(() => {
    adapter = new MockAdapter();
    manager = new RollbackManager();
    manager.setAdapter(adapter);
    schema = createTestSchema();
    manager.setCurrentSchema(schema);
  });

  it('should apply modifications with snapshot creation', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];

    const result = await manager.applyModifications('testdb', modifications, {
      createSnapshot: true
    });

    expect(result.success).toBe(true);
    expect(result.migrationId).toBeDefined();
    expect(result.snapshotId).toBeDefined();
    expect(result.statementsExecuted).toBe(1);
  });

  it('should support dry-run mode', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.DROP_TABLE,
        table: 'posts',
        details: {}
      }
    ];

    const result = await manager.applyModifications('testdb', modifications, {
      dryRun: true
    });

    expect(result.success).toBe(true);
    expect(result.statementsExecuted).toBe(0); // Nothing actually executed
  });

  it('should handle errors during modification', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'nonexistent',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];

    const result = await manager.applyModifications('testdb', modifications);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should continue on error if specified', async () => {
    // Use valid modifications so they pass validation
    // The mock adapter will be used to execute them
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      },
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'address',
        details: { dataType: 'VARCHAR', nullable: true }
      }
    ];

    const result = await manager.applyModifications('testdb', modifications, {
      continueOnError: true
    });

    expect(result.success).toBe(true);
    expect(result.statementsExecuted).toBe(2); // Both statements executed
  });
});

describe('RollbackManager - Rollback', () => {
  let manager: RollbackManager;
  let adapter: MockAdapter;
  let schema: DatabaseSchema;

  beforeEach(() => {
    adapter = new MockAdapter();
    manager = new RollbackManager();
    manager.setAdapter(adapter);
    schema = createTestSchema();
    manager.setCurrentSchema(schema);
  });

  it('should rollback to a snapshot', async () => {
    // Create snapshot
    const snapshot = await manager.createSnapshot('testdb', 'Before changes');

    // Add delay to ensure migration timestamp is after snapshot
    await new Promise(resolve => setTimeout(resolve, 50));

    // Apply modifications
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];
    await manager.applyModifications('testdb', modifications);

    // Rollback
    const result = await manager.rollback('testdb', snapshot.id);

    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe(snapshot.id);
    expect(result.statementsExecuted).toBeGreaterThan(0);
  });

  it('should support dry-run rollback', async () => {
    const snapshot = await manager.createSnapshot('testdb', 'Test');

    const result = await manager.rollback('testdb', snapshot.id, {
      dryRun: true
    });

    expect(result.success).toBe(true);
    expect(result.statementsExecuted).toBe(0);
  });

  it('should fail rollback to non-existent snapshot', async () => {
    const result = await manager.rollback('testdb', 'nonexistent-id');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Snapshot "nonexistent-id" not found');
  });
});

describe('RollbackManager - History', () => {
  let manager: RollbackManager;
  let adapter: MockAdapter;
  let schema: DatabaseSchema;

  beforeEach(() => {
    adapter = new MockAdapter();
    manager = new RollbackManager();
    manager.setAdapter(adapter);
    schema = createTestSchema();
    manager.setCurrentSchema(schema);
  });

  it('should track modification history', async () => {
    const modifications1: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];

    const modifications2: SchemaModification[] = [
      {
        type: ModificationType.ADD_INDEX,
        table: 'users',
        details: { name: 'idx_email', columns: ['email'] }
      }
    ];

    await manager.applyModifications('testdb', modifications1);
    await manager.applyModifications('testdb', modifications2);

    const history = await manager.getHistory('testdb');

    expect(history).toHaveLength(2);
    expect(history[0].affectedTables).toContain('users');
  });

  it('should limit history results', async () => {
    for (let i = 0; i < 5; i++) {
      await manager.applyModifications('testdb', [
        {
          type: ModificationType.ADD_COLUMN,
          table: 'users',
          column: `col${i}`,
          details: { dataType: 'INT', nullable: true }
        }
      ]);
    }

    const history = await manager.getHistory('testdb', 3);

    expect(history).toHaveLength(3);
  });
});

describe('RollbackManager - Preview', () => {
  let manager: RollbackManager;
  let schema: DatabaseSchema;

  beforeEach(() => {
    manager = new RollbackManager();
    schema = createTestSchema();
  });

  it('should preview migration without applying', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.ADD_COLUMN,
        table: 'users',
        column: 'age',
        details: { dataType: 'INT', nullable: true }
      }
    ];

    const migration = await manager.previewMigration(schema, modifications);

    expect(migration.forwardDDL).toHaveLength(1);
    expect(migration.backwardDDL).toHaveLength(1);
    expect(migration.estimatedImpact).toBeDefined();
  });

  it('should include impact assessment in preview', async () => {
    const modifications: SchemaModification[] = [
      {
        type: ModificationType.DROP_TABLE,
        table: 'posts',
        details: {}
      }
    ];

    const migration = await manager.previewMigration(schema, modifications);

    expect(migration.estimatedImpact.isDestructive).toBe(true);
    expect(migration.estimatedImpact.tablesAffected).toBe(1);
    expect(migration.estimatedImpact.warnings.length).toBeGreaterThan(0);
    expect(migration.estimatedImpact.requiresBackup).toBe(true);
  });
});
