// @ts-ignore - oracledb may not have types installed
import oracledb from 'oracledb';
import {
  IDatabaseAdapter,
  ConnectionCredentials,
  DatabaseType
} from '@aidb/contracts';

/**
 * Oracle Database Adapter
 * Implements connection pooling and query execution for Oracle databases
 */
export class OracleAdapter implements IDatabaseAdapter {
  private pool: any | null = null;
  private databaseName: string = '';

  /**
   * Connect to Oracle database
   */
  async connect(credentials: ConnectionCredentials): Promise<void> {
    this.databaseName = credentials.database;

    // Create connection pool
    this.pool = await oracledb.createPool({
      user: credentials.username,
      password: credentials.password,
      connectString: `${credentials.host}:${credentials.port}/${credentials.database}`,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1,
      poolTimeout: 60,
    });

    // Set fetch as string for easier handling
    oracledb.fetchAsString = [oracledb.CLOB, oracledb.DATE];
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close(10);
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

    let connection: any = null;

    try {
      connection = await this.pool.getConnection();

      const result = await connection.execute(query, params || [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });

      return result.rows as T;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Query execution failed: ${err.message}\nSQL: ${query}`);
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error('Error closing connection:', err);
        }
      }
    }
  }

  /**
   * Validate that connection is active
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.executeQuery<any[]>('SELECT 1 FROM DUAL');
      return true;
    } catch (error) {
      return false;
    }
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
        this.executeQuery<any[]>('SELECT 1 FROM DUAL'),
        timeoutPromise
      ]);

      return true;
    } catch (error) {
      throw new Error(`Connection ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    return DatabaseType.Oracle;
  }
}
