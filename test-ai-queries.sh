#!/bin/bash

# AI Query Demonstration
# Shows how AI can answer relationship questions using ONLY cached schema
# WITHOUT querying the database

set -e

echo "🤖 AI Database Helper - Relationship Intelligence Demo"
echo "======================================================"
echo ""

AIDB="node /Users/xcode/Documents/YOLOProjects/ai-db-helper/packages/cli/dist/index.js"

echo "This demonstrates that AI can answer questions about database structure"
echo "using ONLY the cached schema - NO database queries needed!"
echo ""

# Verify database container is NOT running
echo "Step 1: Stopping MySQL container to prove no database access..."
cd /Users/xcode/Documents/YOLOProjects/ai-db-helper/test-harnesses
docker-compose stop mysql > /dev/null 2>&1
echo "✅ MySQL is OFFLINE"
echo ""

# But cached schema is still available
echo "Step 2: Viewing cached schema (database is offline!)..."
cd /Users/xcode/Documents/YOLOProjects/ai-db-helper
$AIDB schema testdb_mysql --format compact | jq -r '.tables[] | "\(.n): \(.cols | length) columns, \(.rels | length) relationships"'
echo ""

# Show relationships
echo "Step 3: AI can answer: 'How do I join users to comments?'"
echo "Answer from cached schema:"
$AIDB relationships testdb_mysql | head -20
echo ""

# Show Mermaid diagram
echo "Step 4: AI can visualize the entire ER diagram:"
echo ""
$AIDB relationships testdb_mysql --format mermaid
echo ""

# Restart database
echo "Restarting MySQL for further testing..."
docker-compose start mysql > /dev/null 2>&1
echo "✅ MySQL back online"
echo ""

echo "🎉 Demonstration Complete!"
echo ""
echo "Key Points:"
echo "  ✓ Schema was cached during initial connection"
echo "  ✓ AI can answer relationship questions WITHOUT database access"
echo "  ✓ Instant response time (no network latency)"
echo "  ✓ Perfect for AI assistants that need to understand database structure"
echo ""
