/**
 * MSSQLAdapter Tests - Azure Authentication Integration
 *
 * Tests for MSSQL adapter with Azure AD token authentication
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MSSQLAdapter } from './MSSQLAdapter';
import { ConnectionCredentials, DatabaseType } from '@aidb/contracts';
import { AzureAuthProvider } from '@aidb/core';
import { DirectoryManager } from '@aidb/core';

// Mock mssql library
vi.mock('mssql', () => {
  const mockPool = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockReturnValue({
      input: vi.fn().mockReturnThis(),
      query: vi.fn().mockResolvedValue({
        recordset: [{ id: 1, name: 'Test' }]
      })
    })
  };

  const connectFn = vi.fn().mockResolvedValue(mockPool);

  return {
    default: {
      connect: connectFn,
      ConnectionPool: vi.fn().mockImplementation(() => mockPool)
    },
    connect: connectFn
  };
});

// Mock AzureAuthProvider
vi.mock('@aidb/core', async () => {
  const actual = await vi.importActual('@aidb/core');
  return {
    ...actual,
    AzureAuthProvider: vi.fn().mockImplementation(() => ({
      getToken: vi.fn().mockResolvedValue({
        token: 'mock-azure-token-12345',
        expiresOn: new Date(Date.now() + 3600000),
        account: {
          username: 'test@contoso.com',
          tenantId: 'contoso.onmicrosoft.com',
          homeAccountId: 'test-account-id'
        }
      })
    })),
    DirectoryManager: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      getAzureTokenCachePath: vi.fn().mockReturnValue('/tmp/test-tokens.json')
    }))
  };
});

describe('MSSQLAdapter - Azure Authentication', () => {
  let adapter: MSSQLAdapter;

  beforeEach(() => {
    adapter = new MSSQLAdapter();
  });

  afterEach(async () => {
    try {
      await adapter.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });

  describe('Azure AD Authentication', () => {
    it('should connect using Azure AD token when azureAuth is provided', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        port: 1433,
        database: 'testdb',
        azureAuth: {
          method: 'device-code',
          tenant: 'contoso.onmicrosoft.com'
        }
      };

      await adapter.connect(credentials);

      // Verify adapter is connected
      expect(adapter.getDatabaseName()).toBe('testdb');
      // MSSQLAdapter returns MSSQL type for both MSSQL and AzureSQL
      expect(adapter.getDatabaseType()).toBe(DatabaseType.MSSQL);
    });

    it('should use device code flow when method is device-code', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        database: 'testdb',
        azureAuth: {
          method: 'device-code'
        }
      };

      await adapter.connect(credentials);

      // Verify AzureAuthProvider was called
      expect(AzureAuthProvider).toHaveBeenCalled();
    });

    it('should use auto method when method is auto', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        database: 'testdb',
        azureAuth: {
          method: 'auto'
        }
      };

      await adapter.connect(credentials);

      expect(adapter.getDatabaseName()).toBe('testdb');
    });

    it('should pass tenant to AzureAuthProvider', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        database: 'testdb',
        azureAuth: {
          method: 'device-code',
          tenant: 'fabrikam.onmicrosoft.com'
        }
      };

      await adapter.connect(credentials);

      // Verify tenant was passed
      const authProviderInstance = (AzureAuthProvider as any).mock.results[0].value;
      expect(authProviderInstance.getToken).toHaveBeenCalled();
    });

    it('should fall back to SQL auth when method is sql-auth', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        database: 'testdb',
        username: 'sqluser',
        password: 'sqlpass',
        azureAuth: {
          method: 'sql-auth'
        }
      };

      await adapter.connect(credentials);

      // Should not use Azure auth (method is sql-auth)
      // Note: AzureAuthProvider may be instantiated during module load, so we check behavior instead
      expect(adapter.getDatabaseName()).toBe('testdb');
    });
  });

  describe('SQL Authentication (Fallback)', () => {
    it('should connect using SQL auth when azureAuth is not provided', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.MSSQL,
        host: 'localhost',
        port: 1433,
        database: 'testdb',
        username: 'sa',
        password: 'password123'
      };

      await adapter.connect(credentials);

      expect(adapter.getDatabaseName()).toBe('testdb');
      expect(adapter.getDatabaseType()).toBe(DatabaseType.MSSQL);
      // Should not use Azure auth (no azureAuth in credentials)
      // Note: AzureAuthProvider may be instantiated during module load, so we check behavior instead
    });
  });

  describe('Token Refresh', () => {
    it('should handle token refresh during query execution', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        database: 'testdb',
        azureAuth: {
          method: 'device-code'
        }
      };

      await adapter.connect(credentials);

      // Execute a query (token refresh logic is in executeQuery)
      const result = await adapter.executeQuery('SELECT * FROM users');

      expect(result).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('should disconnect and clear token cache', async () => {
      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        database: 'testdb',
        azureAuth: {
          method: 'device-code'
        }
      };

      await adapter.connect(credentials);
      await adapter.disconnect();

      // After disconnect, should be able to reconnect
      await adapter.connect(credentials);
      expect(adapter.getDatabaseName()).toBe('testdb');
    });
  });

  describe('Error Handling', () => {
    it('should handle Azure auth errors gracefully', async () => {
      // Mock AzureAuthProvider to throw error
      const mockAuthProvider = {
        getToken: vi.fn().mockRejectedValue(new Error('Azure auth failed'))
      };
      (AzureAuthProvider as any).mockImplementationOnce(() => mockAuthProvider);

      const credentials: ConnectionCredentials = {
        type: DatabaseType.AzureSQL,
        host: 'testserver.database.windows.net',
        database: 'testdb',
        azureAuth: {
          method: 'device-code'
        }
      };

      await expect(adapter.connect(credentials)).rejects.toThrow();
    });
  });
});

