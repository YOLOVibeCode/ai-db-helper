/**
 * IQueryPlanner - Interface for query execution plan analysis
 *
 * Analyzes database query execution plans to identify performance issues
 * and optimization opportunities.
 */

import { DatabaseType } from '../types/schema-types';
import { QueryPlan, QueryCostEstimate } from '../types/query-types';

/**
 * Performance metrics for a query
 */
export interface QueryPerformanceMetrics {
  fullTableScans: number;
  missingIndexes: number;
  temporaryTables: number;
  filesorts: number;
  estimatedCost: number;
  estimatedRows: number;
  severity: PerformanceSeverity;
}

export enum PerformanceSeverity {
  OPTIMAL = 'OPTIMAL',         // Query is well optimized
  GOOD = 'GOOD',               // Minor optimization possible
  WARNING = 'WARNING',         // Significant optimization needed
  CRITICAL = 'CRITICAL'        // Major performance issues
}

/**
 * IQueryPlanner - Analyze and optimize query execution plans
 */
export interface IQueryPlanner {
  /**
   * Get execution plan for a query
   */
  getExecutionPlan(
    query: string,
    databaseType: DatabaseType
  ): Promise<QueryPlan>;

  /**
   * Analyze query performance
   */
  analyzePerformance(
    plan: QueryPlan
  ): QueryPerformanceMetrics;

  /**
   * Parse EXPLAIN output from database
   */
  parseExplain(
    explainOutput: any,
    databaseType: DatabaseType
  ): QueryPlan;

  /**
   * Generate recommendations for query optimization
   */
  generateRecommendations(
    plan: QueryPlan
  ): string[];

  /**
   * Estimate query cost
   */
  estimateCost(
    query: string,
    databaseType: DatabaseType
  ): Promise<QueryCostEstimate>;

  /**
   * Compare two query plans
   */
  comparePlans(
    plan1: QueryPlan,
    plan2: QueryPlan
  ): {
    betterPlan: QueryPlan;
    improvements: string[];
    costDifference: number;
  };
}
