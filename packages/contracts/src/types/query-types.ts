/**
 * Query planning and optimization type definitions
 */

import { JoinStep } from './relationship-types';

/**
 * Query execution plan
 */
export interface QueryPlan {
  originalQuery: string;
  optimizedQuery?: string;
  estimatedCost: number;
  usedIndexes: string[];
  suggestedIndexes: IndexSuggestion[];
  warnings: QueryWarning[];
  joinOrder: JoinStep[];
  executionStrategy: ExecutionStrategy;
  explainOutput: any;
}

export type ExecutionStrategy =
  | 'nested-loop'
  | 'hash-join'
  | 'merge-join'
  | 'index-scan'
  | 'table-scan';

/**
 * Index suggestion
 */
export interface IndexSuggestion {
  tableName: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'fulltext';
  reason: string;
  estimatedImprovement: number;
  priority: 'low' | 'medium' | 'high';
  createStatement: string;
}

/**
 * Query warning
 */
export interface QueryWarning {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion: string;
  affectedTable?: string;
}

/**
 * Query cost estimate
 */
export interface QueryCostEstimate {
  totalCost: number;
  startupCost: number;
  estimatedRows: number;
  estimatedWidth?: number;
  executionTimeMs?: number;
}

/**
 * Index recommendation
 */
export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  type: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: number;
  usageCount?: number;
  createStatement: string;
}

/**
 * Join clause
 */
export interface JoinClause {
  table: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  onCondition: string;
  estimatedRows?: number;
}

/**
 * Query for analysis
 */
export interface Query {
  sql: string;
  executionCount: number;
  averageTimeMs: number;
  lastExecuted: Date;
}

/**
 * Index definition
 */
export interface IndexDefinition {
  name: string;
  tableName: string;
  columns: string[];
  type: string;
  unique: boolean;
  sizeBytes?: number;
  usageCount?: number;
}
