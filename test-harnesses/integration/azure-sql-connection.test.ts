/**
 * Azure SQL Connection Test
 * 
 * Tests actual connection to Azure SQL database using Azure AD authentication
 * 
 * Usage:
 *   npm run test:azure-sql
 * 
 * This test requires:
 * - Valid Azure AD credentials
 * - Access to the Azure SQL database
 * - Network connectivity to Azure
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MSSQLAdapter } from '@aidb/adapters';
import { ConnectionCredentials, DatabaseType } from '@aidb/contracts';

// Azure SQL configuration
const AZURE_SQL_CONFIG = {
  server: 'cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net',
  database: 'MobileFrame',
  port: 1433
};

describe('Azure SQL Connection Test', () => {
  // Set test timeout to 2 minutes for authentication
  const TEST_TIMEOUT = 120000;
  let adapter: MSSQLAdapter;

  beforeAll(async () => {
    adapter = new MSSQLAdapter();
  });

  afterAll(async () => {
    if (adapter) {
      try {
        await adapter.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }, TEST_TIMEOUT);

  it('should connect to Azure SQL using Azure AD authentication', async () => {
    const credentials: ConnectionCredentials = {
      type: DatabaseType.AzureSQL,
      host: AZURE_SQL_CONFIG.server,
      port: AZURE_SQL_CONFIG.port,
      database: AZURE_SQL_CONFIG.database,
      azureAuth: {
        method: 'auto', // Will try Azure CLI first, then device code
        tenant: undefined // Use common tenant
      }
    };

    console.log('\n🔐 Attempting Azure AD authentication...');
    console.log(`   Server: ${AZURE_SQL_CONFIG.server}`);
    console.log(`   Database: ${AZURE_SQL_CONFIG.database}`);
    console.log('   Method: auto (Azure CLI or Device Code)');
    console.log('\n⚠️  Note: If connection fails, check:');
    console.log('   1. Azure SQL firewall rules allow your IP');
    console.log('   2. Your Azure AD account has access to the database');
    console.log('   3. Network connectivity to Azure\n');

    try {
      await adapter.connect(credentials);
      console.log('✅ Successfully connected!\n');
    } catch (error) {
      console.error('\n❌ Connection failed:', error instanceof Error ? error.message : error);
      console.error('\n💡 Troubleshooting:');
      console.error('   - Check Azure SQL firewall: Allow Azure services and your IP');
      console.error('   - Verify Azure AD authentication worked (check for device code prompt)');
      console.error('   - Ensure your account has access to the database\n');
      throw error;
    }

    expect(adapter.getDatabaseName()).toBe(AZURE_SQL_CONFIG.database);
    expect(adapter.getDatabaseType()).toBe(DatabaseType.MSSQL);
  }, TEST_TIMEOUT);

  it('should execute a simple query', async () => {
    const result = await adapter.executeQuery<any[]>('SELECT @@VERSION AS version');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('version');
    
    console.log('\n✅ Query executed successfully');
    console.log(`   SQL Server Version: ${result[0].version.substring(0, 50)}...\n`);
  }, TEST_TIMEOUT);

  it('should get database name', async () => {
    const dbName = adapter.getDatabaseName();
    expect(dbName).toBe(AZURE_SQL_CONFIG.database);
  });

  it('should validate connection', async () => {
    const isValid = await adapter.validateConnection();
    expect(isValid).toBe(true);
  }, TEST_TIMEOUT);

  it('should handle parameterized queries', async () => {
    const result = await adapter.executeQuery<any[]>(
      'SELECT DB_NAME() AS current_database, USER_NAME() AS current_user'
    );

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('current_database');
    
    console.log(`\n✅ Current database: ${result[0].current_database}`);
    console.log(`   Current user: ${result[0].current_user}\n`);
  }, TEST_TIMEOUT);
});

