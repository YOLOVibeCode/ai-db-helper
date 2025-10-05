/**
 * MySQL Adapter Integration Tests
 * Tests with REAL MySQL database via Docker
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MySQLAdapter, MySQLSchemaExtractor } from '@aidb/adapters';
import { ConnectionCredentials, DatabaseType } from '@aidb/contracts';

describe('MySQLAdapter Integration Tests', () => {
  const credentials: ConnectionCredentials = {
    type: DatabaseType.MySQL,
    host: 'localhost',
    port: 3306,
    database: 'testdb',
    username: 'testuser',
    password: 'testpass'
  };

  let adapter: MySQLAdapter;
  let extractor: MySQLSchemaExtractor;

  beforeAll(async () => {
    adapter = new MySQLAdapter();
    await adapter.connect(credentials);
    extractor = new MySQLSchemaExtractor(adapter);
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  it('should connect to MySQL database', async () => {
    const isValid = await adapter.validateConnection();
    expect(isValid).toBe(true);
  });

  it('should get database type', () => {
    expect(adapter.getDatabaseType()).toBe(DatabaseType.MySQL);
  });

  it('should get database name', () => {
    expect(adapter.getDatabaseName()).toBe('testdb');
  });

  it('should ping successfully', async () => {
    const result = await adapter.ping();
    expect(result).toBe(true);
  });

  it('should execute a simple query', async () => {
    const result = await adapter.executeQuery<any[]>('SELECT 1 as num');
    expect(result).toHaveLength(1);
    expect(result[0].num).toBe(1);
  });

  it('should extract tables', async () => {
    const tables = await extractor.extractTables();
    expect(tables).toBeDefined();
    expect(Array.isArray(tables)).toBe(true);

    // Should have test tables from seed data
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');
    expect(tableNames).toContain('comments');
  });

  it('should extract table columns', async () => {
    const tables = await extractor.extractTables();
    const usersTable = tables.find(t => t.name === 'users');

    expect(usersTable).toBeDefined();
    expect(usersTable!.columns).toBeDefined();
    expect(usersTable!.columns.length).toBeGreaterThan(0);

    // Check for expected columns
    const columnNames = usersTable!.columns.map(c => c.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('name');
  });

  it('should detect primary keys', async () => {
    const tables = await extractor.extractTables();
    const usersTable = tables.find(t => t.name === 'users');

    expect(usersTable!.primaryKey).toBeDefined();
    expect(usersTable!.primaryKey!.columns).toContain('id');
  });

  it('should extract foreign keys', async () => {
    const tables = await extractor.extractTables();
    const postsTable = tables.find(t => t.name === 'posts');

    expect(postsTable).toBeDefined();
    expect(postsTable!.constraints.length).toBeGreaterThan(0);

    const userFk = postsTable!.constraints.find(c =>
      c.columns.includes('user_id')
    );

    expect(userFk).toBeDefined();
    expect(userFk!.referencedTable).toBe('users');
    expect(userFk!.referencedColumns).toContain('id');
  });

  it('should extract indexes', async () => {
    const tables = await extractor.extractTables();
    const usersTable = tables.find(t => t.name === 'users');

    expect(usersTable!.indexes).toBeDefined();
    expect(usersTable!.indexes.length).toBeGreaterThan(0);

    // Check for email index
    const emailIndex = usersTable!.indexes.find(idx =>
      idx.columns.includes('email')
    );
    expect(emailIndex).toBeDefined();
  });

  it('should get table row count', async () => {
    const count = await extractor.getTableRowCount('users');
    expect(count).toBeGreaterThanOrEqual(0);
    expect(typeof count).toBe('number');
  });

  it('should detect junction tables', async () => {
    const tables = await extractor.extractTables();
    const junctionTable = tables.find(t => t.name === 'post_tags');

    expect(junctionTable).toBeDefined();
    expect(junctionTable!.constraints.length).toBe(2); // Should have 2 foreign keys
  });

  it('should handle parameterized queries', async () => {
    const result = await adapter.executeQuery<any[]>(
      'SELECT * FROM users WHERE email = ?',
      ['alice@example.com']
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
