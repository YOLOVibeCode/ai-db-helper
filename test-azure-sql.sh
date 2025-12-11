#!/bin/bash

# Azure SQL Connection Test Script
# Tests connection to Azure SQL database using Azure AD authentication

echo "🔐 Azure SQL Connection Test"
echo "============================"
echo ""
echo "Server: cf-sqlmi-test-centralus-01.22f71a65f223.database.windows.net"
echo "Database: MobileFrame"
echo ""
echo "This test will:"
echo "  1. Attempt Azure AD authentication (device code or Azure CLI)"
echo "  2. Connect to Azure SQL database"
echo "  3. Execute test queries"
echo ""
echo "Press Ctrl+C to cancel"
echo ""
sleep 2

# Run the test
npm run test:azure-sql

