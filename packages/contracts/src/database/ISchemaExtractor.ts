/**
 * Schema extraction interface
 * Database-specific implementations extract schema information
 */

import {
  TableSchema,
  ViewSchema,
  ProcedureSchema,
  IndexSchema,
  ConstraintSchema,
  TableFilter
} from '../types/schema-types';

export interface ISchemaExtractor {
  /**
   * Extract all tables from database
   * @param filter - Optional filter for table selection
   */
  extractTables(filter?: TableFilter): Promise<TableSchema[]>;

  /**
   * Extract all views
   */
  extractViews(): Promise<ViewSchema[]>;

  /**
   * Extract stored procedures
   */
  extractStoredProcedures(): Promise<ProcedureSchema[]>;

  /**
   * Extract indexes for a specific table or all tables
   */
  extractIndexes(tableName?: string): Promise<IndexSchema[]>;

  /**
   * Extract constraints for a specific table or all tables
   */
  extractConstraints(tableName?: string): Promise<ConstraintSchema[]>;

  /**
   * Get row count for a table
   */
  getTableRowCount(tableName: string): Promise<number>;

  /**
   * Get table size in bytes
   */
  getTableSize(tableName: string): Promise<number>;

  /**
   * Get list of all schemas for databases that support schemas
   */
  getSchemas(): Promise<string[]>;
}
