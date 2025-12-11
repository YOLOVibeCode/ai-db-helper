# Azure SQL Connection Test Guide

## Testing Connection to Azure SQL Database

This guide explains how to test the connection to your Azure SQL database using Azure AD authentication.

## Prerequisites

1. **Azure AD Access**: Your account must have access to the Azure SQL database
2. **Firewall Rules**: Your IP address must be allowed in Azure SQL firewall rules
3. **Network Connectivity**: You must be able to reach Azure SQL from your network

## Running the Test

### Option 1: Using npm script

```bash
npm run test:azure-sql
```

### Option 2: Using the test script

```bash
./test-azure-sql.sh
```

### Option 3: Using CLI directly

```bash
aidb connect mobileframe \
  --type azure-sql \
  --host cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net \
  --database MobileFrame
```

## Authentication Flow

The test uses `auto` authentication method which:

1. **First**: Tries Azure CLI credentials (if `az login` was run)
2. **Fallback**: Uses Device Code flow (browser-based MFA)

### Device Code Flow

If Azure CLI is not available or not logged in, you'll see:

```
🔐 Azure Authentication Required

   Visit: https://microsoft.com/devicelogin
   Enter code: ABCD-1234

⏳ Waiting for authentication...
```

**Steps:**
1. Open the URL in your browser
2. Enter the code shown
3. Complete MFA if required
4. Select your account
5. The connection will proceed automatically

## Troubleshooting

### Connection Timeout

**Error**: `Failed to connect to ... in 15000ms`

**Solutions:**
1. **Check Firewall Rules**:
   - Go to Azure Portal → SQL Server → Networking
   - Add your current IP address
   - Or enable "Allow Azure services and resources to access this server"

2. **Check Network Connectivity**:
   ```bash
   # Test if you can reach the server
   telnet cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net 1433
   ```

3. **VPN/Network Issues**:
   - If behind corporate firewall, ensure port 1433 is open
   - Check if VPN is required for Azure access

### Authentication Failed

**Error**: `Failed to acquire Azure token`

**Solutions:**
1. **Try Azure CLI first**:
   ```bash
   az login
   # Then run the test again
   ```

2. **Check Tenant**:
   - If you have multiple Azure AD tenants, specify the correct one:
   ```bash
   aidb connect mobileframe \
     --type azure-sql \
     --host cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net \
     --database MobileFrame \
     --tenant your-tenant.onmicrosoft.com
   ```

3. **Verify Access**:
   - Ensure your Azure AD account has been granted access to the database
   - Contact your DBA to verify permissions

### Access Denied

**Error**: `Login failed for user` or `Cannot open database`

**Solutions:**
1. **Database Access**: Your Azure AD account needs to be added as a user in the database:
   ```sql
   -- Run by DBA in the database
   CREATE USER [your-email@domain.com] FROM EXTERNAL PROVIDER;
   ALTER ROLE db_datareader ADD MEMBER [your-email@domain.com];
   ```

2. **Server-Level Access**: For server admin access:
   - Azure Portal → SQL Server → Active Directory admin
   - Add your Azure AD account

## Test Configuration

The test connects to:
- **Server**: `cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net`
- **Database**: `MobileFrame`
- **Port**: `1433`
- **Authentication**: Azure AD (Device Code or Azure CLI)

## Expected Output

On success, you should see:

```
🔐 Attempting Azure AD authentication...
   Server: cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net
   Database: MobileFrame
   Method: auto (Azure CLI or Device Code)

✅ Successfully connected!

✅ Query executed successfully
   SQL Server Version: Microsoft SQL Server 2022...

✅ Current database: MobileFrame
   Current user: your-email@domain.com
```

## Manual Testing

You can also test the connection manually using the CLI:

```bash
# Connect and cache schema
aidb connect mobileframe \
  --type azure-sql \
  --host cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net \
  --database MobileFrame

# Execute a query
aidb exec mobileframe "SELECT @@VERSION AS version"

# View schema
aidb schema mobileframe
```

## Security Notes

- Tokens are cached locally in `~/.aidb/azure/tokens.json`
- Tokens expire after ~90 days and will require re-authentication
- Use `aidb auth logout` to clear cached tokens
- Never commit credentials or tokens to version control

