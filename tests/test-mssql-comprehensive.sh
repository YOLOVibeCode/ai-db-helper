#!/bin/bash

# Comprehensive MSSQL Test Runner
# This script sets up and runs extensive MSSQL integration tests

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  AI Database Helper - Comprehensive MSSQL Test Suite"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "  Please start Docker Desktop and try again"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Step 1: Start MSSQL container
echo ""
echo -e "${BLUE}Step 1/5: Starting MSSQL Server 2022 container...${NC}"
cd test-harnesses
docker-compose up -d mssql
echo -e "${GREEN}✓ MSSQL container started${NC}"

# Step 2: Wait for MSSQL to be ready
echo ""
echo -e "${BLUE}Step 2/5: Waiting for MSSQL to initialize (30s)...${NC}"
echo "  MSSQL needs time to start and create the database"
sleep 10
echo "  Progress: ██████░░░░ 33%"
sleep 10
echo "  Progress: ████████░░ 66%"
sleep 10
echo "  Progress: ██████████ 100%"
echo -e "${GREEN}✓ MSSQL should be ready${NC}"

# Step 3: Initialize test database
echo ""
echo -e "${BLUE}Step 3/5: Initializing test database with schema...${NC}"

# Copy init script into container and execute
docker exec aidb-test-mssql mkdir -p /tmp 2>/dev/null || true
docker cp seed/mssql-init.sql aidb-test-mssql:/tmp/init.sql

echo "  Creating testdb database..."
docker exec aidb-test-mssql /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "TestPass123!" \
  -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'testdb') CREATE DATABASE testdb;" \
  2>&1 | grep -v "Changed database context" || true

echo "  Running initialization script..."
docker exec aidb-test-mssql /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "TestPass123!" \
  -i /tmp/init.sql \
  2>&1 | tail -5

echo -e "${GREEN}✓ Database initialized${NC}"

# Step 4: Verify database is ready
echo ""
echo -e "${BLUE}Step 4/5: Verifying database setup...${NC}"

TABLE_COUNT=$(docker exec aidb-test-mssql /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "TestPass123!" -d testdb \
  -Q "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';" \
  -h -1 2>&1 | tr -d ' \r\n')

echo "  Tables created: $TABLE_COUNT"

USER_COUNT=$(docker exec aidb-test-mssql /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "TestPass123!" -d testdb \
  -Q "SELECT COUNT(*) FROM users;" \
  -h -1 2>&1 | tr -d ' \r\n')

echo "  Test users created: $USER_COUNT"

if [ "$TABLE_COUNT" -ge "7" ] && [ "$USER_COUNT" -ge "4" ]; then
    echo -e "${GREEN}✓ Database verification passed${NC}"
else
    echo -e "${RED}✗ Database verification failed${NC}"
    echo "  Expected: 7+ tables, 4+ users"
    echo "  Got: $TABLE_COUNT tables, $USER_COUNT users"
    exit 1
fi

# Step 5: Run comprehensive tests
echo ""
echo -e "${BLUE}Step 5/5: Running comprehensive MSSQL integration tests...${NC}"
echo ""
cd ..

# Build packages first
echo "  Building packages..."
npm run build:core > /dev/null 2>&1
npm run build:adapters > /dev/null 2>&1
npm run build:cli > /dev/null 2>&1
echo -e "${GREEN}  ✓ Packages built${NC}"
echo ""

# Run the comprehensive test suite
echo "  Executing test suite (this may take 1-2 minutes)..."
echo ""
npx vitest run test-harnesses/integration/mssql-comprehensive.test.ts --reporter=verbose

TEST_EXIT_CODE=$?

# Test summary
echo ""
echo "═══════════════════════════════════════════════════════════"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "  Comprehensive MSSQL integration test suite completed successfully"
    echo "  All features validated against real MSSQL Server 2022"
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "  Please review the output above for details"
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

# Cleanup option
echo -e "${YELLOW}Test container is still running.${NC}"
echo "To stop it, run: docker-compose -f test-harnesses/docker-compose.yml down mssql"
echo ""

exit $TEST_EXIT_CODE
