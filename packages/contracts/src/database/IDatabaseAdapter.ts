/**
 * Core database connection interface
 * All database adapters must implement this interface
 */

import { ConnectionCredentials, DatabaseType } from '../types/schema-types';

export interface IDatabaseAdapter {
  /**
   * Establish connection to database
   */
  connect(credentials: ConnectionCredentials): Promise<void>;

  /**
   * Close database connection
   */
  disconnect(): Promise<void>;

  /**
   * Validate that connection is active
   */
  validateConnection(): Promise<boolean>;

  /**
   * Execute a raw SQL query
   * @param sql - SQL query string
   * @param params - Query parameters for parameterized queries
   */
  executeQuery<T = any>(sql: string, params?: any[]): Promise<T>;

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType;

  /**
   * Get current database name
   */
  getDatabaseName(): string;

  /**
   * Test connection with timeout
   */
  ping(timeoutMs?: number): Promise<boolean>;
}

/**
 * Connection pool management
 */
export interface IConnectionPool {
  /**
   * Get connection from pool
   */
  getConnection(): Promise<IDatabaseAdapter>;

  /**
   * Release connection back to pool
   */
  releaseConnection(connection: IDatabaseAdapter): Promise<void>;

  /**
   * Close all connections in pool
   */
  closeAll(): Promise<void>;

  /**
   * Get pool statistics
   */
  getStats(): PoolStats;
}

export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
}
