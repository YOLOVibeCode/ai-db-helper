# Azure SQL Authentication Implementation

## Overview

This document describes the implementation of Azure AD authentication for Azure SQL databases, enabling MFA-compatible authentication through device code flow (similar to Claude Code's authentication pattern).

## What Was Implemented

### 1. Contracts (`@aidb/contracts`)

#### New Interface: `IAzureAuthProvider`
- `getToken()` - Acquire Azure AD access token
- `listAccounts()` - List cached Azure accounts
- `signOut()` - Clear cached tokens
- `signIn()` - Force interactive authentication
- `hasValidCache()` - Check if cached credentials exist

#### Updated: `AzureAuthOptions`
- Simplified interface with `method`, `tenant`, and `servicePrincipal` options
- Supports: `auto`, `device-code`, `az-cli`, `service-principal`, `managed-identity`, `sql-auth`

### 2. Core Implementation (`@aidb/core`)

#### `AzureAuthProvider` Class
- **Device Code Flow**: Interactive MFA-compatible authentication
- **Azure CLI Delegation**: Uses existing `az login` credentials when available
- **Token Caching**: Secure file-based token cache with automatic refresh
- **Multi-Tenant Support**: Works with any Azure AD tenant (defaults to `common`)

**Key Features:**
- Uses Azure CLI's public client ID (`04b07795-8ddb-4a3b-b104-2c1955d1c6e7`) - no app registration needed
- Automatic token refresh (tokens cached for ~90 days)
- Secure token storage in `~/.aidb/azure/tokens.json`

### 3. Adapter Integration (`@aidb/adapters`)

#### Updated `MSSQLAdapter`
- Detects Azure AD authentication in `ConnectionCredentials`
- Automatically acquires token via `AzureAuthProvider`
- Injects token into `mssql` connection config
- Automatic token refresh during long-running operations

**Connection Flow:**
1. Check if `azureAuth` is present in credentials
2. If yes, use Azure AD token authentication
3. If no, fall back to SQL username/password authentication

### 4. CLI Integration (`@aidb/cli`)

#### Updated `connect` Command
- Detects Azure SQL database type
- Prompts for authentication method:
  - Azure AD (Device Code with MFA)
  - Azure AD (Device Code)
  - Azure CLI (if logged in)
  - SQL Authentication (username/password)
- Prompts for Azure AD tenant (optional, defaults to `common`)

#### New `auth` Command Group
- `aidb auth list` - List cached Azure accounts
- `aidb auth login [--tenant <tenant>]` - Sign in to Azure AD
- `aidb auth logout [--account <account-id>]` - Sign out from Azure AD

## Usage Examples

### Connecting to Azure SQL with Azure AD

```bash
# Interactive mode (will prompt for auth method)
aidb connect my-azure-db --type azure-sql --host myserver.database.windows.net --database mydb

# With Azure AD device code (default)
aidb connect my-azure-db \
  --type azure-sql \
  --host myserver.database.windows.net \
  --database mydb \
  --auth device-code

# With Azure CLI (if already logged in)
aidb connect my-azure-db \
  --type azure-sql \
  --host myserver.database.windows.net \
  --database mydb \
  --auth az-cli

# With specific tenant
aidb connect my-azure-db \
  --type azure-sql \
  --host myserver.database.windows.net \
  --database mydb \
  --tenant contoso.onmicrosoft.com

# With SQL authentication (traditional)
aidb connect my-azure-db \
  --type azure-sql \
  --host myserver.database.windows.net \
  --database mydb \
  --auth sql-auth \
  --user sqluser \
  --password sqlpass
```

### Managing Azure Authentication

```bash
# List cached accounts
aidb auth list

# Sign in to Azure AD
aidb auth login
aidb auth login --tenant contoso.onmicrosoft.com

# Sign out
aidb auth logout
aidb auth logout --account <tenant-id>
```

## User Experience Flow

### First Connection (Device Code Flow)

```
$ aidb connect mydb --type azure-sql --host myserver.database.windows.net

🔐 Azure Authentication Required

   Visit: https://microsoft.com/devicelogin
   Enter code: ABCD-EFGH

⏳ Waiting for authentication...
✅ Signed in as alice@contoso.com
💾 Credentials cached for future use

📡 Connecting to Azure SQL...
✅ Connected! Extracting schema...
```

### Subsequent Connections (Cached Token)

```
$ aidb connect mydb --type azure-sql --host myserver.database.windows.net

🔐 Using cached Azure credentials (alice@contoso.com)
📡 Connecting to Azure SQL...
✅ Connected! Extracting schema...
```

## Architecture Details

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User runs: aidb connect mydb --type azure-sql               │
│                                                                  │
│  2. MSSQLAdapter detects azureAuth in credentials               │
│                                                                  │
│  3. AzureAuthProvider.getToken() called                          │
│     ├─ Check cache for valid token                              │
│     ├─ If expired/missing:                                      │
│     │   ├─ Try Azure CLI credential (if available)              │
│     │   └─ Fall back to Device Code flow                        │
│     │       ├─ Display device code                              │
│     │       ├─ User visits microsoft.com/devicelogin            │
│     │       ├─ User enters code and completes MFA               │
│     │       └─ Token acquired                                   │
│     └─ Cache token for future use                               │
│                                                                  │
│  4. Token injected into mssql connection config                 │
│                                                                  │
│  5. Connection established to Azure SQL                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Token Cache Structure

```
~/.aidb/azure/tokens.json
{
  "accounts": {
    "contoso.onmicrosoft.com": {
      "username": "alice@contoso.com",
      "homeAccountId": "...",
      "lastUsed": "2025-01-15T10:30:00Z"
    }
  }
}
```

**Note:** Actual token storage is handled by `@azure/identity` library's MSAL cache, which is stored securely by the library.

## Security Considerations

1. **No App Registration Required**: Uses Azure CLI's public client ID, pre-consented in most tenants
2. **Token Encryption**: Tokens are stored securely by `@azure/identity` library
3. **File Permissions**: Token cache file has restrictive permissions (600)
4. **Token Scoping**: Only requests `https://database.windows.net/.default` scope
5. **Automatic Refresh**: Tokens automatically refresh before expiration

## Technical Details

### Dependencies Added

- `@azure/identity@^4.0.0` - Microsoft's official Azure authentication library

### Files Created/Modified

**Contracts:**
- `packages/contracts/src/security/IAzureAuthProvider.ts` (new)
- `packages/contracts/src/types/schema-types.ts` (updated)

**Core:**
- `packages/core/src/security/AzureAuthProvider.ts` (new)
- `packages/core/src/infrastructure/DirectoryManager.ts` (updated)

**Adapters:**
- `packages/adapters/src/mssql/MSSQLAdapter.ts` (updated)

**CLI:**
- `packages/cli/src/commands/auth.ts` (new)
- `packages/cli/src/commands/connect.ts` (updated)
- `packages/cli/src/index.ts` (updated)

## Testing

### Manual Testing

1. **Device Code Flow:**
   ```bash
   aidb connect test-azure --type azure-sql \
     --host yourserver.database.windows.net \
     --database testdb \
     --auth device-code
   ```

2. **Azure CLI Delegation:**
   ```bash
   az login  # First, login to Azure CLI
   aidb connect test-azure --type azure-sql \
     --host yourserver.database.windows.net \
     --database testdb \
     --auth az-cli
   ```

3. **Token Management:**
   ```bash
   aidb auth list
   aidb auth logout
   aidb auth login
   ```

### Integration Testing

Integration tests should be added to verify:
- Device code flow works end-to-end
- Token caching and refresh
- Multi-tenant support
- Error handling (expired tokens, wrong tenant, etc.)

## Future Enhancements

1. **OS Keychain Integration**: Store tokens in macOS Keychain / Windows Credential Manager
2. **Token Parsing**: Extract username from JWT token claims
3. **Service Principal Support**: Full implementation of service principal authentication
4. **Managed Identity Support**: Support for Azure-hosted workloads
5. **Token Encryption**: Additional encryption layer for token cache

## Troubleshooting

### "Failed to acquire Azure token"

- Check internet connectivity
- Verify Azure AD tenant is correct
- Ensure device code hasn't expired (15 minutes)
- Try `aidb auth logout` and `aidb auth login` again

### "Access denied to database"

- Verify your Azure AD account has access to the database
- Check database firewall rules
- Ensure you're using the correct tenant

### "Azure CLI not found"

- Install Azure CLI: `brew install azure-cli` (macOS) or follow [Azure CLI installation guide](https://docs.microsoft.com/cli/azure/install-azure-cli)
- Or use device code flow instead: `--auth device-code`

## References

- [Azure Identity SDK Documentation](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity)
- [Azure SQL Database Authentication](https://docs.microsoft.com/azure/azure-sql/database/authentication-aad-overview)
- [Device Code Flow](https://docs.microsoft.com/azure/active-directory/develop/v2-oauth2-device-code)


