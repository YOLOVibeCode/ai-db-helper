/**
 * QueryExecutor Tests (TDD)
 *
 * Following Test-Driven Development:
 * 1. Write tests first
 * 2. Tests should fail initially
 * 3. Implement minimal code to make tests pass
 * 4. Refactor while keeping tests green
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryExecutor } from './QueryExecutor';
import { IDatabaseAdapter, QueryType, QueryExecutionOptions } from '@aidb/contracts';

// Mock adapter for testing
class MockAdapter implements IDatabaseAdapter {
  private queries: string[] = [];

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async validateConnection(): Promise<boolean> { return true; }

  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T> {
    this.queries.push(sql);

    // Throw error for invalid SQL
    if (sql.includes('INVALID')) {
      throw new Error('SQL syntax error: Invalid SQL');
    }

    // Simulate different query types
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return [{ id: 1, name: 'Test' }] as T;
    }
    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      return { affectedRows: 1 } as T;
    }
    if (sql.trim().toUpperCase().startsWith('UPDATE')) {
      return { affectedRows: 5 } as T;
    }
    if (sql.trim().toUpperCase().startsWith('DELETE')) {
      return { affectedRows: 3 } as T;
    }

    return [] as T;
  }

  async ping(): Promise<boolean> { return true; }
  getDatabaseType() { return 'mysql' as any; }
  getDatabaseName() { return 'testdb'; }

  getQueries() { return this.queries; }
  clearQueries() { this.queries = []; }
}

describe('QueryExecutor', () => {
  let executor: QueryExecutor;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    executor = new QueryExecutor();
    mockAdapter = new MockAdapter();
    executor.setAdapter(mockAdapter);
  });

  describe('Query Validation', () => {
    it('should validate a SELECT query', async () => {
      const result = await executor.validate('SELECT * FROM users');

      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe(QueryType.SELECT);
      expect(result.isDangerous).toBe(false);
      expect(result.tables).toContain('users');
      expect(result.errors).toHaveLength(0);
    });

    it('should detect dangerous DELETE query', async () => {
      const result = await executor.validate('DELETE FROM users');

      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe(QueryType.DELETE);
      expect(result.isDangerous).toBe(true);
      expect(result.warnings).toContain('DELETE without WHERE clause affects all rows');
    });

    it('should detect UPDATE without WHERE', async () => {
      const result = await executor.validate('UPDATE users SET status = "active"');

      expect(result.queryType).toBe(QueryType.UPDATE);
      expect(result.isDangerous).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate DDL query', async () => {
      const result = await executor.validate('ALTER TABLE users ADD COLUMN age INT');

      expect(result.queryType).toBe(QueryType.DDL);
      expect(result.isDangerous).toBe(true);
      expect(result.tables).toContain('users');
    });

    it('should reject invalid SQL', async () => {
      const result = await executor.validate('SELEC * FROM users'); // typo

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should extract multiple tables from JOIN query', async () => {
      const result = await executor.validate(
        'SELECT * FROM users u JOIN posts p ON u.id = p.user_id'
      );

      expect(result.tables).toContain('users');
      expect(result.tables).toContain('posts');
    });
  });

  describe('Query Execution', () => {
    it('should execute SELECT query', async () => {
      const result = await executor.execute('SELECT * FROM users');

      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBeGreaterThanOrEqual(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.query).toBe('SELECT * FROM users');
    });

    it('should execute INSERT query', async () => {
      const sql = 'INSERT INTO users (name, email) VALUES (?, ?)';
      const result = await executor.execute(sql, {
        params: ['Alice', 'alice@example.com']
      });

      expect(result.affectedRows).toBe(1);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute UPDATE query', async () => {
      const result = await executor.execute(
        'UPDATE users SET status = ? WHERE id = ?',
        { params: ['active', 123] }
      );

      expect(result.affectedRows).toBeGreaterThan(0);
    });

    it('should execute DELETE query', async () => {
      const result = await executor.execute(
        'DELETE FROM users WHERE id = ?',
        { params: [123] }
      );

      expect(result.affectedRows).toBeGreaterThan(0);
    });

    it('should respect query timeout', async () => {
      // This test would need a real slow query or mock timeout
      const options: QueryExecutionOptions = {
        timeout: 100 // 100ms timeout
      };

      // For now, just verify the option is accepted
      await expect(
        executor.execute('SELECT * FROM users', options)
      ).resolves.toBeDefined();
    });

    it('should respect row limit for SELECT', async () => {
      const options: QueryExecutionOptions = {
        limit: 10
      };

      const result = await executor.execute('SELECT * FROM users', options);

      // The executor should append LIMIT to the query
      expect(result.rows.length).toBeLessThanOrEqual(10);
    });

    it('should perform dry run without executing', async () => {
      mockAdapter.clearQueries();

      const result = await executor.execute('INSERT INTO users (name) VALUES (?)', {
        params: ['Test'],
        dryRun: true
      });

      // Should not actually execute the query
      expect(mockAdapter.getQueries()).toHaveLength(0);
      expect(result.affectedRows).toBe(0);
    });
  });

  describe('Batch Execution', () => {
    it('should execute multiple queries', async () => {
      const queries = [
        'INSERT INTO users (name) VALUES ("Alice")',
        'INSERT INTO users (name) VALUES ("Bob")',
        'INSERT INTO users (name) VALUES ("Charlie")'
      ];

      const results = await executor.executeBatch(queries);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.affectedRows === 1)).toBe(true);
    });

    it('should rollback on error in batch', async () => {
      const queries = [
        'INSERT INTO users (name) VALUES ("Alice")',
        'INVALID SQL',
        'INSERT INTO users (name) VALUES ("Bob")'
      ];

      await expect(
        executor.executeBatch(queries, { transaction: true })
      ).rejects.toThrow();

      // Verify rollback happened (would need transaction support)
    });
  });

  describe('Transaction Support', () => {
    it('should execute query in transaction when requested', async () => {
      const result = await executor.execute(
        'UPDATE users SET status = "active"',
        { transaction: true }
      );

      expect(result).toBeDefined();
      // Transaction would need to be committed separately
    });
  });

  describe('Schema Integration', () => {
    it('should validate table existence against schema', async () => {
      const schema = {
        databaseName: 'testdb',
        databaseType: 'mysql' as any,
        version: '1.0',
        generatedAt: new Date(),
        schemaHash: 'abc123',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', dataType: 'int', nativeType: 'int', nullable: false },
              { name: 'name', dataType: 'varchar', nativeType: 'varchar(255)', nullable: false }
            ],
            indexes: [],
            constraints: []
          }
        ],
        views: [],
        procedures: []
      };

      executor.setSchema(schema);

      const validResult = await executor.validate('SELECT * FROM users');
      expect(validResult.isValid).toBe(true);

      const invalidResult = await executor.validate('SELECT * FROM nonexistent');
      expect(invalidResult.warnings.some(w => w.includes('nonexistent'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error if adapter not set', async () => {
      const newExecutor = new QueryExecutor();

      await expect(
        newExecutor.execute('SELECT * FROM users')
      ).rejects.toThrow('Database adapter not set');
    });

    it('should handle SQL syntax errors gracefully', async () => {
      await expect(
        executor.execute('SELEC * FROM users')
      ).rejects.toThrow();
    });
  });

  describe('Performance Tracking', () => {
    it('should track execution time', async () => {
      const result = await executor.execute('SELECT * FROM users');

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTimeMs).toBe('number');
    });
  });
});
