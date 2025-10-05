/**
 * Query Executor Interface
 * Executes SQL queries with safety checks and transaction support
 */

import { IDatabaseAdapter } from '../database/IDatabaseAdapter';
import { DatabaseSchema } from '../types/schema-types';

/**
 * Query execution result
 */
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  affectedRows?: number;
  executionTimeMs: number;
  query: string;
}

/**
 * Query execution options
 */
export interface QueryExecutionOptions {
  /**
   * Query timeout in milliseconds
   */
  timeout?: number;

  /**
   * Maximum number of rows to return (for SELECT)
   */
  limit?: number;

  /**
   * Run EXPLAIN before executing
   */
  explain?: boolean;

  /**
   * Dry run - validate and analyze but don't execute
   */
  dryRun?: boolean;

  /**
   * Run in transaction
   */
  transaction?: boolean;

  /**
   * Parameters for parameterized queries
   */
  params?: any[];
}

/**
 * Query type classification
 */
export enum QueryType {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  DDL = 'DDL',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Query validation result
 */
export interface QueryValidation {
  isValid: boolean;
  queryType: QueryType;
  isDangerous: boolean;
  tables: string[];
  estimatedAffectedRows?: number;
  errors: string[];
  warnings: string[];
}

/**
 * Query execution interface
 */
export interface IQueryExecutor {
  /**
   * Execute a SQL query
   * @param sql - SQL query string
   * @param options - Execution options
   */
  execute<T = any>(sql: string, options?: QueryExecutionOptions): Promise<QueryResult<T>>;

  /**
   * Validate a SQL query without executing
   * @param sql - SQL query string
   */
  validate(sql: string): Promise<QueryValidation>;

  /**
   * Execute multiple queries in a transaction
   * @param queries - Array of SQL queries
   * @param options - Execution options
   */
  executeBatch(queries: string[], options?: QueryExecutionOptions): Promise<QueryResult[]>;

  /**
   * Set the database adapter
   * @param adapter - Database adapter instance
   */
  setAdapter(adapter: IDatabaseAdapter): void;

  /**
   * Set the database schema (for validation)
   * @param schema - Database schema
   */
  setSchema(schema: DatabaseSchema): void;
}
