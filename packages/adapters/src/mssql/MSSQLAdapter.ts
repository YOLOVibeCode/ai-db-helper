import * as mssql from 'mssql';
import { IDatabaseAdapter, ConnectionCredentials, DatabaseType } from '@aidb/contracts';
import { AzureAuthProvider } from '@aidb/core';
import { DirectoryManager } from '@aidb/core';

/**
 * Microsoft SQL Server Database Adapter
 * Implements connection pooling and query execution for MSSQL
 * Supports both SQL authentication and Azure AD token authentication
 */
export class MSSQLAdapter implements IDatabaseAdapter {
  private pool: mssql.ConnectionPool | null = null;
  private config: mssql.config | null = null;
  private databaseName: string = '';
  private azureAuthProvider?: AzureAuthProvider;
  private currentToken?: string;
  private tokenExpiresAt?: Date;

  /**
   * Connect to MSSQL database
   */
  async connect(credentials: ConnectionCredentials): Promise<void> {
    this.databaseName = credentials.database;

    // Check if Azure AD authentication is requested
    if (credentials.azureAuth && credentials.azureAuth.method !== 'sql-auth') {
      await this.connectWithAzureAuth(credentials);
    } else {
      await this.connectWithSqlAuth(credentials);
    }
  }

  /**
   * Connect using Azure AD token authentication
   */
  private async connectWithAzureAuth(credentials: ConnectionCredentials): Promise<void> {
    // Initialize Azure auth provider if not already done
    if (!this.azureAuthProvider) {
      const dirManager = new DirectoryManager();
      await dirManager.initialize();
      this.azureAuthProvider = new AzureAuthProvider(dirManager);
    }

    // Get Azure AD token
    const tokenResponse = await this.azureAuthProvider.getToken({
      tenant: credentials.azureAuth?.tenant,
      accountHint: credentials.azureAuth?.servicePrincipal?.clientId
        ? undefined
        : undefined, // Will use device code or az-cli
      onDeviceCode: (info) => {
        // Device code callback - can be customized by caller
        console.log('\n🔐 Azure Authentication Required');
        console.log(`\n   Visit: ${info.verificationUri}`);
        console.log(`   Enter code: ${info.userCode}\n`);
        console.log('⏳ Waiting for authentication...');
      }
    });

    this.currentToken = tokenResponse.token;
    this.tokenExpiresAt = tokenResponse.expiresOn;

    // Build connection config with Azure AD authentication
    this.config = {
      server: credentials.host || 'localhost',
      port: credentials.port || 1433,
      database: credentials.database,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: {
          token: tokenResponse.token
        }
      } as any, // Type assertion needed due to mssql types
      options: {
        encrypt: true, // Always encrypt for Azure SQL
        trustServerCertificate: credentials.sslOptions?.rejectUnauthorized === false,
        enableArithAbort: true,
        requestTimeout: 60000, // 60 seconds for Azure SQL
        connectTimeout: 60000, // 60 seconds connection timeout
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
   * Connect using SQL username/password authentication
   */
  private async connectWithSqlAuth(credentials: ConnectionCredentials): Promise<void> {
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
        connectTimeout: 30000,
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
    // Clear token cache
    this.currentToken = undefined;
    this.tokenExpiresAt = undefined;
  }

  /**
   * Execute a query with optional parameters
   */
  async executeQuery<T>(query: string, params?: any[]): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    // Check if token needs refresh (for Azure AD auth)
    if (this.currentToken && this.tokenExpiresAt) {
      const now = new Date();
      const timeUntilExpiry = this.tokenExpiresAt.getTime() - now.getTime();
      
      // Refresh token if it expires in less than 5 minutes
      if (timeUntilExpiry < 5 * 60 * 1000 && this.azureAuthProvider) {
        try {
          const tokenResponse = await this.azureAuthProvider.getToken();
          this.currentToken = tokenResponse.token;
          this.tokenExpiresAt = tokenResponse.expiresOn;
          
          // Reconnect with new token
          if (this.config) {
            (this.config.authentication as any).options.token = tokenResponse.token;
            await this.pool.close();
            this.pool = await mssql.connect(this.config);
          }
        } catch (error) {
          // If refresh fails, try to continue with existing token
          console.warn('Token refresh failed, continuing with existing token:', error);
        }
      }
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
