/**
 * MongoDBAdapter - MongoDB database connection adapter
 *
 * Features:
 * - Connection to MongoDB using official mongodb driver
 * - JSON-based query execution for MongoDB operations
 * - Support for find, insertOne, updateOne, deleteOne operations
 * - Connection validation
 */

import { MongoClient, Db } from 'mongodb';
import { IDatabaseAdapter, ConnectionCredentials, DatabaseType } from '@aidb/contracts';

export class MongoDBAdapter implements IDatabaseAdapter {
  private client?: MongoClient;
  private db?: Db;
  private credentials?: ConnectionCredentials;

  /**
   * Establish connection to MongoDB database
   */
  async connect(credentials: ConnectionCredentials): Promise<void> {
    this.credentials = credentials;

    // Build connection string
    const host = credentials.host || 'localhost';
    const port = credentials.port || 27017;
    const database = credentials.database;

    let connectionString: string;

    // If username is provided, use authentication
    if (credentials.username) {
      const username = encodeURIComponent(credentials.username);
      const password = encodeURIComponent(credentials.password || '');
      const authSource = credentials.mongoOptions?.authSource || 'admin';
      connectionString = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=${authSource}`;
    } else {
      // No authentication
      connectionString = `mongodb://${host}:${port}/${database}`;
    }

    this.client = new MongoClient(connectionString);
    await this.client.connect();
    this.db = this.client.db(database);

    // Test connection
    await this.ping();
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = undefined;
      this.db = undefined;
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
   * Execute a MongoDB operation
   * @param query - JSON string with format: {collection, operation, filter?, document?, update?}
   * @param _params - Not used for MongoDB (kept for interface compatibility)
   */
  async executeQuery<T = any>(query: string, _params?: any[]): Promise<T> {
    if (!this.db) {
      throw new Error('Not connected');
    }

    try {
      const queryObj = JSON.parse(query);
      const { collection, operation, filter, document, update } = queryObj;

      const coll = this.db.collection(collection);

      switch (operation) {
        case 'find':
          return (await coll.find(filter || {}).toArray()) as T;

        case 'insertOne':
          return (await coll.insertOne(document)) as T;

        case 'updateOne':
          return (await coll.updateOne(filter, update)) as T;

        case 'deleteOne':
          return (await coll.deleteOne(filter)) as T;

        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      throw new Error(
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType {
    return DatabaseType.MongoDB;
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
    if (!this.db) {
      return false;
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), timeoutMs);
      });

      await Promise.race([
        this.db.admin().ping(),
        timeoutPromise
      ]);

      return true;
    } catch (error) {
      throw new Error(`Connection ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the underlying database instance for advanced operations
   */
  getDb(): Db | undefined {
    return this.db;
  }
}
