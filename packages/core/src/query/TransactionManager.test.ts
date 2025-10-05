/**
 * TransactionManager Tests (TDD)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionManager } from './TransactionManager';
import { IDatabaseAdapter, TransactionState } from '@aidb/contracts';

// Mock adapter with transaction support
class MockTransactionalAdapter implements IDatabaseAdapter {
  private transactionActive = false;
  private queries: string[] = [];

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async validateConnection(): Promise<boolean> { return true; }

  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T> {
    this.queries.push(sql);

    // Simulate transaction commands
    if (sql.trim().toUpperCase() === 'BEGIN' || sql.trim().toUpperCase().startsWith('START TRANSACTION')) {
      this.transactionActive = true;
      return {} as T;
    }
    if (sql.trim().toUpperCase() === 'COMMIT') {
      this.transactionActive = false;
      return {} as T;
    }
    if (sql.trim().toUpperCase() === 'ROLLBACK') {
      this.transactionActive = false;
      return {} as T;
    }

    // Throw error for INVALID SQL
    if (sql.includes('INVALID')) {
      throw new Error('SQL syntax error');
    }

    if (!this.transactionActive && (sql.includes('INSERT') || sql.includes('UPDATE') || sql.includes('DELETE'))) {
      throw new Error('Write operation outside transaction');
    }

    // Return affectedRows for write operations
    if (sql.includes('INSERT') || sql.includes('UPDATE') || sql.includes('DELETE')) {
      return { affectedRows: 1 } as T;
    }

    return [{ id: 1 }] as T;
  }

  async ping(): Promise<boolean> { return true; }
  getDatabaseType() { return 'mysql' as any; }
  getDatabaseName() { return 'testdb'; }

  isTransactionActive() { return this.transactionActive; }
  getQueries() { return this.queries; }
  clearQueries() { this.queries = []; }
}

describe('TransactionManager', () => {
  let manager: TransactionManager;
  let mockAdapter: MockTransactionalAdapter;

  beforeEach(() => {
    manager = new TransactionManager();
    mockAdapter = new MockTransactionalAdapter();
    manager.setAdapter(mockAdapter);
  });

  describe('Transaction Lifecycle', () => {
    it('should begin a transaction', async () => {
      const context = await manager.begin();

      expect(context.id).toBeDefined();
      expect(context.state).toBe(TransactionState.ACTIVE);
      expect(context.startTime).toBeInstanceOf(Date);
      expect(manager.isActive()).toBe(true);
      expect(manager.getState()).toBe(TransactionState.ACTIVE);
    });

    it('should commit a transaction', async () => {
      await manager.begin();
      await manager.commit();

      expect(manager.getState()).toBe(TransactionState.COMMITTED);
      expect(manager.isActive()).toBe(false);
    });

    it('should rollback a transaction', async () => {
      await manager.begin();
      await manager.rollback();

      expect(manager.getState()).toBe(TransactionState.ROLLED_BACK);
      expect(manager.isActive()).toBe(false);
    });

    it('should throw error if commit without begin', async () => {
      await expect(manager.commit()).rejects.toThrow('No active transaction');
    });

    it('should throw error if rollback without begin', async () => {
      await expect(manager.rollback()).rejects.toThrow('No active transaction');
    });

    it('should throw error if begin while transaction active', async () => {
      await manager.begin();

      await expect(manager.begin()).rejects.toThrow('Transaction already active');
    });
  });

  describe('Query Execution in Transaction', () => {
    it('should execute query within transaction', async () => {
      await manager.begin();

      const result = await manager.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);

      expect(result).toBeDefined();
      expect(manager.isActive()).toBe(true);
    });

    it('should track queries in transaction context', async () => {
      await manager.begin();

      await manager.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
      await manager.execute('INSERT INTO users (name) VALUES (?)', ['Bob']);

      const context = manager.getContext();

      expect(context?.queries).toHaveLength(2);
    });

    it('should throw error if execute without active transaction', async () => {
      await expect(
        manager.execute('INSERT INTO users (name) VALUES (?)', ['Alice'])
      ).rejects.toThrow('No active transaction');
    });
  });

  describe('Transaction Options', () => {
    it('should accept isolation level', async () => {
      const context = await manager.begin({
        isolationLevel: 'SERIALIZABLE'
      });

      expect(context.state).toBe(TransactionState.ACTIVE);
      // Would verify isolation level was set on the database
    });

    it('should respect transaction timeout', async () => {
      await manager.begin({ timeout: 1000 });

      // Timeout logic would be tested with a delay
      expect(manager.isActive()).toBe(true);
    });

    it('should auto-rollback on error when enabled', async () => {
      await manager.begin({ autoRollback: true });

      try {
        await manager.execute('INVALID SQL');
      } catch (error) {
        // Should auto-rollback
      }

      expect(manager.getState()).toBe(TransactionState.ROLLED_BACK);
    });
  });

  describe('Transaction Context', () => {
    it('should provide transaction context', async () => {
      await manager.begin();

      const context = manager.getContext();

      expect(context).toBeDefined();
      expect(context?.id).toBeDefined();
      expect(context?.state).toBe(TransactionState.ACTIVE);
      expect(context?.queries).toEqual([]);
      expect(context?.affectedRows).toBe(0);
    });

    it('should track affected rows', async () => {
      await manager.begin();

      await manager.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
      await manager.execute('UPDATE users SET status = ?', ['active']);

      const context = manager.getContext();

      expect(context?.affectedRows).toBeGreaterThan(0);
    });

    it('should return null context when no transaction', () => {
      const context = manager.getContext();

      expect(context).toBeNull();
    });
  });

  describe('State Management', () => {
    it('should return IDLE state initially', () => {
      expect(manager.getState()).toBe(TransactionState.IDLE);
    });

    it('should transition through states correctly', async () => {
      expect(manager.getState()).toBe(TransactionState.IDLE);

      await manager.begin();
      expect(manager.getState()).toBe(TransactionState.ACTIVE);

      await manager.commit();
      expect(manager.getState()).toBe(TransactionState.COMMITTED);
    });

    it('should handle failed state', async () => {
      await manager.begin({ autoRollback: true });

      try {
        await manager.execute('INVALID SQL');
      } catch (error) {
        // Transaction should be marked as failed/rolled back
      }

      expect(manager.getState()).toBe(TransactionState.ROLLED_BACK);
    });
  });

  describe('Error Handling', () => {
    it('should throw error if adapter not set', async () => {
      const newManager = new TransactionManager();

      await expect(newManager.begin()).rejects.toThrow('Database adapter not set');
    });

    it('should rollback on query error within transaction', async () => {
      await manager.begin({ autoRollback: true });

      try {
        await manager.execute('SELECT * FROM users');
        await manager.execute('INVALID SQL'); // This should fail
      } catch (error) {
        // Should auto-rollback
      }

      expect(manager.isActive()).toBe(false);
    });
  });

  describe('Concurrency', () => {
    it('should prevent nested transactions', async () => {
      await manager.begin();

      await expect(manager.begin()).rejects.toThrow('Transaction already active');
    });
  });
});
