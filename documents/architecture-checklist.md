# AI Database Helper - Architecture Checklist

> **ENGINEER DIRECTIVE**: This checklist provides the complete implementation roadmap following Interface Segregation Principle, TDD, and event-driven architecture per `.cursorrules`.

---

## Phase 1: Project Foundation & Interface Contracts (Week 1-2)

### 1.1 Project Structure Setup

- [ ] Initialize monorepo structure with workspaces
- [ ] Create separate projects:
  - [ ] `contracts/` - Interface definitions only (ZERO dependencies)
  - [ ] `core/` - Business logic implementations
  - [ ] `adapters/` - Database-specific implementations
  - [ ] `cli/` - Command-line interface
  - [ ] `test-harnesses/` - Integration tests with real databases
- [ ] Configure TypeScript with strict mode
- [ ] Setup package.json for each project with proper dependency isolation
- [ ] Create .gitignore (exclude .aidb/, node_modules/, dist/)

**Project Structure:**
```
ai-db-helper/
├── packages/
│   ├── contracts/              # Interface-only project
│   │   ├── package.json        # version: 1.0.0, NO dependencies
│   │   ├── tsconfig.json       # strict mode
│   │   ├── database/
│   │   │   ├── IDatabaseAdapter.ts
│   │   │   └── ISchemaExtractor.ts
│   │   ├── schema/
│   │   │   ├── ISchemaCache.ts
│   │   │   └── ISchemaFormatter.ts
│   │   ├── relationships/
│   │   │   ├── IRelationshipAnalyzer.ts
│   │   │   └── IRelationshipGraph.ts
│   │   ├── query/
│   │   │   ├── IQueryPlanner.ts
│   │   │   └── IIndexAdvisor.ts
│   │   ├── security/
│   │   │   └── ICredentialVault.ts
│   │   ├── rollback/
│   │   │   └── IRollbackManager.ts
│   │   └── types/
│   │       ├── schema-types.ts
│   │       ├── relationship-types.ts
│   │       └── query-types.ts
│   │
│   ├── core/                   # Business logic
│   │   ├── package.json        # depends on: @aidb/contracts
│   │   ├── services/
│   │   ├── domain/
│   │   └── utils/
│   │
│   ├── adapters/               # Database implementations
│   │   ├── package.json        # depends on: @aidb/contracts
│   │   ├── mysql/
│   │   ├── postgres/
│   │   ├── mssql/
│   │   ├── sqlite/
│   │   ├── mongodb/
│   │   ├── db2/
│   │   ├── oracle/
│   │   └── azure-sql/
│   │
│   ├── cli/                    # CLI interface
│   │   ├── package.json        # depends on: @aidb/contracts
│   │   ├── commands/
│   │   ├── prompts/
│   │   └── index.ts
│   │
│   └── test-harnesses/         # Tests
│       ├── package.json
│       ├── docker-compose.yml
│       ├── integration/
│       └── contract-tests/
│
├── package.json                # Root workspace config
├── tsconfig.json               # Base TypeScript config
├── .gitignore
└── architecture-checklist.md   # This file
```

### 1.2 Core Interface Contracts (contracts/types/)

**File: `contracts/types/schema-types.ts`**
- [ ] Define `DatabaseSchema` interface
- [ ] Define `TableSchema` interface
- [ ] Define `ColumnSchema` interface
- [ ] Define `IndexSchema` interface
- [ ] Define `ConstraintSchema` interface
- [ ] Define `ProcedureSchema` interface
- [ ] Define `ViewSchema` interface
- [ ] Define `CacheMetadata` interface
- [ ] Define `ConnectionCredentials` type
- [ ] Define `DatabaseType` enum (mysql, postgres, mssql, sqlite, mongodb, db2, oracle, azure-sql)

**File: `contracts/types/relationship-types.ts`**
- [ ] Define `Relationship` interface
- [ ] Define `Multiplicity` type ('1:1' | '1:N' | 'N:1' | 'N:N')
- [ ] Define `JunctionTable` interface
- [ ] Define `JoinPath` interface
- [ ] Define `JoinStep` interface
- [ ] Define `RelatedTable` interface
- [ ] Define `Graph` interface (nodes, edges)

**File: `contracts/types/query-types.ts`**
- [ ] Define `QueryPlan` interface
- [ ] Define `IndexSuggestion` interface
- [ ] Define `QueryWarning` interface
- [ ] Define `IndexRecommendation` interface
- [ ] Define `QueryCostEstimate` interface
- [ ] Define `JoinClause` interface

### 1.3 Database Adapter Interfaces (contracts/database/)

**File: `contracts/database/IDatabaseAdapter.ts`**
```typescript
interface IDatabaseAdapter {
  connect(credentials: ConnectionCredentials): Promise<Connection>;
  disconnect(): Promise<void>;
  validateConnection(): Promise<boolean>;
  executeQuery<T>(sql: string, params?: any[]): Promise<T>;
  getDatabaseType(): DatabaseType;
}
```
- [ ] Create IDatabaseAdapter interface
- [ ] Create Connection type
- [ ] Add connection pool management methods

**File: `contracts/database/ISchemaExtractor.ts`**
```typescript
interface ISchemaExtractor {
  extractTables(filter?: TableFilter): Promise<TableSchema[]>;
  extractStoredProcedures(): Promise<ProcedureSchema[]>;
  extractIndexes(tableName?: string): Promise<IndexSchema[]>;
  extractConstraints(tableName?: string): Promise<ConstraintSchema[]>;
  extractViews(): Promise<ViewSchema[]>;
  getTableRowCount(tableName: string): Promise<number>;
}
```
- [ ] Create ISchemaExtractor interface
- [ ] Create TableFilter type (includeSchemas, includeTables, excludeTables)

### 1.4 Schema Cache Interfaces (contracts/schema/)

**File: `contracts/schema/ISchemaCache.ts`**
- [ ] Create ISchemaCache interface (save, load, invalidate, getMetadata)
- [ ] Create CacheOptions type

**File: `contracts/schema/ISchemaFormatter.ts`**
- [ ] Create ISchemaFormatter interface (toCompactJSON, toMarkdown, toDDL, toMermaidER, toTypeScript)
- [ ] Create FormatterOptions type

### 1.5 Relationship Interfaces (contracts/relationships/)

**File: `contracts/relationships/IRelationshipAnalyzer.ts`**
- [ ] Create IRelationshipAnalyzer interface
- [ ] Add discoverExplicitRelationships() method
- [ ] Add inferImplicitRelationships() method
- [ ] Add detectJunctionTables() method
- [ ] Add calculateMultiplicity() method

**File: `contracts/relationships/IRelationshipGraph.ts`**
- [ ] Create IRelationshipGraph interface
- [ ] Add buildGraph() method
- [ ] Add findJoinPath() method
- [ ] Add getRelatedTables() method
- [ ] Add exportMermaidER() method
- [ ] Add exportGraphViz() method

### 1.6 Query Planning Interfaces (contracts/query/)

**File: `contracts/query/IQueryPlanner.ts`**
- [ ] Create IQueryPlanner interface
- [ ] Add analyzeQuery() method
- [ ] Add suggestIndexes() method
- [ ] Add estimateCost() method
- [ ] Add optimizeJoinOrder() method

**File: `contracts/query/IIndexAdvisor.ts`**
- [ ] Create IIndexAdvisor interface
- [ ] Add analyzeTableUsage() method
- [ ] Add detectMissingIndexes() method
- [ ] Add scoreIndexEffectiveness() method

### 1.7 Security & Rollback Interfaces (contracts/security/, contracts/rollback/)

**File: `contracts/security/ICredentialVault.ts`**
- [ ] Create ICredentialVault interface
- [ ] Add store() method (encrypt credentials)
- [ ] Add retrieve() method (decrypt credentials)
- [ ] Add delete() method
- [ ] Add list() method

**File: `contracts/rollback/IRollbackManager.ts`**
- [ ] Create IRollbackManager interface
- [ ] Add createSnapshot() method
- [ ] Add generateRollbackScript() method
- [ ] Add executeRollback() method
- [ ] Add listSnapshots() method

### 1.8 Configuration & Initialization

**File: `packages/contracts/package.json`**
```json
{
  "name": "@aidb/contracts",
  "version": "1.0.0",
  "description": "Interface contracts for AI Database Helper",
  "main": "dist/index.js",
  "types": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```
- [ ] Create package.json for contracts (ZERO runtime dependencies)
- [ ] Create tsconfig.json with strict mode
- [ ] Create index.ts to export all interfaces
- [ ] Verify no implementation code exists in contracts/

---

## Phase 2: Core Infrastructure (Week 2-3)

### 2.1 File System & Directory Management

**File: `core/infrastructure/DirectoryManager.ts`**
- [ ] Implement `.aidb/` directory creation
- [ ] Create subdirectories:
  - [ ] `.aidb/schemas/` (cached schema JSON files)
  - [ ] `.aidb/credentials.enc` (encrypted credentials)
  - [ ] `.aidb/rollbacks/<db-name>/` (rollback SQL scripts)
  - [ ] `.aidb/metadata/<db-name>.meta` (cache metadata)
  - [ ] `.aidb/config.json` (configuration)
- [ ] Set proper file permissions (700 for .aidb/, 600 for credentials.enc)
- [ ] Implement `aidb doctor` validation logic

### 2.2 Credential Vault Implementation

**File: `core/security/CredentialVault.ts`**
- [ ] Implement ICredentialVault
- [ ] Use AES-256-GCM encryption
- [ ] Implement PBKDF2 key derivation
- [ ] Generate random salt per credential
- [ ] Generate unique IV per encryption
- [ ] Store master key in memory (prompt user on CLI start)
- [ ] Write encrypted credentials to `.aidb/credentials.enc`
- [ ] Write unit tests with real encryption/decryption (NO MOCKS)

**Test: `test-harnesses/integration/credential-vault.test.ts`**
- [ ] Test store() → retrieve() roundtrip
- [ ] Test encryption produces different ciphertext with same input
- [ ] Test delete() removes credentials
- [ ] Test list() returns all stored database names
- [ ] Test invalid password fails decryption

### 2.3 Schema Cache Implementation

**File: `core/cache/SchemaCache.ts`**
- [ ] Implement ISchemaCache
- [ ] Save schema to `.aidb/schemas/<db-name>.json`
- [ ] Implement compression (gzip) for large schemas
- [ ] Generate SHA-256 hash for change detection
- [ ] Store metadata (lastRefresh, schemaHash, version)
- [ ] Implement load with cache validation
- [ ] Write unit tests with real file I/O (NO MOCKS)

**Test: `test-harnesses/integration/schema-cache.test.ts`**
- [ ] Test save() creates file with correct format
- [ ] Test load() retrieves saved schema
- [ ] Test invalidate() removes cached file
- [ ] Test hash changes when schema changes
- [ ] Test compression reduces file size

### 2.4 Configuration Manager

**File: `core/config/ConfigManager.ts`**
- [ ] Implement configuration loading from `.aidb/config.json`
- [ ] Implement default configuration generation
- [ ] Support schema subset configuration
- [ ] Support relationship analysis settings
- [ ] Support query planning settings
- [ ] Write schema for config validation

**File: `.aidb/config.json` (runtime-generated)**
```json
{
  "version": "1.0.0",
  "databases": {},
  "security": {
    "encryptionAlgorithm": "aes-256-gcm"
  },
  "cache": {
    "maxAge": 86400,
    "compressionEnabled": true
  }
}
```

---

## Phase 3: Database Adapters - MySQL & PostgreSQL (Week 3-4)

### 3.1 MySQL Adapter

**File: `adapters/mysql/MySQLAdapter.ts`**
- [ ] Implement IDatabaseAdapter for MySQL
- [ ] Use mysql2 driver with connection pooling
- [ ] Implement connect() with proper error handling
- [ ] Implement disconnect() with pool cleanup
- [ ] Implement validateConnection() (SELECT 1 query)
- [ ] Implement executeQuery() with parameterized queries

**File: `adapters/mysql/MySQLSchemaExtractor.ts`**
- [ ] Implement ISchemaExtractor for MySQL
- [ ] Extract tables from INFORMATION_SCHEMA.TABLES
- [ ] Extract columns from INFORMATION_SCHEMA.COLUMNS
- [ ] Extract indexes from INFORMATION_SCHEMA.STATISTICS
- [ ] Extract foreign keys from INFORMATION_SCHEMA.KEY_COLUMN_USAGE
- [ ] Extract stored procedures from INFORMATION_SCHEMA.ROUTINES
- [ ] Extract views from INFORMATION_SCHEMA.VIEWS
- [ ] Support schema subset filtering (includeTables, excludeTables)
- [ ] Handle MyISAM vs InnoDB differences

**SQL Queries for MySQL:**
```sql
-- Tables
SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, CREATE_TIME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = ?

-- Columns
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE,
       COLUMN_KEY, COLUMN_DEFAULT, EXTRA
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?

-- Foreign Keys
SELECT CONSTRAINT_NAME, COLUMN_NAME,
       REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
```

**Test: `test-harnesses/integration/mysql-adapter.test.ts`**
- [ ] Use Docker MySQL container (mysql:8.0)
- [ ] Create test database with known schema
- [ ] Test connection/disconnection
- [ ] Test schema extraction for all entity types
- [ ] Test foreign key discovery
- [ ] Test schema subset filtering

### 3.2 PostgreSQL Adapter

**File: `adapters/postgres/PostgreSQLAdapter.ts`**
- [ ] Implement IDatabaseAdapter for PostgreSQL
- [ ] Use pg driver with connection pooling
- [ ] Implement all IDatabaseAdapter methods
- [ ] Handle schema-qualified table names (schema.table)

**File: `adapters/postgres/PostgreSQLSchemaExtractor.ts`**
- [ ] Implement ISchemaExtractor for PostgreSQL
- [ ] Extract tables from pg_catalog.pg_tables
- [ ] Extract columns from information_schema.columns
- [ ] Extract indexes from pg_catalog.pg_indexes
- [ ] Extract foreign keys from pg_catalog.pg_constraint
- [ ] Extract stored procedures/functions from pg_catalog.pg_proc
- [ ] Extract views from pg_catalog.pg_views
- [ ] Extract custom types (enums, composites)
- [ ] Extract PostgreSQL extensions (if relevant)
- [ ] Support multiple schemas (public, custom)

**SQL Queries for PostgreSQL:**
```sql
-- Tables
SELECT schemaname, tablename, tableowner
FROM pg_catalog.pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')

-- Foreign Keys
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name,
       rc.delete_rule, rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = $1
```

**Test: `test-harnesses/integration/postgres-adapter.test.ts`**
- [ ] Use Docker PostgreSQL container (postgres:15-alpine)
- [ ] Create test database with multiple schemas
- [ ] Test schema extraction with schema filtering
- [ ] Test custom type extraction

### 3.3 Docker Test Infrastructure

**File: `test-harnesses/docker-compose.yml`**
```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: testpass
      MYSQL_DATABASE: testdb
    ports:
      - "3306:3306"
    volumes:
      - ./seed/mysql-init.sql:/docker-entrypoint-initdb.d/init.sql

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: testdb
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
    ports:
      - "5432:5432"
    volumes:
      - ./seed/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql

  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: Y
      SA_PASSWORD: TestPass123!
    ports:
      - "1433:1433"

  mongodb:
    image: mongo:6
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: testpass
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```
- [ ] Create docker-compose.yml with all 7 databases
- [ ] Create seed SQL scripts for MySQL
- [ ] Create seed SQL scripts for PostgreSQL
- [ ] Create seed data for MongoDB
- [ ] Add test data with known relationships (users, posts, comments, tags)

**File: `test-harnesses/seed/mysql-init.sql`**
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255)
);

CREATE TABLE posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

CREATE TABLE comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE
);

CREATE TABLE post_tags (
  post_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```
- [ ] Create comprehensive test schema with all relationship types

---

## Phase 4: Relationship Intelligence System (Week 4-5)

### 4.1 Relationship Analyzer

**File: `core/relationships/RelationshipAnalyzer.ts`**
- [ ] Implement IRelationshipAnalyzer
- [ ] Implement discoverExplicitRelationships() - parse FK constraints
- [ ] Implement inferImplicitRelationships() - naming convention analysis
  - [ ] Pattern: `<table>_id` → `<table>.id`
  - [ ] Handle singular/plural table names (use pluralize library)
  - [ ] Calculate confidence score (0.0-1.0)
- [ ] Implement detectJunctionTables() - find M:N junction tables
  - [ ] Heuristic: exactly 2 FKs + minimal other columns
  - [ ] Calculate confidence score
- [ ] Implement calculateMultiplicity() - data sampling
  - [ ] Query: COUNT(DISTINCT from_col) vs COUNT(*)
  - [ ] Determine 1:1, 1:N, N:1, or N:N

**Test: `test-harnesses/integration/relationship-analyzer.test.ts`**
- [ ] Test explicit FK discovery on test database
- [ ] Test implicit relationship inference
- [ ] Test junction table detection (post_tags)
- [ ] Test multiplicity calculation accuracy
- [ ] Test confidence scoring

### 4.2 Relationship Graph Builder

**File: `core/relationships/RelationshipGraph.ts`**
- [ ] Implement IRelationshipGraph
- [ ] Use graphlib for graph data structure
- [ ] Implement buildGraph() - convert relationships to nodes/edges
- [ ] Implement findJoinPath() - Dijkstra's shortest path
  - [ ] Cost function: table size + index availability
  - [ ] Return multiple paths sorted by cost
- [ ] Implement getRelatedTables() - BFS traversal with max depth
- [ ] Implement exportMermaidER() - generate Mermaid ER diagram
- [ ] Implement exportGraphViz() - generate GraphViz DOT format

**File: `core/relationships/JoinPathFinder.ts`**
- [ ] Implement join path optimization algorithm
- [ ] Calculate join cost based on:
  - [ ] Table row counts
  - [ ] Index availability
  - [ ] Relationship cardinality
- [ ] Generate SQL JOIN clauses from paths

**Test: `test-harnesses/integration/relationship-graph.test.ts`**
- [ ] Test graph building from relationships
- [ ] Test join path finding (users → comments via posts)
- [ ] Test Mermaid ER diagram generation
- [ ] Test related tables discovery with depth limit

### 4.3 Relationship-Aware Schema Model

**File: `core/domain/EnrichedSchema.ts`**
- [ ] Extend DatabaseSchema with relationships
- [ ] Add relationships: Relationship[] property
- [ ] Add junctionTables: JunctionTable[] property
- [ ] Add quickJoinPaths: Map<string, JoinPath[]>
- [ ] Implement schema merging (base schema + relationships)

---

## Phase 5: Query Planning & Index Advisory (Week 5-6)

### 5.1 Query Plan Analyzer

**File: `core/query/QueryPlanner.ts`**
- [ ] Implement IQueryPlanner
- [ ] Parse SQL queries (use sql-parser library)
- [ ] Extract tables, columns, WHERE clauses, JOINs
- [ ] Execute EXPLAIN command (database-specific)
- [ ] Parse EXPLAIN output (MySQL vs PostgreSQL formats differ)
- [ ] Calculate query cost estimate
- [ ] Detect full table scans
- [ ] Optimize join order using relationship graph

**MySQL EXPLAIN Parser:**
```typescript
interface MySQLExplainRow {
  id: number;
  select_type: string;
  table: string;
  type: 'ALL' | 'index' | 'range' | 'ref' | 'eq_ref' | 'const';
  possible_keys: string | null;
  key: string | null;
  rows: number;
}
```
- [ ] Parse MySQL EXPLAIN output
- [ ] Identify missing indexes (type='ALL', key=null)

**PostgreSQL EXPLAIN Parser:**
```typescript
interface PostgresExplainNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Total Cost': number;
  'Plan Rows': number;
}
```
- [ ] Parse PostgreSQL EXPLAIN (ANALYZE, FORMAT JSON) output
- [ ] Extract cost, rows, index usage

### 5.2 Index Advisor

**File: `core/query/IndexAdvisor.ts`**
- [ ] Implement IIndexAdvisor
- [ ] Analyze WHERE clause columns
- [ ] Analyze JOIN condition columns
- [ ] Analyze ORDER BY columns
- [ ] Detect missing indexes
- [ ] Suggest composite indexes (WHERE + ORDER BY)
- [ ] Score index effectiveness (estimated % improvement)
- [ ] Generate CREATE INDEX statements

**Algorithm: Missing Index Detection**
```typescript
function detectMissingIndexes(queryPlan: QueryPlan): IndexSuggestion[] {
  const suggestions: IndexSuggestion[] = [];

  // Find full table scans
  for (const scan of queryPlan.fullTableScans) {
    // Analyze WHERE clauses for this table
    const whereCols = extractWhereColumns(queryPlan.sql, scan.table);

    // Check if index exists
    for (const col of whereCols) {
      if (!hasIndexOn(scan.table, col)) {
        suggestions.push({
          tableName: scan.table,
          columns: [col],
          type: 'btree',
          reason: `WHERE clause on ${col}`,
          estimatedImprovement: estimateImprovement(scan.rows, col)
        });
      }
    }
  }

  return suggestions;
}
```
- [ ] Implement missing index detection
- [ ] Implement composite index suggestions
- [ ] Implement index effectiveness scoring

**Test: `test-harnesses/integration/query-planner.test.ts`**
- [ ] Test EXPLAIN parsing for MySQL
- [ ] Test EXPLAIN parsing for PostgreSQL
- [ ] Test index suggestion generation
- [ ] Test query cost estimation

---

## Phase 6: Schema Formatters (Week 6)

### 6.1 Output Formatters

**File: `core/formatters/CompactJSONFormatter.ts`**
- [ ] Implement toCompactJSON() method
- [ ] Minimize field names for token efficiency
- [ ] Include relationships inline
- [ ] Include indexes inline
- [ ] Exclude unnecessary metadata

**File: `core/formatters/MarkdownFormatter.ts`**
- [ ] Implement toMarkdown() method
- [ ] Generate table of contents
- [ ] Format tables as markdown tables
- [ ] Include relationship diagrams (Mermaid)
- [ ] Include index recommendations
- [ ] Generate natural language relationship summaries

**File: `core/formatters/DDLFormatter.ts`**
- [ ] Implement toDDL() method
- [ ] Generate CREATE TABLE statements
- [ ] Generate CREATE INDEX statements
- [ ] Generate ALTER TABLE ADD CONSTRAINT (foreign keys)
- [ ] Generate CREATE PROCEDURE statements
- [ ] Support MySQL, PostgreSQL, MSSQL syntax variations

**File: `core/formatters/MermaidFormatter.ts`**
- [ ] Implement toMermaidER() method
- [ ] Generate Mermaid ER diagram syntax
- [ ] Include multiplicity labels (1:1, 1:N, N:N)
- [ ] Include relationship cardinality
- [ ] Annotate indexed columns

**File: `core/formatters/TypeScriptFormatter.ts`**
- [ ] Implement toTypeScript() method
- [ ] Generate TypeScript interfaces for tables
- [ ] Map SQL types to TypeScript types
- [ ] Include JSDoc comments with constraints
- [ ] Generate relationship types (foreign key references)

**Example Output - Compact JSON:**
```json
{
  "db": "myapp",
  "v": "1.0.0",
  "tables": [{
    "n": "users",
    "cols": [
      {"n": "id", "t": "int", "pk": true},
      {"n": "email", "t": "varchar(255)", "u": true, "idx": true}
    ],
    "rels": [{"to": "posts", "m": "1:N", "via": "posts.user_id"}]
  }]
}
```

**Example Output - Markdown:**
```markdown
# Database Schema: myapp

## Tables

### users
**Columns:**
| Name  | Type          | Constraints     | Indexed |
|-------|---------------|-----------------|---------|
| id    | int           | PRIMARY KEY     | ✓       |
| email | varchar(255)  | UNIQUE NOT NULL | ✓       |

**Relationships:**
- Creates **many** posts (1:N via posts.user_id)
  - ✓ Indexed on posts.user_id
```

**Test: `test-harnesses/integration/formatters.test.ts`**
- [ ] Test compact JSON output
- [ ] Test Markdown output
- [ ] Test DDL generation
- [ ] Test Mermaid ER diagram generation
- [ ] Test TypeScript interface generation

---

## Phase 7: Rollback & Snapshot System (Week 7)

### 7.1 Rollback Manager

**File: `core/rollback/RollbackManager.ts`**
- [ ] Implement IRollbackManager
- [ ] Implement createSnapshot() - save schema before changes
- [ ] Implement generateRollbackScript() - reverse DDL generation
  - [ ] ADD COLUMN → DROP COLUMN
  - [ ] DROP COLUMN → ADD COLUMN (with type/constraints)
  - [ ] RENAME TABLE → RENAME TABLE (reverse)
  - [ ] CREATE INDEX → DROP INDEX
  - [ ] ALTER TABLE ... → reverse ALTER
- [ ] Implement executeRollback() - run rollback SQL
- [ ] Implement listSnapshots() - show available snapshots
- [ ] Store snapshots in `.aidb/rollbacks/<db-name>/<timestamp>.json`
- [ ] Store rollback SQL in `.aidb/rollbacks/<db-name>/<timestamp>_rollback.sql`

**File: `core/rollback/SchemaChangeGuard.ts`**
- [ ] Implement schema change validation
- [ ] Assess risk level (safe, moderate, dangerous)
- [ ] Validate SQL syntax
- [ ] Check for destructive operations (DROP TABLE, DROP COLUMN)
- [ ] Warn about data loss potential

**Risk Assessment Rules:**
```typescript
const riskRules = {
  safe: [
    /ADD COLUMN .* (NULL|DEFAULT)/i,
    /CREATE INDEX/i,
    /RENAME COLUMN/i
  ],
  moderate: [
    /RENAME TABLE/i,
    /ALTER COLUMN .* TYPE/i,
    /DROP INDEX/i
  ],
  dangerous: [
    /DROP TABLE/i,
    /DROP COLUMN/i,
    /TRUNCATE TABLE/i,
    /ALTER COLUMN .* DROP DEFAULT/i
  ]
};
```
- [ ] Implement risk pattern matching
- [ ] Generate warnings for dangerous operations

**Test: `test-harnesses/integration/rollback-manager.test.ts`**
- [ ] Test snapshot creation
- [ ] Test rollback script generation
- [ ] Test rollback execution
- [ ] Test risk assessment accuracy

---

## Phase 8: CLI Implementation (Week 7-8)

### 8.1 CLI Framework Setup

**File: `cli/index.ts`**
- [ ] Setup Commander.js
- [ ] Define all commands
- [ ] Implement global options (--verbose, --format)
- [ ] Setup error handling
- [ ] Setup logging (chalk for colors, ora for spinners)

### 8.2 Core Commands

**File: `cli/commands/connect.ts`**
- [ ] Implement `aidb connect <db-name>` command
- [ ] Prompt for connection details (inquirer.js)
- [ ] Options: --type, --host, --port, --database, --user
- [ ] Test connection
- [ ] Store credentials (via CredentialVault)
- [ ] Extract initial schema
- [ ] Cache schema
- [ ] Update config.json

**File: `cli/commands/disconnect.ts`**
- [ ] Implement `aidb disconnect <db-name>` command
- [ ] Remove from active connections
- [ ] Optionally delete credentials (--delete-credentials flag)

**File: `cli/commands/list.ts`**
- [ ] Implement `aidb list` command
- [ ] Display all configured databases
- [ ] Show last refresh time
- [ ] Show schema hash
- [ ] Show connection status

**File: `cli/commands/schema.ts`**
- [ ] Implement `aidb schema <db-name>` command
- [ ] Options: --format (json|markdown|ddl|mermaid|typescript)
- [ ] Options: --table (filter specific table)
- [ ] Options: --output (write to file)
- [ ] Load from cache
- [ ] Format using ISchemaFormatter
- [ ] Output to STDOUT or file

**File: `cli/commands/refresh.ts`**
- [ ] Implement `aidb refresh <db-name>` command
- [ ] Re-extract schema from database
- [ ] Compute schema diff
- [ ] Update cache
- [ ] Update metadata (hash, timestamp)
- [ ] Display what changed

**File: `cli/commands/diff.ts`**
- [ ] Implement `aidb diff <db-name>` command
- [ ] Compare current database schema with cached schema
- [ ] Display added/removed/modified tables
- [ ] Display added/removed columns
- [ ] Display added/removed indexes
- [ ] Display relationship changes

### 8.3 Relationship Commands

**File: `cli/commands/relationships.ts`**
- [ ] Implement `aidb relationships <db-name>` command
- [ ] Options: --format (json|markdown|mermaid)
- [ ] Options: --table (filter specific table)
- [ ] Options: --include-inferred (show inferred relationships)
- [ ] Display relationship graph
- [ ] Display multiplicity
- [ ] Display junction tables

**File: `cli/commands/join-path.ts`**
- [ ] Implement `aidb join-path <db-name> --from <table> --to <table>` command
- [ ] Find optimal join path
- [ ] Display SQL JOIN clauses
- [ ] Display estimated cost
- [ ] Display required indexes

**File: `cli/commands/junctions.ts`**
- [ ] Implement `aidb junctions <db-name>` command
- [ ] Display detected junction tables
- [ ] Show connected tables
- [ ] Show confidence score

### 8.4 Query Planning Commands

**File: `cli/commands/explain.ts`**
- [ ] Implement `aidb explain <db-name> "<sql>"` command
- [ ] Execute EXPLAIN on query
- [ ] Parse explain plan
- [ ] Display used indexes
- [ ] Display missing indexes
- [ ] Suggest optimizations
- [ ] Display estimated cost

**File: `cli/commands/indexes.ts`**
- [ ] Implement `aidb indexes <db-name>` command
- [ ] Subcommand: `--recommend` (show index suggestions)
- [ ] Subcommand: `--apply` (interactive mode to create indexes)
- [ ] Display existing indexes
- [ ] Display missing indexes with priority
- [ ] Generate CREATE INDEX statements

### 8.5 Rollback Commands

**File: `cli/commands/snapshot.ts`**
- [ ] Implement `aidb snapshot create <db-name>` command
- [ ] Options: --message (snapshot description)
- [ ] Create snapshot
- [ ] Display snapshot ID

**File: `cli/commands/rollback.ts`**
- [ ] Implement `aidb rollback <snapshot-id>` command
- [ ] Options: --dry-run (preview rollback SQL)
- [ ] Options: --execute (actually run rollback)
- [ ] Display rollback SQL
- [ ] Prompt for confirmation
- [ ] Execute rollback
- [ ] Refresh schema

**File: `cli/commands/apply.ts`**
- [ ] Implement `aidb apply <db-name> --sql "<ddl>"` command
- [ ] Options: --dry-run (preview changes)
- [ ] Create pre-change snapshot
- [ ] Assess risk level
- [ ] Display warnings
- [ ] Prompt for confirmation
- [ ] Execute DDL
- [ ] Generate rollback script
- [ ] Refresh schema

### 8.6 Utility Commands

**File: `cli/commands/export.ts`**
- [ ] Implement `aidb export <db-name> --output <file>` command
- [ ] Export schema to JSON file
- [ ] Include all relationships and metadata

**File: `cli/commands/import.ts`**
- [ ] Implement `aidb import <db-name> --input <file>` command
- [ ] Import schema from JSON file
- [ ] Update cache

**File: `cli/commands/doctor.ts`**
- [ ] Implement `aidb doctor` command
- [ ] Validate `.aidb/` directory structure
- [ ] Validate config.json format
- [ ] Check for corrupt cache files
- [ ] Verify credentials encryption integrity
- [ ] Check for missing snapshots
- [ ] Display health report

**File: `cli/commands/credentials.ts`**
- [ ] Implement `aidb credentials list` command
- [ ] Implement `aidb credentials delete <db-name>` command
- [ ] Implement `aidb credentials rotate <db-name>` command

---

## Phase 9: Additional Database Adapters (Week 8-9)

### 9.1 MSSQL Adapter

**File: `adapters/mssql/MSSQLAdapter.ts`**
- [ ] Implement IDatabaseAdapter for MSSQL
- [ ] Use mssql driver

**File: `adapters/mssql/MSSQLSchemaExtractor.ts`**
- [ ] Implement ISchemaExtractor for MSSQL
- [ ] Extract from sys.tables, sys.columns
- [ ] Handle schema-qualified names (dbo.users)
- [ ] Extract stored procedures from sys.procedures

### 9.2 SQLite Adapter

**File: `adapters/sqlite/SQLiteAdapter.ts`**
- [ ] Implement IDatabaseAdapter for SQLite
- [ ] Use better-sqlite3 driver

**File: `adapters/sqlite/SQLiteSchemaExtractor.ts`**
- [ ] Implement ISchemaExtractor for SQLite
- [ ] Extract from sqlite_master table
- [ ] Parse CREATE TABLE statements
- [ ] Note: No stored procedures support

### 9.3 MongoDB Adapter

**File: `adapters/mongodb/MongoDBAdapter.ts`**
- [ ] Implement IDatabaseAdapter for MongoDB
- [ ] Use mongodb driver

**File: `adapters/mongodb/MongoDBSchemaInferencer.ts`**
- [ ] Implement schema inference (MongoDB is schema-less)
- [ ] Sample documents (e.g., 1000 per collection)
- [ ] Infer field types from values
- [ ] Detect arrays, nested objects
- [ ] Calculate field frequency (% of documents with field)
- [ ] Detect embedded vs referenced relationships

**Schema Inference Algorithm:**
```typescript
async function inferCollectionSchema(collection: Collection): Promise<TableSchema> {
  const sample = await collection.aggregate([
    { $sample: { size: 1000 } }
  ]).toArray();

  const fieldStats = new Map<string, FieldStat>();

  for (const doc of sample) {
    for (const [key, value] of Object.entries(doc)) {
      if (!fieldStats.has(key)) {
        fieldStats.set(key, { types: new Set(), count: 0 });
      }
      fieldStats.get(key).types.add(typeof value);
      fieldStats.get(key).count++;
    }
  }

  const columns: ColumnSchema[] = [];
  for (const [field, stat] of fieldStats) {
    columns.push({
      name: field,
      type: Array.from(stat.types).join(' | '),
      nullable: stat.count < sample.length,
      frequency: (stat.count / sample.length) * 100
    });
  }

  return { name: collection.collectionName, columns };
}
```

### 9.4 DB2 Adapter

**File: `adapters/db2/DB2Adapter.ts`**
- [ ] Implement IDatabaseAdapter for DB2
- [ ] Use ibm_db driver

**File: `adapters/db2/DB2SchemaExtractor.ts`**
- [ ] Implement ISchemaExtractor for DB2
- [ ] Extract from SYSCAT tables
- [ ] Handle partitions and tablespaces

### 9.5 Oracle Adapter

**File: `adapters/oracle/OracleAdapter.ts`**
- [ ] Implement IDatabaseAdapter for Oracle
- [ ] Use oracledb driver

**File: `adapters/oracle/OracleSchemaExtractor.ts`**
- [ ] Implement ISchemaExtractor for Oracle
- [ ] Extract from ALL_TABLES, DBA_OBJECTS
- [ ] Handle packages, synonyms
- [ ] Handle materialized views

### 9.6 Azure SQL Adapter

**File: `adapters/azure-sql/AzureSQLAdapter.ts`**
- [ ] Extend MSSQLAdapter
- [ ] Implement IAzureSQLAdapter
- [ ] Add managed identity authentication
- [ ] Add service principal authentication

**File: `adapters/azure-sql/AzureSQLSchemaExtractor.ts`**
- [ ] Extend MSSQLSchemaExtractor
- [ ] Extract temporal tables (sys.temporal_tables)
- [ ] Extract Row-Level Security policies
- [ ] Extract column store indexes
- [ ] Integrate with Query Store for recommendations

**Test: Integration tests for all adapters**
- [ ] Test MSSQL adapter with Docker container
- [ ] Test SQLite adapter with in-memory database
- [ ] Test MongoDB adapter with Docker container
- [ ] Test DB2 adapter (if license available)
- [ ] Test Oracle adapter (if license available)
- [ ] Test Azure SQL adapter (requires Azure account)

---

## Phase 10: Production Readiness (Week 9-10)

### 10.1 Error Handling & Logging

**File: `core/utils/Logger.ts`**
- [ ] Implement structured logging
- [ ] Support log levels (DEBUG, INFO, WARN, ERROR)
- [ ] Log to file: `.aidb/logs/aidb.log`
- [ ] Implement --verbose flag support
- [ ] Implement --silent flag support

**File: `core/utils/ErrorHandler.ts`**
- [ ] Implement global error handler
- [ ] Catch connection errors
- [ ] Catch query execution errors
- [ ] Catch file system errors
- [ ] Display user-friendly error messages
- [ ] Log stack traces in verbose mode

### 10.2 Performance Optimization

**File: `core/cache/CacheWarmer.ts`**
- [ ] Implement cache warming (preload frequently accessed schemas)
- [ ] Implement lazy loading for large schemas
- [ ] Implement compression for large cache files

**File: `adapters/common/ConnectionPool.ts`**
- [ ] Implement connection pooling for all adapters
- [ ] Reuse connections across commands
- [ ] Implement connection timeout
- [ ] Implement connection retry logic

### 10.3 Comprehensive Testing

**Test Coverage Requirements:**
- [ ] Unit tests for all core classes (>90% coverage)
- [ ] Integration tests with real databases (all 7 types)
- [ ] Contract compliance tests (verify all adapters implement interfaces correctly)
- [ ] End-to-end CLI tests
- [ ] Performance benchmarks

**File: `test-harnesses/contract-tests/adapter-compliance.test.ts`**
```typescript
const adapterTypes = [
  MySQLAdapter, PostgreSQLAdapter, MSSQLAdapter,
  SQLiteAdapter, MongoDBAdapter, DB2Adapter, OracleAdapter
];

for (const AdapterClass of adapterTypes) {
  describe(`${AdapterClass.name} compliance`, () => {
    it('implements IDatabaseAdapter', () => {
      const adapter = new AdapterClass();
      expect(adapter).toHaveProperty('connect');
      expect(adapter).toHaveProperty('disconnect');
      expect(adapter).toHaveProperty('validateConnection');
    });

    it('can connect and extract schema', async () => {
      const adapter = new AdapterClass();
      await adapter.connect(testCredentials);
      const extractor = new SchemaExtractor(adapter);
      const schema = await extractor.extractTables();
      expect(schema).toBeDefined();
      expect(schema.length).toBeGreaterThan(0);
    });
  });
}
```

### 10.4 Documentation

**File: `README.md`**
- [ ] Write comprehensive README
- [ ] Installation instructions
- [ ] Quick start guide
- [ ] Command reference
- [ ] Architecture overview
- [ ] Contributing guidelines

**File: `docs/architecture.md`**
- [ ] Document architecture decisions
- [ ] Document interface contracts
- [ ] Document data flow
- [ ] Include C4 diagrams

**File: `docs/database-support.md`**
- [ ] Document supported databases
- [ ] Document database-specific features
- [ ] Document limitations per database

**File: `docs/cli-reference.md`**
- [ ] Complete CLI command reference
- [ ] Examples for each command
- [ ] Common workflows

**File: `CHANGELOG.md`**
- [ ] Initialize changelog
- [ ] Document version 1.0.0 features

### 10.5 Build & Distribution

**File: `package.json` (root)**
```json
{
  "name": "aidb",
  "version": "1.0.0",
  "bin": {
    "aidb": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "test:integration": "docker-compose -f test-harnesses/docker-compose.yml up -d && npm run test",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"**/*.ts\""
  },
  "workspaces": [
    "packages/*"
  ]
}
```
- [ ] Configure npm package
- [ ] Add shebang to CLI entry point (#!/usr/bin/env node)
- [ ] Build distribution bundle
- [ ] Test global installation (npm install -g)

**File: `.npmignore`**
- [ ] Exclude test files
- [ ] Exclude source TypeScript (include only dist/)
- [ ] Exclude .aidb directory

---

## Phase 11: Schema Subset Selection (Week 10)

### 11.1 Schema Filtering

**File: `core/schema/SchemaFilter.ts`**
- [ ] Implement schema subset filtering
- [ ] Support includeSchemas (array of schema names)
- [ ] Support includeTables (array of table names or patterns)
- [ ] Support excludeTables (array of table names or patterns)
- [ ] Support wildcard patterns (users*, *_audit)
- [ ] Apply filters during extraction phase

**Configuration:**
```json
{
  "databases": {
    "large-db": {
      "schemaSubset": {
        "enabled": true,
        "includeSchemas": ["public", "analytics"],
        "includeTables": ["users", "posts", "comments"],
        "excludeTables": ["*_audit", "sessions"]
      }
    }
  }
}
```

**CLI Options:**
```bash
aidb connect large-db --schemas public,analytics
aidb connect large-db --tables users,posts,comments
aidb schema large-db --exclude-tables audit_log,sessions
```

**Test: `test-harnesses/integration/schema-filter.test.ts`**
- [ ] Test includeSchemas filtering
- [ ] Test includeTables filtering
- [ ] Test excludeTables filtering
- [ ] Test wildcard pattern matching
- [ ] Test filter combination

---

## Quality Assurance Checklist

### Code Quality
- [ ] All code passes TypeScript strict mode
- [ ] All code passes ESLint
- [ ] All code is formatted with Prettier
- [ ] No console.log (use Logger instead)
- [ ] No any types (use proper types)
- [ ] All functions have JSDoc comments

### Testing
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All contract tests pass
- [ ] Test coverage >90%
- [ ] All tests use real implementations (NO MOCKS)
- [ ] Performance benchmarks meet targets (<100ms cache retrieval)

### Security
- [ ] Credentials are encrypted with AES-256-GCM
- [ ] .aidb/ directory has correct permissions (700)
- [ ] credentials.enc has correct permissions (600)
- [ ] No credentials in logs
- [ ] SQL injection prevention (parameterized queries)
- [ ] Input validation on all CLI arguments

### Documentation
- [ ] README.md is complete
- [ ] All CLI commands documented
- [ ] Architecture documentation complete
- [ ] ADRs documented
- [ ] CHANGELOG updated

### Compliance with .cursorrules
- [ ] All business logic behind interfaces (ISP)
- [ ] Separate contracts project with ZERO dependencies
- [ ] No mocks in tests (real database instances)
- [ ] TDD approach (tests written first)
- [ ] Event-driven architecture (if applicable)
- [ ] No generic naming (Helper, Manager, Processor)
- [ ] Project separation (contracts/core/adapters/cli)

---

## Success Metrics Validation

### Performance Metrics
- [ ] Schema cache retrieval: <100ms ✓
- [ ] Full schema refresh (1000 tables): <5 seconds ✓
- [ ] Credential decryption: <50ms ✓
- [ ] Diff computation: <200ms ✓
- [ ] Cache file size (1000 tables): <5MB ✓

### Accuracy Metrics
- [ ] Relationship discovery accuracy: >90% ✓
- [ ] Relationship recall (explicit FKs): 100% ✓
- [ ] Relationship precision (inferred): >85% ✓
- [ ] Join path optimality: >90% ✓
- [ ] Index suggestion acceptance: Track in production

### Functional Completeness
- [ ] All 7 database types supported ✓
- [ ] All CLI commands implemented ✓
- [ ] Relationship intelligence working ✓
- [ ] Query planning working ✓
- [ ] Rollback system working ✓
- [ ] Schema subset selection working ✓
- [ ] Azure SQL support working ✓

---

## Deployment Checklist

### Pre-Release
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Version bumped to 1.0.0
- [ ] CHANGELOG updated
- [ ] Build artifacts generated

### Release
- [ ] Publish to npm
- [ ] Create GitHub release
- [ ] Tag version in git
- [ ] Announce release

### Post-Release
- [ ] Monitor for issues
- [ ] Gather user feedback
- [ ] Track success metrics
- [ ] Plan v1.1 features

---

## Future Enhancements (Post v1.0)

### v1.1 - Quality of Life
- [ ] Interactive schema browser (TUI with blessed/ink)
- [ ] Query history tracking
- [ ] Favorite queries
- [ ] Schema comparison between databases
- [ ] Multi-database search

### v1.2 - Advanced Features
- [ ] Schema migration generator (compare schemas, generate ALTERs)
- [ ] Query builder (natural language → SQL)
- [ ] Performance monitoring integration
- [ ] Real-time schema change detection

### v2.0 - Cloud & Collaboration
- [ ] Cloud sync (.aidb to S3/Azure Blob)
- [ ] Team collaboration features
- [ ] Web UI dashboard
- [ ] API server mode
- [ ] GraphQL schema export

---

## Notes for Engineer

1. **Interface-First Development**: Always define interfaces in `contracts/` before implementing
2. **Real Implementations in Tests**: Use Docker containers, never mocks
3. **TDD Workflow**: Write test → implement interface → implement class → pass test
4. **Incremental Validation**: Test each adapter independently before moving to next
5. **Performance Testing**: Benchmark cache retrieval, query planning on large databases
6. **Security First**: Never log credentials, always validate file permissions
7. **Error Messages**: User-friendly, actionable ("Database 'foo' not found. Run 'aidb list' to see configured databases.")
8. **Documentation**: Update README as features are completed
9. **Commit Often**: Small, focused commits with descriptive messages
10. **Ask Questions**: If requirements unclear, document assumptions in ADRs

---

## Command Reference Summary

```bash
# Connection
aidb connect <db> --type <type> [--host] [--port] [--database] [--user]
aidb disconnect <db>
aidb list

# Schema
aidb schema <db> [--format json|markdown|ddl|mermaid|typescript] [--table <name>]
aidb refresh <db>
aidb diff <db>

# Relationships
aidb relationships <db> [--format json|markdown|mermaid] [--table <name>]
aidb join-path <db> --from <table> --to <table>
aidb junctions <db>

# Query Planning
aidb explain <db> "<sql>"
aidb indexes <db> [--recommend] [--apply]

# Rollback
aidb snapshot create <db> [--message <msg>]
aidb rollback <snapshot-id> [--dry-run] [--execute]
aidb apply <db> --sql "<ddl>" [--dry-run]

# Credentials
aidb credentials list
aidb credentials delete <db>
aidb credentials rotate <db>

# Utilities
aidb export <db> --output <file>
aidb import <db> --input <file>
aidb doctor
```

---

**END OF ARCHITECTURE CHECKLIST**

This checklist serves as the single source of truth for implementation. Check off items as completed. Update with discoveries and refinements during development.
