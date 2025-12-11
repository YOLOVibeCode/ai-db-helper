/**
 * Azure authentication provider interface
 * Handles token acquisition, caching, and refresh for Azure SQL databases
 */

/**
 * Azure authentication provider interface
 * Handles token acquisition, caching, and refresh
 */
export interface IAzureAuthProvider {
  /**
   * Get access token for Azure SQL
   * Automatically handles caching and refresh
   */
  getToken(options?: AzureTokenOptions): Promise<AzureAccessToken>;
  
  /**
   * List all cached accounts
   */
  listAccounts(): Promise<AzureCachedAccount[]>;
  
  /**
   * Sign out and clear cached token for account
   */
  signOut(accountId?: string): Promise<void>;
  
  /**
   * Force interactive sign-in (device code)
   */
  signIn(tenant?: string): Promise<AzureAccessToken>;
  
  /**
   * Check if valid cached credentials exist
   */
  hasValidCache(tenant?: string): Promise<boolean>;
}

/**
 * Options for token acquisition
 */
export interface AzureTokenOptions {
  /**
   * Tenant ID or domain
   * @default 'common'
   */
  tenant?: string;
  
  /**
   * Account hint (email) if multiple accounts cached
   */
  accountHint?: string;
  
  /**
   * Force interactive authentication even if cache exists
   */
  forceInteractive?: boolean;
  
  /**
   * Callback for device code display
   */
  onDeviceCode?: (info: DeviceCodeInfo) => void;
}

/**
 * Azure access token with account information
 */
export interface AzureAccessToken {
  token: string;
  expiresOn: Date;
  account: {
    username: string;    // e.g., 'alice@contoso.com'
    tenantId: string;
    homeAccountId: string;
  };
}

/**
 * Cached Azure account information
 */
export interface AzureCachedAccount {
  username: string;
  tenantId: string;
  tenantDomain?: string;
  tokenExpiresOn: Date;
  canRefresh: boolean;
}

/**
 * Device code information for interactive authentication
 */
export interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  message: string;
  expiresOn: Date;
}


