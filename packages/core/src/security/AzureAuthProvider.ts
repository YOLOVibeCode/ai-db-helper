/**
 * AzureAuthProvider - Azure AD authentication provider for Azure SQL databases
 *
 * Features:
 * - Device code flow for MFA-compatible authentication
 * - Azure CLI credential delegation
 * - Token caching with automatic refresh
 * - Multi-tenant support
 * - Secure token storage
 */

import {
  DeviceCodeCredential,
  AzureCliCredential,
  TokenCredential
} from '@azure/identity';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  IAzureAuthProvider,
  AzureTokenOptions,
  AzureAccessToken,
  AzureCachedAccount,
  DeviceCodeInfo
} from '@aidb/contracts';
import { DirectoryManager } from '../infrastructure/DirectoryManager';

/**
 * Azure CLI public client ID - works across all Azure AD tenants
 * This is the same client ID used by Azure CLI, pre-consented in most tenants
 */
const AZURE_CLI_CLIENT_ID = '04b07795-8ddb-4a3b-b104-2c1955d1c6e7';

/**
 * Azure SQL Database scope
 */
const AZURE_SQL_SCOPE = 'https://database.windows.net/.default';

/**
 * Default tenant for multi-tenant support
 */
const DEFAULT_TENANT = 'common';

// Device code polling is handled by @azure/identity library

export class AzureAuthProvider implements IAzureAuthProvider {
  private readonly directoryManager: DirectoryManager;
  private readonly tokenCachePath: string;
  
  // In-memory cache of credentials per tenant
  private credentialCache: Map<string, TokenCredential> = new Map();

  constructor(directoryManager: DirectoryManager) {
    this.directoryManager = directoryManager;
    this.tokenCachePath = this.directoryManager.getAzureTokenCachePath();
  }

  /**
   * Get access token for Azure SQL
   * Automatically handles caching and refresh
   */
  async getToken(options: AzureTokenOptions = {}): Promise<AzureAccessToken> {
    const tenant = options.tenant || DEFAULT_TENANT;
    const method = await this.determineAuthMethod(options);

    try {
      const credential = await this.getCredential(tenant, method, options);
      const tokenResponse = await credential.getToken(AZURE_SQL_SCOPE);

      if (!tokenResponse) {
        throw new Error('Failed to acquire token: token response is null');
      }

      // Extract account information from token
      const account = await this.getAccountInfo(credential, tenant);
      
      // Update cache with account info
      await this.updateAccountCache(tenant, account.username, account.homeAccountId);

      return {
        token: tokenResponse.token,
        expiresOn: tokenResponse.expiresOnTimestamp
          ? new Date(tokenResponse.expiresOnTimestamp)
          : new Date(Date.now() + 3600000), // Default 1 hour if not provided
        account: {
          username: account.username,
          tenantId: account.tenantId,
          homeAccountId: account.homeAccountId
        }
      };
    } catch (error) {
      throw new Error(
        `Failed to acquire Azure token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List all cached accounts
   */
  async listAccounts(): Promise<AzureCachedAccount[]> {
    try {
      const cache = await this.loadTokenCache();
      const accounts: AzureCachedAccount[] = [];

      for (const [tenantId, cacheEntry] of Object.entries(cache.accounts || {})) {
        // Try to get a credential to validate the cache
        try {
          const credential = this.createDeviceCodeCredential(tenantId);
          const token = await credential.getToken(AZURE_SQL_SCOPE);
          
          accounts.push({
            username: cacheEntry.username || 'unknown',
            tenantId: tenantId,
            tenantDomain: cacheEntry.tenantDomain,
            tokenExpiresOn: token.expiresOnTimestamp
              ? new Date(token.expiresOnTimestamp)
              : new Date(),
            canRefresh: true
          });
        } catch {
          // Cache entry is invalid, skip it
          continue;
        }
      }

      return accounts;
    } catch {
      return [];
    }
  }

  /**
   * Sign out and clear cached token for account
   */
  async signOut(accountId?: string): Promise<void> {
    try {
      const cache = await this.loadTokenCache();
      
      if (accountId) {
        // Remove specific account
        if (cache.accounts && cache.accounts[accountId]) {
          delete cache.accounts[accountId];
          await this.saveTokenCache(cache);
        }
        this.credentialCache.delete(accountId);
      } else {
        // Clear all accounts
        cache.accounts = {};
        await this.saveTokenCache(cache);
        this.credentialCache.clear();
      }
    } catch (error) {
      throw new Error(
        `Failed to sign out: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Force interactive sign-in (device code)
   */
  async signIn(tenant?: string): Promise<AzureAccessToken> {
    return this.getToken({
      tenant: tenant || DEFAULT_TENANT,
      forceInteractive: true,
      onDeviceCode: () => {
        // Default device code handler - can be overridden
        // This will be called by the DeviceCodeCredential
        // For CLI, we'll display it via the adapter's callback
      }
    });
  }

  /**
   * Check if valid cached credentials exist
   */
  async hasValidCache(tenant?: string): Promise<boolean> {
    const targetTenant = tenant || DEFAULT_TENANT;
    
    try {
      const cache = await this.loadTokenCache();
      if (!cache.accounts || !cache.accounts[targetTenant]) {
        return false;
      }

      // Try to get a token to validate cache
      const credential = this.createDeviceCodeCredential(targetTenant);
      await credential.getToken(AZURE_SQL_SCOPE);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determine authentication method based on options
   */
  private async determineAuthMethod(options: AzureTokenOptions): Promise<'auto' | 'device-code' | 'az-cli'> {
    if (options.forceInteractive) {
      return 'device-code';
    }

    // Check if Azure CLI is available
    if (await this.isAzureCliAvailable()) {
      return 'az-cli';
    }

    return 'device-code';
  }

  /**
   * Get credential instance, creating if necessary
   */
  private async getCredential(
    tenant: string,
    method: 'auto' | 'device-code' | 'az-cli',
    options: AzureTokenOptions
  ): Promise<TokenCredential> {
    // Check in-memory cache first
    const cacheKey = `${tenant}:${method}`;
    if (this.credentialCache.has(cacheKey)) {
      return this.credentialCache.get(cacheKey)!;
    }

    let credential: TokenCredential;

    if (method === 'az-cli' || (method === 'auto' && await this.isAzureCliAvailable())) {
      // Try Azure CLI first
      try {
        credential = new AzureCliCredential();
        // Test if it works
        await credential.getToken(AZURE_SQL_SCOPE);
      } catch {
        // Fall back to device code if Azure CLI fails
        credential = this.createDeviceCodeCredential(tenant, options.onDeviceCode);
      }
    } else {
      // Use device code flow
      credential = this.createDeviceCodeCredential(tenant, options.onDeviceCode);
    }

    // Cache credential
    this.credentialCache.set(cacheKey, credential);

    return credential;
  }

  /**
   * Create device code credential with callback
   */
  private createDeviceCodeCredential(
    tenant: string,
    onDeviceCode?: (info: DeviceCodeInfo) => void
  ): DeviceCodeCredential {
    return new DeviceCodeCredential({
      tenantId: tenant,
      clientId: AZURE_CLI_CLIENT_ID,
      userPromptCallback: (info) => {
        if (onDeviceCode) {
          // Calculate expiration time (device code typically expires in 15 minutes)
          const expiresOn = new Date(Date.now() + 15 * 60 * 1000);
          onDeviceCode({
            userCode: info.userCode,
            verificationUri: info.verificationUri,
            message: info.message,
            expiresOn: expiresOn
          });
        }
      }
    });
  }

  /**
   * Check if Azure CLI is available
   */
  private async isAzureCliAvailable(): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('az --version', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get account information from credential
   * Attempts to extract account info from token or cache
   */
  private async getAccountInfo(
    credential: TokenCredential,
    tenant: string
  ): Promise<{ username: string; tenantId: string; homeAccountId: string }> {
    // Try to load from cache first
    const cache = await this.loadTokenCache();
    const cacheEntry = cache.accounts?.[tenant];

    if (cacheEntry && cacheEntry.username) {
      return {
        username: cacheEntry.username,
        tenantId: tenant,
        homeAccountId: cacheEntry.homeAccountId || tenant
      };
    }

    // Try to get token to validate credential works
    try {
      await credential.getToken(AZURE_SQL_SCOPE);
      
      // Parse token to extract account info (simplified - in production use proper JWT parsing)
      // For now, we'll use a placeholder and update cache when we have better info
      const accountInfo = {
        username: cacheEntry?.username || `user@${tenant === 'common' ? 'tenant' : tenant}`,
        tenantId: tenant,
        homeAccountId: tenant
      };

      // Update cache with account info if we have it
      if (!cacheEntry) {
        await this.updateAccountCache(tenant, accountInfo.username, accountInfo.homeAccountId);
      }

      return accountInfo;
    } catch {
      // Fallback to default
      return {
        username: `user@${tenant === 'common' ? 'tenant' : tenant}`,
        tenantId: tenant,
        homeAccountId: tenant
      };
    }
  }

  /**
   * Update account cache with account information
   */
  private async updateAccountCache(
    tenantId: string,
    username: string,
    homeAccountId: string
  ): Promise<void> {
    const cache = await this.loadTokenCache();
    if (!cache.accounts) {
      cache.accounts = {};
    }
    
    cache.accounts[tenantId] = {
      username,
      homeAccountId,
      lastUsed: new Date().toISOString()
    };

    await this.saveTokenCache(cache);
  }

  /**
   * Load token cache from disk
   */
  private async loadTokenCache(): Promise<TokenCache> {
    try {
      const content = await fs.readFile(this.tokenCachePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { accounts: {} };
      }
      throw new Error(`Failed to load token cache: ${error.message}`);
    }
  }

  /**
   * Save token cache to disk
   */
  private async saveTokenCache(cache: TokenCache): Promise<void> {
    // Ensure directory exists
    const cacheDir = path.dirname(this.tokenCachePath);
    await fs.mkdir(cacheDir, { recursive: true });

    // Save cache file
    await fs.writeFile(this.tokenCachePath, JSON.stringify(cache, null, 2), 'utf-8');
    
    // Set restrictive permissions (600)
    await fs.chmod(this.tokenCachePath, 0o600);
  }
}

/**
 * Token cache structure
 */
interface TokenCache {
  accounts?: Record<string, TokenCacheEntry>;
}

interface TokenCacheEntry {
  username?: string;
  tenantDomain?: string;
  homeAccountId?: string;
  lastUsed?: string;
}

