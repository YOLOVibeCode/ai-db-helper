import * as mssql from 'mssql';
import { IDatabaseAdapter, ConnectionCredentials, DatabaseType } from '@aidb/contracts';

/**
 * Microsoft SQL Server Database Adapter
 * Implements connection pooling and query execution for MSSQL
 */
export class MSSQLAdapter implements IDatabaseAdapter {
  private pool: mssql.ConnectionPool | null = null;
  private config: mssql.config | null = null;
  private databaseName: string = '';

  /**
   * Connect to MSSQL database
   */
  async connect(credentials: ConnectionCredentials): Promise<void> {
    this.databaseName = credentials.database;

    this.config = {
      user: credentials.username,
      password: credentials.password,
      server: credentials.host || 'localhost',
      port: credentials.port || 1433,
      database: credentials.database,
      options: {
        encrypt: credentials.ssl || false,
        trustServerCertificate: true, // For development/testing
        enableArithAbort: true,
        requestTimeout: 30000,
      },
      pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
      },
    };

    this.pool = await mssql.connect(this.config);
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  /**
   * Execute a query with optional parameters
   */
  async executeQuery<T>(query: string, params?: any[]): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const request = this.pool.request();

      // Add parameters if provided
      if (params && params.length > 0) {
        params.forEach((param, index) => {
          request.input(`param${index}`, param);
        });

        // Replace ? placeholders with @param0, @param1, etc.
        let processedQuery = query;
        let paramIndex = 0;
        processedQuery = processedQuery.replace(/\?/g, () => `@param${paramIndex++}`);

        const result = await request.query(processedQuery);
        return result.recordset as T;
      } else {
        const result = await request.query(query);
        return result.recordset as T;
      }
    } catch (error) {
      const err = error as Error;
      throw new Error(`Query execution failed: ${err.message}\nSQL: ${query}`);
    }
  }

  /**
   * Test database connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.executeQuery<any[]>('SELECT 1 AS ping');
      return true;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Connection ping failed: ${err.message}`);
    }
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    return this.ping();
  }

  /**
   * Get database name
   */
  getDatabaseName(): string {
    return this.databaseName;
  }

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType {
    return DatabaseType.MSSQL;
  }
}
