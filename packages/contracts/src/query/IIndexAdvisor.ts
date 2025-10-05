/**
 * IIndexAdvisor - Interface for database index optimization
 *
 * Analyzes queries and schemas to recommend optimal indexes
 * for performance improvement.
 */

import { DatabaseSchema } from '../types/schema-types';
import { QueryPlan, IndexRecommendation } from '../types/query-types';

/**
 * Index usage statistics
 */
export interface IndexUsageStats {
  indexName: string;
  table: string;
  columns: string[];
  usageCount: number;
  lastUsed?: Date;
  selectivity: number;             // 0-1, higher is better
  cardinality: number;             // Distinct values
  isRedundant: boolean;
  redundantWith?: string;          // Name of index that makes this redundant
}

/**
 * Query pattern analysis
 */
export interface QueryPattern {
  tables: string[];
  whereColumns: string[];
  joinColumns: string[];
  orderByColumns: string[];
  groupByColumns: string[];
  frequency: number;               // How often this pattern appears
}

/**
 * IIndexAdvisor - Recommend and analyze database indexes
 */
export interface IIndexAdvisor {
  /**
   * Analyze schema and recommend indexes
   */
  analyzeSchema(
    schema: DatabaseSchema
  ): Promise<IndexRecommendation[]>;

  /**
   * Analyze query and recommend indexes
   */
  analyzeQuery(
    query: string,
    schema: DatabaseSchema
  ): Promise<IndexRecommendation[]>;

  /**
   * Analyze query plan and recommend indexes
   */
  analyzePlan(
    plan: QueryPlan,
    schema: DatabaseSchema
  ): Promise<IndexRecommendation[]>;

  /**
   * Analyze multiple queries to find common patterns
   */
  analyzeQueryPatterns(
    queries: string[],
    schema: DatabaseSchema
  ): Promise<{
    patterns: QueryPattern[];
    recommendations: IndexRecommendation[];
  }>;

  /**
   * Find redundant indexes
   */
  findRedundantIndexes(
    schema: DatabaseSchema
  ): Promise<{
    redundantIndexes: IndexUsageStats[];
    potentialSavings: string;
  }>;

  /**
   * Find unused indexes
   */
  findUnusedIndexes(
    schema: DatabaseSchema,
    usageStats?: IndexUsageStats[]
  ): Promise<IndexUsageStats[]>;

  /**
   * Estimate impact of adding an index
   */
  estimateIndexImpact(
    recommendation: IndexRecommendation,
    schema: DatabaseSchema,
    sampleQueries?: string[]
  ): Promise<{
    improvementPercent: number;
    diskSpaceRequired: number;
    maintenanceOverhead: string;
  }>;

  /**
   * Generate optimal index set for workload
   */
  generateOptimalIndexSet(
    queries: string[],
    schema: DatabaseSchema,
    maxIndexes?: number
  ): Promise<IndexRecommendation[]>;
}
