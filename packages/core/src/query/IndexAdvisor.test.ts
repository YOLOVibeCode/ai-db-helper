/**
 * IndexAdvisor Tests
 *
 * Tests index recommendation and analysis with real scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IndexAdvisor } from './IndexAdvisor';
import {
  DatabaseSchema,
  TableSchema,
  ColumnSchema,
  IndexSchema,
  IndexRecommendation,
  QueryPlan,
  DatabaseType,
  IndexType
} from '@aidb/contracts';

describe('IndexAdvisor', () => {
  let advisor: IndexAdvisor;
  let sampleSchema: DatabaseSchema;

  beforeEach(() => {
    advisor = new IndexAdvisor();

    // Create sample schema
    const usersTable: TableSchema = {
      name: 'users',
      columns: [
        { name: 'id', dataType: 'int', nativeType: 'INT', nullable: false, autoIncrement: true },
        { name: 'email', dataType: 'varchar', nativeType: 'VARCHAR(255)', nullable: false },
        { name: 'name', dataType: 'varchar', nativeType: 'VARCHAR(100)', nullable: true },
        { name: 'created_at', dataType: 'timestamp', nativeType: 'TIMESTAMP', nullable: false }
      ],
      indexes: [
        { name: 'PRIMARY', tableName: 'users', columns: ['id'], unique: true, type: IndexType.BTree }
      ],
      constraints: [],
      primaryKey: { name: 'PRIMARY', columns: ['id'] },
      rowCount: 10000
    };

    const postsTable: TableSchema = {
      name: 'posts',
      columns: [
        { name: 'id', dataType: 'int', nativeType: 'INT', nullable: false, autoIncrement: true },
        { name: 'user_id', dataType: 'int', nativeType: 'INT', nullable: false },
        { name: 'title', dataType: 'varchar', nativeType: 'VARCHAR(255)', nullable: false },
        { name: 'created_at', dataType: 'timestamp', nativeType: 'TIMESTAMP', nullable: false }
      ],
      indexes: [
        { name: 'PRIMARY', tableName: 'posts', columns: ['id'], unique: true, type: IndexType.BTree }
      ],
      constraints: [
        { name: 'fk_posts_user', type: 'FOREIGN KEY', tableName: 'posts', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] }
      ],
      primaryKey: { name: 'PRIMARY', columns: ['id'] },
      rowCount: 50000
    };

    sampleSchema = {
      databaseName: 'testdb',
      databaseType: DatabaseType.MySQL,
      tables: [usersTable, postsTable],
      views: [],
      procedures: [],
      functions: []
    };
  });

  describe('analyzeSchema', () => {
    it('should detect missing foreign key index', async () => {
      const recommendations = await advisor.analyzeSchema(sampleSchema);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Should recommend index on posts.user_id (FK but no index)
      const userIdIndex = recommendations.find(
        r => r.tableName === 'posts' && r.columns.includes('user_id')
      );
      expect(userIdIndex).toBeDefined();
      expect(userIdIndex!.reason.toLowerCase()).toContain('foreign key');
      expect(userIdIndex!.priority).toBe('high');
    });

    it('should detect high-cardinality columns (email)', async () => {
      const recommendations = await advisor.analyzeSchema(sampleSchema);

      // Should recommend index on users.email (high-cardinality pattern)
      const emailRec = recommendations.find(
        r => r.tableName === 'users' && r.columns.includes('email')
      );
      expect(emailRec).toBeDefined();
      expect(emailRec!.priority).toBe('medium'); // High-cardinality gets medium priority
    });

    it('should not recommend indexes for small tables', async () => {
      // Create small table
      const smallTable: TableSchema = {
        name: 'config',
        columns: [
          { name: 'key', dataType: 'varchar', nativeType: 'VARCHAR(50)', nullable: false },
          { name: 'value', dataType: 'text', nativeType: 'TEXT', nullable: true }
        ],
        indexes: [],
        constraints: [],
        rowCount: 10
      };

      const smallSchema: DatabaseSchema = {
        ...sampleSchema,
        tables: [smallTable]
      };

      const recommendations = await advisor.analyzeSchema(smallSchema);

      // Should have no recommendations for tiny table
      expect(recommendations.length).toBe(0);
    });
  });

  describe('analyzeQuery', () => {
    it('should recommend index for WHERE clause column', async () => {
      const query = 'SELECT * FROM users WHERE email = ?';
      
      const recommendations = await advisor.analyzeQuery(query, sampleSchema);

      expect(recommendations.length).toBeGreaterThan(0);
      const emailIndex = recommendations.find(
        r => r.tableName === 'users' && r.columns.includes('email')
      );
      expect(emailIndex).toBeDefined();
    });

    it('should recommend composite index for WHERE + ORDER BY', async () => {
      const query = 'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC';
      
      const recommendations = await advisor.analyzeQuery(query, sampleSchema);

      const compositeIndex = recommendations.find(
        r => r.tableName === 'posts' && 
        r.columns.includes('user_id') && 
        r.columns.includes('created_at')
      );
      expect(compositeIndex).toBeDefined();
    });

    it('should recommend index for JOIN columns', async () => {
      const query = 'SELECT * FROM users u JOIN posts p ON u.id = p.user_id';
      
      const recommendations = await advisor.analyzeQuery(query, sampleSchema);

      const joinIndex = recommendations.find(
        r => r.tableName === 'posts' && r.columns.includes('user_id')
      );
      expect(joinIndex).toBeDefined();
    });
  });

  describe('analyzePlan', () => {
    it('should recommend indexes based on query plan warnings', async () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 5000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan on users',
            suggestion: 'Add index on email',
            affectedTable: 'users'
          }
        ],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = await advisor.analyzePlan(plan, sampleSchema);

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeQueryPatterns', () => {
    it('should identify common query patterns', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ? AND name = ?',
        'SELECT * FROM posts WHERE user_id = ?',
        'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC'
      ];

      const result = await advisor.analyzeQueryPatterns(queries, sampleSchema);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should detect that email is frequently queried
      const emailPattern = result.patterns.some(
        p => p.whereColumns.includes('email')
      );
      expect(emailPattern).toBe(true);
    });

    it('should recommend indexes for frequent patterns', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?'
      ];

      const result = await advisor.analyzeQueryPatterns(queries, sampleSchema);

      const emailRec = result.recommendations.find(
        r => r.tableName === 'users' && r.columns.includes('email')
      );
      expect(emailRec).toBeDefined();
      expect(emailRec!.usageCount).toBe(3);
    });
  });

  describe('findRedundantIndexes', () => {
    it('should detect redundant indexes', async () => {
      const tableWithRedundant: TableSchema = {
        name: 'users',
        columns: [
          { name: 'id', dataType: 'int', nativeType: 'INT', nullable: false },
          { name: 'email', dataType: 'varchar', nativeType: 'VARCHAR(255)', nullable: false },
          { name: 'name', dataType: 'varchar', nativeType: 'VARCHAR(100)', nullable: true }
        ],
        indexes: [
          { name: 'PRIMARY', tableName: 'users', columns: ['id'], unique: true, type: IndexType.BTree },
          { name: 'idx_email', tableName: 'users', columns: ['email'], unique: false, type: IndexType.BTree },
          { name: 'idx_email_name', tableName: 'users', columns: ['email', 'name'], unique: false, type: IndexType.BTree }
        ],
        constraints: [],
        primaryKey: { name: 'PRIMARY', columns: ['id'] },
        rowCount: 10000
      };

      const schemaWithRedundant: DatabaseSchema = {
        ...sampleSchema,
        tables: [tableWithRedundant]
      };

      const result = await advisor.findRedundantIndexes(schemaWithRedundant);

      expect(result.redundantIndexes.length).toBeGreaterThan(0);
      // idx_email is redundant because idx_email_name starts with email
      const redundant = result.redundantIndexes.find(
        idx => idx.indexName === 'idx_email'
      );
      expect(redundant).toBeDefined();
    });
  });

  describe('estimateIndexImpact', () => {
    it('should estimate performance improvement', async () => {
      const recommendation: IndexRecommendation = {
        tableName: 'users',
        columns: ['email'],
        type: 'btree',
        reason: 'Frequently queried in WHERE clause',
        priority: 'high',
        estimatedImpact: 80,
        createStatement: 'CREATE INDEX idx_users_email ON users(email)'
      };

      const sampleQueries = [
        'SELECT * FROM users WHERE email = ?'
      ];

      const impact = await advisor.estimateIndexImpact(
        recommendation,
        sampleSchema,
        sampleQueries
      );

      expect(impact.improvementPercent).toBeGreaterThan(0);
      expect(impact.improvementPercent).toBeLessThanOrEqual(100);
      expect(impact.diskSpaceRequired).toBeGreaterThan(0);
      expect(impact.maintenanceOverhead).toBeDefined();
    });
  });

  describe('generateOptimalIndexSet', () => {
    it('should generate optimal index set for workload', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM posts WHERE user_id = ?',
        'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC'
      ];

      const recommendations = await advisor.generateOptimalIndexSet(
        queries,
        sampleSchema,
        5 // max 5 indexes
      );

      expect(recommendations.length).toBeLessThanOrEqual(5);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should have at least one high-priority recommendation (frequently used email column)
      const hasHighPriority = recommendations.some(r => r.priority === 'high' || r.usageCount && r.usageCount >= 2);
      expect(hasHighPriority).toBe(true);
    });

    it('should respect max indexes limit', async () => {
      const queries = Array(20).fill('SELECT * FROM users WHERE email = ?');
      
      const recommendations = await advisor.generateOptimalIndexSet(
        queries,
        sampleSchema,
        3
      );

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });
  });
});
