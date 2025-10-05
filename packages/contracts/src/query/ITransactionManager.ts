/**
 * Transaction Manager Interface
 * Manages database transactions with ACID guarantees
 */

import { IDatabaseAdapter } from '../database/IDatabaseAdapter';

/**
 * Transaction state
 */
export enum TransactionState {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  COMMITTED = 'COMMITTED',
  ROLLED_BACK = 'ROLLED_BACK',
  FAILED = 'FAILED'
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Transaction isolation level
   */
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

  /**
   * Transaction timeout in milliseconds
   */
  timeout?: number;

  /**
   * Auto-rollback on error
   */
  autoRollback?: boolean;
}

/**
 * Transaction context
 */
export interface TransactionContext {
  id: string;
  state: TransactionState;
  startTime: Date;
  queries: string[];
  affectedRows: number;
}

/**
 * Transaction manager interface
 */
export interface ITransactionManager {
  /**
   * Begin a new transaction
   * @param options - Transaction options
   */
  begin(options?: TransactionOptions): Promise<TransactionContext>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Execute a query within the transaction
   * @param sql - SQL query
   * @param params - Query parameters
   */
  execute<T = any>(sql: string, params?: any[]): Promise<T>;

  /**
   * Get current transaction state
   */
  getState(): TransactionState;

  /**
   * Get current transaction context
   */
  getContext(): TransactionContext | null;

  /**
   * Check if a transaction is active
   */
  isActive(): boolean;

  /**
   * Set the database adapter
   * @param adapter - Database adapter instance
   */
  setAdapter(adapter: IDatabaseAdapter): void;
}
