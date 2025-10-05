/**
 * TransactionManager Implementation
 * Manages database transactions with ACID guarantees
 */

import {
  ITransactionManager,
  TransactionState,
  TransactionOptions,
  TransactionContext,
  IDatabaseAdapter
} from '@aidb/contracts';
import { v4 as uuidv4 } from 'uuid';

export class TransactionManager implements ITransactionManager {
  private adapter?: IDatabaseAdapter;
  private context: TransactionContext | null = null;
  private timeoutHandle?: NodeJS.Timeout;
  private autoRollbackEnabled = false;

  /**
   * Set the database adapter
   */
  setAdapter(adapter: IDatabaseAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Begin a new transaction
   */
  async begin(options: TransactionOptions = {}): Promise<TransactionContext> {
    if (!this.adapter) {
      throw new Error('Database adapter not set');
    }

    if (this.context && this.context.state === TransactionState.ACTIVE) {
      throw new Error('Transaction already active');
    }

    // Create transaction context
    this.context = {
      id: uuidv4(),
      state: TransactionState.ACTIVE,
      startTime: new Date(),
      queries: [],
      affectedRows: 0
    };

    try {
      // Start transaction
      const dbType = this.adapter.getDatabaseType();

      if (dbType === 'mysql' || dbType === 'postgres') {
        // Set isolation level if specified
        if (options.isolationLevel) {
          await this.adapter.executeQuery(
            `SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`
          );
        }

        await this.adapter.executeQuery('BEGIN');
      } else if (dbType === 'mssql') {
        await this.adapter.executeQuery('BEGIN TRANSACTION');
      } else if (dbType === 'oracle') {
        // Oracle uses implicit transactions
        // Isolation level set with: SET TRANSACTION ISOLATION LEVEL ...
        if (options.isolationLevel) {
          await this.adapter.executeQuery(
            `SET TRANSACTION ISOLATION LEVEL ${this.mapOracleIsolationLevel(options.isolationLevel)}`
          );
        }
      } else {
        await this.adapter.executeQuery('BEGIN');
      }

      // Store autoRollback option
      this.autoRollbackEnabled = options.autoRollback || false;

      // Set timeout if specified
      if (options.timeout) {
        this.timeoutHandle = setTimeout(async () => {
          if (this.autoRollbackEnabled && this.isActive()) {
            await this.rollback();
          }
        }, options.timeout);
      }

      return this.context;
    } catch (error) {
      this.context.state = TransactionState.FAILED;
      throw error;
    }
  }

  /**
   * Commit the current transaction
   */
  async commit(): Promise<void> {
    if (!this.adapter) {
      throw new Error('Database adapter not set');
    }

    if (!this.context || this.context.state !== TransactionState.ACTIVE) {
      throw new Error('No active transaction');
    }

    try {
      const dbType = this.adapter.getDatabaseType();

      if (dbType === 'mssql') {
        await this.adapter.executeQuery('COMMIT TRANSACTION');
      } else {
        await this.adapter.executeQuery('COMMIT');
      }

      this.context.state = TransactionState.COMMITTED;

      // Clear timeout
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }
    } catch (error) {
      this.context.state = TransactionState.FAILED;
      throw error;
    }
  }

  /**
   * Rollback the current transaction
   */
  async rollback(): Promise<void> {
    if (!this.adapter) {
      throw new Error('Database adapter not set');
    }

    if (!this.context || this.context.state !== TransactionState.ACTIVE) {
      throw new Error('No active transaction');
    }

    try {
      const dbType = this.adapter.getDatabaseType();

      if (dbType === 'mssql') {
        await this.adapter.executeQuery('ROLLBACK TRANSACTION');
      } else {
        await this.adapter.executeQuery('ROLLBACK');
      }

      this.context.state = TransactionState.ROLLED_BACK;

      // Clear timeout
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }
    } catch (error) {
      this.context.state = TransactionState.FAILED;
      throw error;
    }
  }

  /**
   * Execute a query within the transaction
   */
  async execute<T = any>(sql: string, params?: any[]): Promise<T> {
    if (!this.adapter) {
      throw new Error('Database adapter not set');
    }

    if (!this.context || this.context.state !== TransactionState.ACTIVE) {
      throw new Error('No active transaction');
    }

    try {
      // Execute query
      const result = await this.adapter.executeQuery<T>(sql, params);

      // Track query in context
      this.context.queries.push(sql);

      // Track affected rows if applicable
      if (result && typeof result === 'object' && 'affectedRows' in result) {
        this.context.affectedRows += (result as any).affectedRows;
      }

      return result;
    } catch (error) {
      // Auto-rollback on error if enabled
      if (this.autoRollbackEnabled && this.isActive()) {
        await this.rollback();
      } else if (this.context) {
        this.context.state = TransactionState.FAILED;
      }
      throw error;
    }
  }

  /**
   * Get current transaction state
   */
  getState(): TransactionState {
    return this.context ? this.context.state : TransactionState.IDLE;
  }

  /**
   * Get current transaction context
   */
  getContext(): TransactionContext | null {
    return this.context;
  }

  /**
   * Check if a transaction is active
   */
  isActive(): boolean {
    return this.context?.state === TransactionState.ACTIVE;
  }

  /**
   * Map isolation level to Oracle format
   */
  private mapOracleIsolationLevel(level: string): string {
    switch (level) {
      case 'READ COMMITTED':
        return 'READ COMMITTED';
      case 'SERIALIZABLE':
        return 'SERIALIZABLE';
      default:
        return 'READ COMMITTED';
    }
  }
}
