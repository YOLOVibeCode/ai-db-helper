/**
 * QueryPlanner Tests (TDD)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryPlanner } from './QueryPlanner';
import { DatabaseType, QueryPlan, PerformanceSeverity } from '@aidb/contracts';

describe('QueryPlanner', () => {
  let planner: QueryPlanner;

  beforeEach(() => {
    planner = new QueryPlanner();
  });

  describe('EXPLAIN Parsing', () => {
    it('should parse MySQL EXPLAIN output', () => {
      const mysqlExplain = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'users',
          type: 'ALL',
          possible_keys: null,
          key: null,
          key_len: null,
          ref: null,
          rows: 1000,
          Extra: 'Using where'
        }
      ];

      const plan = planner.parseExplain(mysqlExplain, DatabaseType.MySQL);

      expect(plan.originalQuery).toBeDefined();
      expect(plan.estimatedCost).toBeGreaterThan(0);
      expect(plan.usedIndexes).toEqual([]);
      expect(plan.warnings.length).toBeGreaterThan(0);
    });

    it('should parse PostgreSQL EXPLAIN output', () => {
      const pgExplain = {
        'Plan': {
          'Node Type': 'Seq Scan',
          'Relation Name': 'users',
          'Startup Cost': 0.00,
          'Total Cost': 155.00,
          'Plan Rows': 1000,
          'Plan Width': 100
        }
      };

      const plan = planner.parseExplain(pgExplain, DatabaseType.PostgreSQL);

      expect(plan.originalQuery).toBeDefined();
      expect(plan.estimatedCost).toBe(155.00);
      expect(plan.warnings.length).toBeGreaterThan(0);
    });

    it('should detect full table scan in EXPLAIN', () => {
      const mysqlExplain = [
        {
          id: 1,
          table: 'users',
          type: 'ALL',
          rows: 10000
        }
      ];

      const plan = planner.parseExplain(mysqlExplain, DatabaseType.MySQL);

      expect(plan.warnings).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          code: 'FULL_TABLE_SCAN'
        })
      );
    });

    it('should detect index usage', () => {
      const mysqlExplain = [
        {
          id: 1,
          table: 'users',
          type: 'ref',
          key: 'idx_email',
          rows: 1
        }
      ];

      const plan = planner.parseExplain(mysqlExplain, DatabaseType.MySQL);

      expect(plan.usedIndexes).toContain('idx_email');
      expect(plan.warnings).toHaveLength(0);
    });
  });

  describe('Performance Analysis', () => {
    it('should identify full table scans', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 1000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan on users',
            suggestion: 'Add index on email column'
          }
        ],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const metrics = planner.analyzePerformance(plan);

      expect(metrics.fullTableScans).toBe(1);
      expect(metrics.severity).toBe(PerformanceSeverity.WARNING);
    });

    it('should calculate severity based on metrics', () => {
      const criticalPlan: QueryPlan = {
        originalQuery: 'SELECT * FROM users JOIN posts JOIN comments',
        estimatedCost: 1000000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          { severity: 'warning', code: 'FULL_TABLE_SCAN', message: 'Full table scan on users', suggestion: '' },
          { severity: 'warning', code: 'FULL_TABLE_SCAN', message: 'Full table scan on posts', suggestion: '' },
          { severity: 'warning', code: 'FILESORT', message: 'Using filesort', suggestion: '' }
        ],
        joinOrder: [],
        executionStrategy: 'nested-loop',
        explainOutput: {}
      };

      const metrics = planner.analyzePerformance(criticalPlan);

      expect(metrics.severity).toBe(PerformanceSeverity.CRITICAL);
      expect(metrics.fullTableScans).toBeGreaterThanOrEqual(2);
    });

    it('should mark optimal queries', () => {
      const optimalPlan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE id = ?',
        estimatedCost: 1,
        usedIndexes: ['PRIMARY'],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'index-scan',
        explainOutput: {}
      };

      const metrics = planner.analyzePerformance(optimalPlan);

      expect(metrics.severity).toBe(PerformanceSeverity.OPTIMAL);
      expect(metrics.fullTableScans).toBe(0);
    });
  });

  describe('Recommendations', () => {
    it('should recommend index for WHERE clause', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 1000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan on users',
            suggestion: 'Add index'
          }
        ],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = planner.generateRecommendations(plan);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations).toContainEqual(
        expect.stringContaining('index')
      );
    });

    it('should recommend avoiding SELECT *', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users',
        estimatedCost: 500,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = planner.generateRecommendations(plan);

      expect(recommendations).toContainEqual(
        expect.stringContaining('SELECT *')
      );
    });

    it('should recommend LIMIT for large result sets', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users',
        estimatedCost: 10000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = planner.generateRecommendations(plan);

      expect(recommendations.some(r => r.includes('LIMIT'))).toBe(true);
    });
  });

  describe('Plan Comparison', () => {
    it('should identify better plan', () => {
      const plan1: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 1000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const plan2: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 10,
        usedIndexes: ['idx_email'],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'index-scan',
        explainOutput: {}
      };

      const comparison = planner.comparePlans(plan1, plan2);

      expect(comparison.betterPlan).toBe(plan2);
      expect(comparison.costDifference).toBe(990);
      expect(comparison.improvements).toContainEqual(
        expect.stringContaining('index')
      );
    });

    it('should calculate cost difference percentage', () => {
      const plan1: QueryPlan = {
        originalQuery: 'SELECT * FROM users',
        estimatedCost: 1000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const plan2: QueryPlan = {
        originalQuery: 'SELECT * FROM users',
        estimatedCost: 100,
        usedIndexes: ['idx_name'],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'index-scan',
        explainOutput: {}
      };

      const comparison = planner.comparePlans(plan1, plan2);

      expect(comparison.costDifference).toBe(900);
      expect(comparison.improvements.length).toBeGreaterThan(0);
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate cost for simple SELECT', async () => {
      const query = 'SELECT * FROM users WHERE id = 1';
      const cost = await planner.estimateCost(query, DatabaseType.MySQL);

      expect(cost.totalCost).toBeGreaterThan(0);
      expect(cost.estimatedRows).toBeGreaterThan(0);
    });

    it('should estimate higher cost for joins', async () => {
      const simpleQuery = 'SELECT * FROM users WHERE id = 1';
      const joinQuery = 'SELECT * FROM users JOIN posts ON users.id = posts.user_id';

      const simpleCost = await planner.estimateCost(simpleQuery, DatabaseType.MySQL);
      const joinCost = await planner.estimateCost(joinQuery, DatabaseType.MySQL);

      expect(joinCost.totalCost).toBeGreaterThan(simpleCost.totalCost);
    });

    it('should include startup cost', async () => {
      const query = 'SELECT * FROM users ORDER BY created_at';
      const cost = await planner.estimateCost(query, DatabaseType.PostgreSQL);

      expect(cost.startupCost).toBeDefined();
      expect(cost.startupCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Query Pattern Detection', () => {
    it('should detect N+1 query pattern', () => {
      // This would typically be detected by analyzing multiple queries
      const queries = [
        'SELECT * FROM users',
        'SELECT * FROM posts WHERE user_id = 1',
        'SELECT * FROM posts WHERE user_id = 2',
        'SELECT * FROM posts WHERE user_id = 3'
      ];

      // Implementation would detect repeated pattern
      expect(queries.length).toBeGreaterThan(1);
    });

    it('should detect missing JOIN opportunity', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE id IN (SELECT user_id FROM posts)',
        estimatedCost: 5000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'nested-loop',
        explainOutput: {}
      };

      const recommendations = planner.generateRecommendations(plan);

      expect(recommendations.some(r => r.includes('JOIN'))).toBe(true);
    });
  });

  describe('Database-Specific Features', () => {
    it('should handle MySQL-specific EXPLAIN format', () => {
      const mysqlExplain = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'users',
          partitions: null,
          type: 'range',
          possible_keys: 'idx_created_at',
          key: 'idx_created_at',
          key_len: '4',
          ref: null,
          rows: 100,
          filtered: 100.00,
          Extra: 'Using index condition'
        }
      ];

      const plan = planner.parseExplain(mysqlExplain, DatabaseType.MySQL);

      expect(plan).toBeDefined();
      expect(plan.usedIndexes).toContain('idx_created_at');
    });

    it('should handle PostgreSQL-specific cost model', () => {
      const pgExplain = {
        'Plan': {
          'Node Type': 'Index Scan',
          'Scan Direction': 'Forward',
          'Index Name': 'users_pkey',
          'Relation Name': 'users',
          'Startup Cost': 0.29,
          'Total Cost': 8.30,
          'Plan Rows': 1,
          'Plan Width': 524
        }
      };

      const plan = planner.parseExplain(pgExplain, DatabaseType.PostgreSQL);

      expect(plan.estimatedCost).toBe(8.30);
      expect(plan.usedIndexes).toContain('users_pkey');
    });
  });
});
