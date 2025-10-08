#!/bin/bash

# Simple MSSQL adapter test

set -e

echo "Testing MSSQL Adapter..."
echo "========================"
echo ""

cd /Users/xcode/Documents/YOLOProjects/ai-db-helper

# Test connection
echo "1. Testing MSSQL connection..."
echo "testpass123" | node packages/cli/dist/index.js connect testdb_mssql \
  --type mssql \
  --host localhost \
  --port 1433 \
  --database testdb \
  --user sa \
  --password TestPass123!

echo ""
echo "2. Viewing cached schema..."
node packages/cli/dist/index.js schema testdb_mssql --format json | jq -r '.tables[] | "\(.name): \(.columns | length) columns"'

echo ""
echo "3. Viewing relationships..."
node packages/cli/dist/index.js relationships testdb_mssql

echo ""
echo "✅ MSSQL test complete!"
