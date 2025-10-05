/**
 * MongoDB Adapter Tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MongoDBAdapter } from './MongoDBAdapter';
import { DatabaseType } from '@aidb/contracts';

describe('MongoDBAdapter', () => {
  let adapter: MongoDBAdapter;

  beforeEach(() => {
    adapter = new MongoDBAdapter();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect to MongoDB', async () => {
      const credentials = {
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        database: 'testdb'
        // No username/password - using no-auth mode for tests
      };

      await expect(adapter.connect(credentials)).resolves.not.toThrow();
    });

    it('should disconnect from MongoDB', async () => {
      const credentials = {
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        database: 'testdb'
        // No username/password - using no-auth mode for tests
      };

      await adapter.connect(credentials);
      await expect(adapter.disconnect()).resolves.not.toThrow();
    });

    it('should validate connection', async () => {
      const credentials = {
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        database: 'testdb'
      };

      await adapter.connect(credentials);
      const isValid = await adapter.validateConnection();
      expect(isValid).toBe(true);
    });

    it('should ping successfully', async () => {
      const credentials = {
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        database: 'testdb'
      };

      await adapter.connect(credentials);
      const result = await adapter.ping();
      expect(result).toBe(true);
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      const credentials = {
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        database: 'testdb'
      };
      await adapter.connect(credentials);
    });

    it('should execute find query', async () => {
      // MongoDB uses JSON queries, not SQL
      const query = { collection: 'users', operation: 'find', filter: {} };

      const result = await adapter.executeQuery(JSON.stringify(query));
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute insertOne', async () => {
      const query = {
        collection: 'users',
        operation: 'insertOne',
        document: { name: 'Test User', email: 'test@example.com' }
      };

      const result = await adapter.executeQuery(JSON.stringify(query));
      expect(result).toHaveProperty('insertedId');
    });

    it('should execute updateOne', async () => {
      const query = {
        collection: 'users',
        operation: 'updateOne',
        filter: { email: 'test@example.com' },
        update: { $set: { name: 'Updated User' } }
      };

      const result = await adapter.executeQuery(JSON.stringify(query));
      expect(result).toHaveProperty('modifiedCount');
    });

    it('should execute deleteOne', async () => {
      const query = {
        collection: 'users',
        operation: 'deleteOne',
        filter: { email: 'test@example.com' }
      };

      const result = await adapter.executeQuery(JSON.stringify(query));
      expect(result).toHaveProperty('deletedCount');
    });
  });

  describe('Adapter Properties', () => {
    it('should return correct database type', () => {
      expect(adapter.getDatabaseType()).toBe(DatabaseType.MongoDB);
    });

    it('should return database name after connection', async () => {
      const credentials = {
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        database: 'testdb'
      };

      await adapter.connect(credentials);
      expect(adapter.getDatabaseName()).toBe('testdb');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when executing query without connection', async () => {
      const query = { collection: 'users', operation: 'find', filter: {} };

      await expect(
        adapter.executeQuery(JSON.stringify(query))
      ).rejects.toThrow('Not connected');
    });

    it('should handle invalid connection credentials', async () => {
      const credentials = {
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        database: 'testdb',
        username: 'invalid',
        password: 'wrong'
      };

      await expect(adapter.connect(credentials)).rejects.toThrow();
    });
  });
});
