/**
 * QueryPlanner Tests
 * 
 * Tests query execution plan analysis with real EXPLAIN parsing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryPlanner } from './QueryPlanner';
import { DatabaseType } from '@aidb/contracts';
import { QueryPlan, QueryPerformanceMetrics, PerformanceSeverity } from '@aidb/contracts';

describe('QueryPlanner', () => {
  let planner: QueryPlanner;

  beforeEach(() => {
    planner = new QueryPlanner();
  });

  describe('MySQL EXPLAIN parsing', () => {
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

      expect(plan).toBeDefined();
      expect(plan.originalQuery).toBeDefined();
      expect(plan.usedIndexes).toEqual([]);
      expect(plan.estimatedCost).toBeGreaterThan(0);
      expect(plan.explainOutput).toEqual(mysqlExplain);
    });

    it('should detect missing index in MySQL EXPLAIN', () => {
      const mysqlExplain = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'users',
          type: 'ALL',
          possible_keys: null,
          key: null,
          rows: 10000,
          Extra: 'Using where'
        }
      ];

      const plan = planner.parseExplain(mysqlExplain, DatabaseType.MySQL);
      
      expect(plan.warnings.length).toBeGreaterThan(0);
      expect(plan.warnings.some(w => w.code === 'FULL_TABLE_SCAN')).toBe(true);
    });

    it('should detect index usage in MySQL EXPLAIN', () => {
      const mysqlExplain = [
        {
          id: 1,
          select_type: 'SIMPLE',
          table: 'users',
          type: 'ref',
          possible_keys: 'idx_email',
          key: 'idx_email',
          key_len: '255',
          ref: 'const',
          rows: 1,
          Extra: ''
        }
      ];

      const plan = planner.parseExplain(mysqlExplain, DatabaseType.MySQL);
      
      expect(plan.usedIndexes).toContain('idx_email');
      expect(plan.estimatedCost).toBeLessThan(100);
    });
  });

  describe('PostgreSQL EXPLAIN parsing', () => {
    it('should parse PostgreSQL EXPLAIN JSON output', () => {
      const pgExplain = [
        {
          Plan: {
            'Node Type': 'Seq Scan',
            'Relation Name': 'users',
            'Alias': 'users',
            'Total Cost': 15.50,
            'Plan Rows': 100,
            'Plan Width': 40
          }
        }
      ];

      const plan = planner.parseExplain(pgExplain, DatabaseType.PostgreSQL);

      expect(plan).toBeDefined();
      expect(plan.estimatedCost).toBe(15.50);
      expect(plan.warnings.length).toBeGreaterThan(0);
    });

    it('should detect index scan in PostgreSQL', () => {
      const pgExplain = [
        {
          Plan: {
            'Node Type': 'Index Scan',
            'Relation Name': 'users',
            'Index Name': 'idx_users_email',
            'Total Cost': 8.30,
            'Plan Rows': 1,
            'Plan Width': 40
          }
        }
      ];

      const plan = planner.parseExplain(pgExplain, DatabaseType.PostgreSQL);

      expect(plan.usedIndexes).toContain('idx_users_email');
      expect(plan.executionStrategy).toBe('index-scan');
    });
  });

  describe('MSSQL EXPLAIN parsing', () => {
    it('should parse MSSQL execution plan XML', () => {
      // Simplified MSSQL plan structure
      const mssqlPlan = {
        StatementText: 'SELECT * FROM users WHERE email = @email',
        EstimatedTotalCost: 0.5,
        TableScans: ['users'],
        IndexSeeks: []
      };

      const plan = planner.parseExplain(mssqlPlan, DatabaseType.MSSQL);

      expect(plan).toBeDefined();
      expect(plan.estimatedCost).toBe(0.5);
    });
  });

  describe('analyzePerformance', () => {
    it('should detect full table scan', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users',
        estimatedCost: 10000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan detected',
            suggestion: 'Add index',
            affectedTable: 'users'
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

    it('should classify optimal query', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE id = 1',
        estimatedCost: 1,
        usedIndexes: ['PRIMARY'],
        suggestedIndexes: [],
        warnings: [],
        joinOrder: [],
        executionStrategy: 'index-scan',
        explainOutput: {}
      };

      const metrics = planner.analyzePerformance(plan);

      expect(metrics.severity).toBe(PerformanceSeverity.OPTIMAL);
      expect(metrics.fullTableScans).toBe(0);
    });

    it('should detect critical performance issues', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users u JOIN posts p ON u.id = p.user_id',
        estimatedCost: 100000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan on users',
            suggestion: 'Add index',
            affectedTable: 'users'
          },
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan on posts',
            suggestion: 'Add index',
            affectedTable: 'posts'
          }
        ],
        joinOrder: [],
        executionStrategy: 'nested-loop',
        explainOutput: {}
      };

      const metrics = planner.analyzePerformance(plan);

      expect(metrics.severity).toBe(PerformanceSeverity.CRITICAL);
      expect(metrics.fullTableScans).toBe(2);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate index recommendations', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 5000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FULL_TABLE_SCAN',
            message: 'Full table scan detected',
            suggestion: 'Consider adding index on email column',
            affectedTable: 'users'
          }
        ],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = planner.generateRecommendations(plan);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('index'))).toBe(true);
    });

    it('should recommend query rewrite for filesort', () => {
      const plan: QueryPlan = {
        originalQuery: 'SELECT * FROM users ORDER BY created_at',
        estimatedCost: 8000,
        usedIndexes: [],
        suggestedIndexes: [],
        warnings: [
          {
            severity: 'warning',
            code: 'FILESORT',
            message: 'Using filesort',
            suggestion: 'Add index on created_at',
            affectedTable: 'users'
          }
        ],
        joinOrder: [],
        executionStrategy: 'table-scan',
        explainOutput: {}
      };

      const recommendations = planner.generateRecommendations(plan);

      expect(recommendations.some(r => r.toLowerCase().includes('order by'))).toBe(true);
    });
  });

  describe('comparePlans', () => {
    it('should identify better plan with lower cost', () => {
      const plan1: QueryPlan = {
        originalQuery: 'SELECT * FROM users WHERE email = ?',
        estimatedCost: 5000,
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

      expect(comparison.betterPlan).toEqual(plan2);
      expect(comparison.costDifference).toBeGreaterThan(0);
      expect(comparison.improvements.length).toBeGreaterThan(0);
    });
  });

  describe('estimateCost', () => {
    it('should estimate query cost based on structure', async () => {
      const query = 'SELECT * FROM users WHERE email = ?';
      
      const estimate = await planner.estimateCost(query, DatabaseType.MySQL);

      expect(estimate.totalCost).toBeGreaterThan(0);
      expect(estimate.estimatedRows).toBeGreaterThan(0);
    });
  });
});
