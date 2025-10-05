/**
 * MySQLAdapter - MySQL database connection adapter
 *
 * Features:
 * - Connection pooling with mysql2
 * - Parameterized query support
 * - Connection validation
 * - Proper error handling
 */

import mysql from 'mysql2/promise';
import { IDatabaseAdapter, ConnectionCredentials, DatabaseType } from '@aidb/contracts';

export class MySQLAdapter implements IDatabaseAdapter {
  private pool?: mysql.Pool;
  private credentials?: ConnectionCredentials;

  /**
   * Establish connection to MySQL database
   */
  async connect(credentials: ConnectionCredentials): Promise<void> {
    this.credentials = credentials;

    const poolConfig: mysql.PoolOptions = {
      host: credentials.host || 'localhost',
      port: credentials.port || 3306,
      user: credentials.username,
      password: credentials.password,
      database: credentials.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };

    // Add SSL options if provided
    if (credentials.ssl) {
      poolConfig.ssl = credentials.sslOptions || {};
    }

    this.pool = mysql.createPool(poolConfig);

    // Test connection
    await this.ping();
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
  }

  /**
   * Validate that connection is active
   */
  async validateConnection(): Promise<boolean> {
    try {
      return await this.ping();
    } catch {
      return false;
    }
  }

  /**
   * Execute a raw SQL query
   */
  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T> {
    if (!this.pool) {
      throw new Error('Not connected to database. Call connect() first.');
    }

    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows as T;
    } catch (error) {
      throw new Error(
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}\nSQL: ${sql}`
      );
    }
  }

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType {
    return DatabaseType.MySQL;
  }

  /**
   * Get current database name
   */
  getDatabaseName(): string {
    if (!this.credentials) {
      throw new Error('Not connected to database');
    }
    return this.credentials.database;
  }

  /**
   * Test connection with timeout
   */
  async ping(timeoutMs = 5000): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const connection = await this.pool.getConnection();

      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), timeoutMs);
      });

      // Race between ping and timeout
      await Promise.race([
        connection.ping(),
        timeoutPromise
      ]);

      connection.release();
      return true;
    } catch (error) {
      throw new Error(`Connection ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    // Access pool state (mysql2 specific)
    const poolState = (this.pool as any);

    return {
      total: poolState._allConnections?.length || 0,
      active: poolState._allConnections?.length - poolState._freeConnections?.length || 0,
      idle: poolState._freeConnections?.length || 0,
      waiting: poolState._connectionQueue?.length || 0
    };
  }

  /**
   * Execute query with single connection (for transactions)
   */
  async withConnection<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const connection = await this.pool.getConnection();
    try {
      return await callback(connection);
    } finally {
      connection.release();
    }
  }

  /**
   * Execute queries within a transaction
   */
  async withTransaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
    return this.withConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        const result = await callback(connection);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
  }
}
