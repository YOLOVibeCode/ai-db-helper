#!/bin/bash

# End-to-End Test Script for AI Database Helper
# This demonstrates the full workflow: connect → extract → analyze → query

set -e

echo "🚀 AI Database Helper - End-to-End Test"
echo "========================================"
echo ""

# Build the CLI
echo "📦 Building CLI..."
cd /Users/xcode/Documents/YOLOProjects/ai-db-helper
npm run build > /dev/null 2>&1
echo "✅ Build complete!"
echo ""

# Create the aidb command alias
AIDB="node /Users/xcode/Documents/YOLOProjects/ai-db-helper/packages/cli/dist/index.js"

# Test 1: Connect to MySQL database
echo "🔌 Test 1: Connecting to MySQL..."
echo "testpass123" | $AIDB connect testdb_mysql \
  --type mysql \
  --host localhost \
  --port 3306 \
  --database testdb \
  --user testuser \
  --password testpass

echo ""
echo "✅ MySQL connected and schema cached!"
echo ""

# Test 2: List databases
echo "📋 Test 2: Listing databases..."
$AIDB list
echo ""

# Test 3: View schema in compact format (AI-optimized)
echo "📊 Test 3: Viewing schema (compact format)..."
$AIDB schema testdb_mysql --format compact | head -30
echo ""

# Test 4: View relationships
echo "🔗 Test 4: Analyzing relationships..."
$AIDB relationships testdb_mysql --include-inferred
echo ""

# Test 5: Connect to PostgreSQL
echo "🔌 Test 5: Connecting to PostgreSQL..."
echo "testpass123" | $AIDB connect testdb_postgres \
  --type postgres \
  --host localhost \
  --port 5432 \
  --database testdb \
  --user testuser \
  --password testpass

echo ""
echo "✅ PostgreSQL connected!"
echo ""

# Test 6: Compare databases
echo "📊 Test 6: Listing all databases..."
$AIDB list
echo ""

# Test 7: Export Mermaid diagram
echo "🎨 Test 7: Generating Mermaid ER diagram..."
$AIDB relationships testdb_mysql --format mermaid > /tmp/schema.mermaid
echo "✅ Mermaid diagram saved to /tmp/schema.mermaid"
echo ""
cat /tmp/schema.mermaid
echo ""

echo "🎉 All tests passed!"
echo ""
echo "📝 Summary:"
echo "  - Connected to 2 databases (MySQL, PostgreSQL)"
echo "  - Extracted full schemas with relationships"
echo "  - Cached everything for instant AI access"
echo "  - Generated visual ER diagrams"
echo ""
echo "💡 Now AI can understand your database structure instantly!"
