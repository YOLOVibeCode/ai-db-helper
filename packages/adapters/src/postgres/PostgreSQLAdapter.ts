/**
 * PostgreSQLAdapter - PostgreSQL database connection adapter
 *
 * Features:
 * - Connection pooling with node-postgres (pg)
 * - Parameterized query support
 * - Schema support
 * - Transaction support
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { IDatabaseAdapter, ConnectionCredentials, DatabaseType } from '@aidb/contracts';

export class PostgreSQLAdapter implements IDatabaseAdapter {
  private pool?: Pool;
  private credentials?: ConnectionCredentials;

  /**
   * Establish connection to PostgreSQL database
   */
  async connect(credentials: ConnectionCredentials): Promise<void> {
    this.credentials = credentials;

    const poolConfig: PoolConfig = {
      host: credentials.host || 'localhost',
      port: credentials.port || 5432,
      user: credentials.username,
      password: credentials.password,
      database: credentials.database,
      max: 10, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };

    // Add SSL options if provided
    if (credentials.ssl) {
      poolConfig.ssl = credentials.sslOptions || { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);

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
      const result = await this.pool.query(sql, params);
      return result.rows as T;
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
    return DatabaseType.PostgreSQL;
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
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), timeoutMs);
      });

      await Promise.race([
        this.pool.query('SELECT 1'),
        timeoutPromise
      ]);

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

    return {
      total: this.pool.totalCount,
      active: this.pool.totalCount - this.pool.idleCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }

  /**
   * Execute query with single connection (for transactions)
   */
  async withConnection<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const client = await this.pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }

  /**
   * Execute queries within a transaction
   */
  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.withConnection(async (client) => {
      await client.query('BEGIN');
      try {
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }
}
