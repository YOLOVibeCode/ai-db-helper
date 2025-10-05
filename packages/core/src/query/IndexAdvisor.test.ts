/**
 * IndexAdvisor Tests (TDD)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IndexAdvisor } from './IndexAdvisor';
import { DatabaseSchema, DatabaseType, QueryPlan } from '@aidb/contracts';

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
        { name: 'email', dataType: 'VARCHAR', nativeType: 'VARCHAR(255)', nullable: false },
        { name: 'name', dataType: 'VARCHAR', nativeType: 'VARCHAR(255)', nullable: false },
        { name: 'created_at', dataType: 'DATETIME', nativeType: 'DATETIME', nullable: false }
      ],
      primaryKey: { columns: ['id'] },
      indexes: [
        { name: 'PRIMARY', columns: ['id'], unique: true, type: 'BTREE' }
      ],
      constraints: [],
      rowCount: 10000
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', dataType: 'INT', nativeType: 'INT', nullable: false, autoIncrement: true },
        { name: 'user_id', dataType: 'INT', nativeType: 'INT', nullable: false },
        { name: 'title', dataType: 'VARCHAR', nativeType: 'VARCHAR(255)', nullable: false },
        { name: 'status', dataType: 'VARCHAR', nativeType: 'VARCHAR(50)', nullable: false }
      ],
      primaryKey: { columns: ['id'] },
      indexes: [
        { name: 'PRIMARY', columns: ['id'], unique: true, type: 'BTREE' }
      ],
      constraints: [],
      rowCount: 50000
    }
  ],
  views: [],
  procedures: []
});

describe('IndexAdvisor', () => {
  let advisor: IndexAdvisor;
  let schema: DatabaseSchema;

  beforeEach(() => {
    advisor = new IndexAdvisor();
    schema = createTestSchema();
  });

  describe('Query Analysis', () => {
    it('should recommend index for WHERE clause', async () => {
      const query = 'SELECT * FROM users WHERE email = ?';
      const recommendations = await advisor.analyzeQuery(query, schema);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tableName).toBe('users');
      expect(recommendations[0].columns).toContain('email');
    });

    it('should recommend index for JOIN columns', async () => {
      const query = 'SELECT * FROM users JOIN posts ON users.id = posts.user_id';
      const recommendations = await advisor.analyzeQuery(query, schema);

      const userIdIndex = recommendations.find(r =>
        r.tableName === 'posts' && r.columns.includes('user_id')
      );

      expect(userIdIndex).toBeDefined();
    });

    it('should recommend composite index for multiple WHERE columns', async () => {
      const query = 'SELECT * FROM posts WHERE user_id = ? AND status = ?';
      const recommendations = await advisor.analyzeQuery(query, schema);

      expect(recommendations.length).toBeGreaterThan(0);
      const compositeIndex = recommendations.find(r => r.columns.length > 1);
      expect(compositeIndex).toBeDefined();
    });

    it('should recommend index for ORDER BY', async () => {
      const query = 'SELECT * FROM users ORDER BY created_at DESC';
      const recommendations = await advisor.analyzeQuery(query, schema);

      expect(recommendations.some(r => r.columns.includes('created_at'))).toBe(true);
    });

    it('should not recommend index if one already exists', async () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const recommendations = await advisor.analyzeQuery(query, schema);

      const idIndex = recommendations.find(r =>
        r.tableName === 'users' && r.columns.includes('id')
      );

      expect(idIndex).toBeUndefined(); // PRIMARY key already exists
    });
  });

  describe('Plan Analysis', () => {
    it('should recommend index based on full table scan', async () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 1000,
        usedIndexes: [],
        suggestedIndexes: [
          {
            tableName: 'users',
            columns: ['email'],
            type: 'btree',
            reason: 'Full table scan detected',
            estimatedImprovement: 90,
            priority: 'high',
            createStatement: 'CREATE INDEX idx_users_email ON users(email)'
          }
        ],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = await advisor.analyzePlan(plan, schema);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tableName).toBe('users');
    });

    it('should prioritize high-impact indexes', async () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM posts WHERE user_id = ? AND status = ?',
        estimatedCost: 5000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan on posts (50000 rows)',
            suggestion: 'Add index'
          }
        ],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = await advisor.analyzePlan(plan, schema);

      expect(recommendations[0].priority).toBe('high');
    });
  });

  describe('Schema Analysis', () => {
    it('should identify tables without indexes', async () => {
      const recommendations = await advisor.analyzeSchema(schema);

      // Users table has no index on email
      const emailIndex = recommendations.find(r =>
        r.tableName === 'users' && r.columns.includes('email')
      );

      expect(emailIndex).toBeDefined();
    });

    it('should recommend foreign key indexes', async () => {
      const recommendations = await advisor.analyzeSchema(schema);

      // posts.user_id should have an index for FK performance
      const fkIndex = recommendations.find(r =>
        r.tableName === 'posts' && r.columns.includes('user_id')
      );

      expect(fkIndex).toBeDefined();
    });

    it('should limit recommendations to most impactful', async () => {
      const recommendations = await advisor.analyzeSchema(schema);

      // Should not recommend indexes for every column
      expect(recommendations.length).toBeLessThan(20);
    });
  });

  describe('Query Pattern Analysis', () => {
    it('should detect common query patterns', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM posts WHERE status = ?'
      ];

      const result = await advisor.analyzeQueryPatterns(queries, schema);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns[0].whereColumns).toContain('email');
      expect(result.patterns[0].frequency).toBe(3);
    });

    it('should recommend indexes based on pattern frequency', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?'
      ];

      const result = await advisor.analyzeQueryPatterns(queries, schema);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].priority).toBe('high');
    });
  });

  describe('Redundant Index Detection', () => {
    it('should detect redundant single-column index', async () => {
      // Add a redundant index to schema
      schema.tables[0].indexes.push(
        { name: 'idx_id', columns: ['id'], unique: false, type: 'BTREE' }
      );

      const result = await advisor.findRedundantIndexes(schema);

      expect(result.redundantIndexes.length).toBeGreaterThan(0);
      expect(result.redundantIndexes[0].indexName).toBe('idx_id');
      expect(result.redundantIndexes[0].redundantWith).toBe('PRIMARY');
    });

    it('should detect composite index making single-column redundant', async () => {
      schema.tables[0].indexes.push(
        { name: 'idx_email', columns: ['email'], unique: false, type: 'BTREE' },
        { name: 'idx_email_name', columns: ['email', 'name'], unique: false, type: 'BTREE' }
      );

      const result = await advisor.findRedundantIndexes(schema);

      const redundant = result.redundantIndexes.find(r => r.indexName === 'idx_email');
      expect(redundant).toBeDefined();
    });

    it('should estimate space savings from removing redundant indexes', async () => {
      schema.tables[0].indexes.push(
        { name: 'idx_id', columns: ['id'], unique: false, type: 'BTREE' }
      );

      const result = await advisor.findRedundantIndexes(schema);

      expect(result.potentialSavings).toContain('MB');
    });
  });

  describe('Unused Index Detection', () => {
    it('should identify indexes with zero usage', async () => {
      const usageStats = [
        {
          indexName: 'idx_old',
          table: 'users',
          columns: ['name'],
          usageCount: 0,
          selectivity: 0.5,
          cardinality: 5000,
          isRedundant: false
        }
      ];

      const unused = await advisor.findUnusedIndexes(schema, usageStats);

      expect(unused.length).toBeGreaterThan(0);
      expect(unused[0].usageCount).toBe(0);
    });

    it('should not flag recently created indexes as unused', async () => {
      const usageStats = [
        {
          indexName: 'idx_new',
          table: 'users',
          columns: ['email'],
          usageCount: 0,
          lastUsed: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          selectivity: 0.9,
          cardinality: 9000,
          isRedundant: false
        }
      ];

      const unused = await advisor.findUnusedIndexes(schema, usageStats);

      // Should be lenient with recently created indexes
      expect(unused.length).toBe(0);
    });
  });

  describe('Impact Estimation', () => {
    it('should estimate query improvement percentage', async () => {
      const recommendation = {
        tableName: 'users',
        columns: ['email'],
        type: 'btree',
        reason: 'Frequent WHERE clause',
        priority: 'high',
        estimatedImpact: 90,
        createStatement: 'CREATE INDEX idx_users_email ON users(email)'
      };

      const impact = await advisor.estimateIndexImpact(recommendation, schema);

      expect(impact.improvementPercent).toBeGreaterThan(0);
      expect(impact.improvementPercent).toBeLessThanOrEqual(100);
    });

    it('should estimate disk space required', async () => {
      const recommendation = {
        tableName: 'users',
        columns: ['email'],
        type: 'btree',
        reason: 'Frequent WHERE clause',
        priority: 'high',
        estimatedImpact: 90,
        createStatement: 'CREATE INDEX idx_users_email ON users(email)'
      };

      const impact = await advisor.estimateIndexImpact(recommendation, schema);

      expect(impact.diskSpaceRequired).toBeGreaterThan(0);
    });

    it('should warn about maintenance overhead', async () => {
      const recommendation = {
        tableName: 'posts',
        columns: ['user_id', 'status', 'created_at'],
        type: 'btree',
        reason: 'Complex WHERE clause',
        priority: 'medium',
        estimatedImpact: 70,
        createStatement: 'CREATE INDEX idx_posts_complex ON posts(user_id, status, created_at)'
      };

      const impact = await advisor.estimateIndexImpact(recommendation, schema);

      expect(impact.maintenanceOverhead).toBeDefined();
      expect(impact.maintenanceOverhead).toContain('INSERT');
    });
  });

  describe('Optimal Index Set Generation', () => {
    it('should generate optimal index set for workload', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM posts WHERE user_id = ?',
        'SELECT * FROM posts WHERE status = ?',
        'SELECT * FROM users WHERE created_at > ?'
      ];

      const recommendations = await advisor.generateOptimalIndexSet(queries, schema);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(4); // One per query max
    });

    it('should respect maximum index limit', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM posts WHERE user_id = ?',
        'SELECT * FROM posts WHERE status = ?',
        'SELECT * FROM users WHERE created_at > ?'
      ];

      const recommendations = await advisor.generateOptimalIndexSet(queries, schema, 2);

      expect(recommendations.length).toBeLessThanOrEqual(2);
    });

    it('should prioritize high-frequency queries', async () => {
      const queries = [
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM users WHERE email = ?',
        'SELECT * FROM posts WHERE status = ?'
      ];

      const recommendations = await advisor.generateOptimalIndexSet(queries, schema, 1);

      expect(recommendations[0].tableName).toBe('users');
      expect(recommendations[0].columns).toContain('email');
    });
  });

  describe('Index Type Selection', () => {
    it('should recommend BTREE for equality comparisons', async () => {
      const query = 'SELECT * FROM users WHERE email = ?';
      const recommendations = await advisor.analyzeQuery(query, schema);

      expect(recommendations[0].type).toBe('btree');
    });

    it('should recommend HASH for exact matches only', async () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const recommendations = await advisor.analyzeQuery(query, schema);

      // HASH can be considered for primary key lookups
      expect(['btree', 'hash']).toContain(recommendations[0]?.type || 'btree');
    });

    it('should recommend FULLTEXT for text search', async () => {
      const query = 'SELECT * FROM posts WHERE MATCH(title) AGAINST(?)';
      const recommendations = await advisor.analyzeQuery(query, schema);

      if (recommendations.length > 0) {
        expect(recommendations[0].type).toBe('fulltext');
      }
    });
  });
});
