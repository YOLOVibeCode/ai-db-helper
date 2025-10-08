# Query Execution & Database Manipulation Workflow

## Current State vs Future Vision

### ✅ What's Currently Implemented
- **Schema extraction** - Complete database structure cached locally
- **Relationship intelligence** - Explicit and inferred relationships
- **Read-only queries** - AI can understand structure WITHOUT interrogating database
- **CLI interface** - Connect, view schema, view relationships

### 🚧 What's NOT Yet Implemented (But Architected)
- **Query execution** - Running SELECT/INSERT/UPDATE/DELETE
- **Query planning** - EXPLAIN analysis and optimization
- **Index advisory** - Suggesting missing indexes
- **Safe mutations** - Schema changes with rollback
- **Transaction support** - BEGIN/COMMIT/ROLLBACK

---

## Recommended Workflow for Database Manipulation

### Option 1: **Query-by-Intent (Recommended for AI)**

**Philosophy:** AI describes intent, tool generates and executes safe SQL

```bash
# Example workflow
aidb query mydb "Show me all users who posted in the last 7 days"
```

**What happens:**
1. **Parse natural language** → Extract intent (SELECT, tables: users+posts, filter: date)
2. **Load cached schema** → Understand users/posts relationship
3. **Find join path** → `users.id ← posts.user_id`
4. **Generate SQL:**
   ```sql
   SELECT DISTINCT u.*
   FROM users u
   INNER JOIN posts p ON u.id = p.user_id
   WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);
   ```
5. **Analyze with EXPLAIN** → Check if indexes exist
6. **Show plan to user** → Display estimated cost, suggest indexes
7. **Ask for confirmation** → User approves
8. **Execute query** → Return results
9. **Log query** → Track for future optimization

**Benefits:**
- ✅ AI doesn't need to know SQL syntax
- ✅ Automatically uses optimal joins from relationship graph
- ✅ Built-in safety checks (EXPLAIN first)
- ✅ Index suggestions before execution
- ✅ Query logging for learning patterns

---

### Option 2: **Direct SQL Execution (For Power Users)**

**Philosophy:** User writes SQL, tool validates and executes

```bash
# Execute read query
aidb exec mydb "SELECT * FROM users WHERE email LIKE '%@gmail.com%'"

# Execute write query (requires --confirm)
aidb exec mydb "UPDATE users SET status = 'active' WHERE id = 123" --confirm

# Execute with EXPLAIN first
aidb exec mydb "SELECT * FROM posts WHERE user_id = 5" --explain
```

**What happens:**
1. **Parse SQL** → Identify query type (SELECT/INSERT/UPDATE/DELETE)
2. **Safety check:**
   - SELECT → Execute immediately
   - INSERT/UPDATE/DELETE → Require `--confirm` flag
   - DDL (ALTER TABLE) → Require `--confirm` AND create rollback snapshot
3. **Run EXPLAIN (if requested)** → Show query plan
4. **Execute query** → Return results or affected rows
5. **Log query** → Track in query log

**Safety features:**
- ✅ Dry-run mode for mutations (`--dry-run`)
- ✅ Transaction support (`--tx`)
- ✅ Automatic rollback on error
- ✅ Query timeout protection
- ✅ Confirmation prompts for destructive operations

---

### Option 3: **Schema Modification with Rollback (Safest for DDL)**

**Philosophy:** Schema changes are reversible

```bash
# Add a column (with automatic rollback script)
aidb schema:modify mydb "Add 'last_login' timestamp column to users table"
```

**What happens:**
1. **Parse intent** → Understand desired schema change
2. **Load current schema** → Check if column exists
3. **Generate migration SQL:**
   ```sql
   -- Forward migration
   ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;

   -- Rollback script (auto-generated)
   ALTER TABLE users DROP COLUMN last_login;
   ```
4. **Create snapshot** → Save current schema to `.aidb/rollbacks/mydb/snapshot-001.json`
5. **Show migration** → Display SQL to user
6. **Ask for confirmation**
7. **Execute in transaction:**
   ```sql
   BEGIN;
   ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;
   -- Verify column exists
   COMMIT;
   ```
8. **Save rollback script** → `.aidb/rollbacks/mydb/rollback-001.sql`
9. **Refresh cached schema** → Update `.aidb/schemas/mydb.json`

**Rollback capability:**
```bash
# View available rollback points
aidb rollback:list mydb

# Rollback to snapshot
aidb rollback mydb snapshot-001
```

**Safety features:**
- ✅ Automatic rollback script generation
- ✅ Schema snapshots before changes
- ✅ Verification after DDL execution
- ✅ Dry-run mode to preview changes
- ✅ Rollback history

---

## Detailed Implementation Architecture

### 1. Query Execution Command

```bash
aidb query <database> <natural-language-query> [options]
```

**Options:**
- `--explain` - Show query plan without executing
- `--dry-run` - Generate SQL but don't execute
- `--format <json|csv|table|markdown>` - Output format
- `--limit <n>` - Limit results
- `--timeout <ms>` - Query timeout
- `--tx` - Run in transaction (with manual COMMIT/ROLLBACK)

**Examples:**

```bash
# Natural language query (SELECT)
aidb query mydb "Find all posts by user with email alice@example.com"

# Generated SQL (shown to user):
# SELECT p.*
# FROM posts p
# INNER JOIN users u ON p.user_id = u.id
# WHERE u.email = 'alice@example.com';

# Show EXPLAIN plan first
aidb query mydb "Find posts with most comments" --explain

# Execute aggregation
aidb query mydb "Count users by country" --format table
```

---

### 2. Direct SQL Execution Command

```bash
aidb exec <database> <sql> [options]
```

**Options:**
- `--confirm` - Required for INSERT/UPDATE/DELETE
- `--dry-run` - Parse and validate only
- `--explain` - Show query plan
- `--tx` - Run in transaction
- `--timeout <ms>` - Query timeout

**Examples:**

```bash
# Read query (no confirmation needed)
aidb exec mydb "SELECT COUNT(*) FROM users"

# Write query (requires confirmation)
aidb exec mydb "DELETE FROM logs WHERE created_at < '2024-01-01'" --confirm

# With transaction
aidb exec mydb "UPDATE users SET status = 'active'" --tx --confirm
# Prompts: COMMIT or ROLLBACK?

# Dry run (validate SQL)
aidb exec mydb "UPDATE posts SET title = 'Test'" --dry-run
```

---

### 3. Schema Modification Command

```bash
aidb schema:modify <database> <intent> [options]
```

**Options:**
- `--dry-run` - Show SQL without executing
- `--no-rollback` - Skip rollback script generation
- `--force` - Skip confirmation

**Examples:**

```bash
# Add column
aidb schema:modify mydb "Add 'is_verified' boolean column to users table"

# Add index
aidb schema:modify mydb "Create index on posts.user_id for faster lookups"

# Add foreign key
aidb schema:modify mydb "Add foreign key from comments.post_id to posts.id"

# Rename table
aidb schema:modify mydb "Rename table 'posts' to 'articles'"

# Drop column (dangerous!)
aidb schema:modify mydb "Remove 'deprecated_field' column from users" --confirm
```

---

### 4. Index Advisory Command

```bash
aidb analyze <database> [options]
```

**What it does:**
1. Load query log (if tracking enabled)
2. Analyze most expensive queries
3. Run EXPLAIN on slow queries
4. Detect missing indexes
5. Suggest composite indexes
6. Calculate estimated improvement

**Examples:**

```bash
# Analyze database for missing indexes
aidb analyze mydb

# Output:
# 🔍 Index Analysis for mydb
#
# ⚠️  Missing Indexes (3 found):
#
# 1. Table: posts, Column: user_id
#    Reason: Frequent JOINs on users.id = posts.user_id
#    Impact: ~1000 queries/day, avg 450ms → estimated 50ms
#    Suggested SQL: CREATE INDEX idx_posts_user_id ON posts(user_id);
#
# 2. Table: posts, Columns: [status, created_at]
#    Reason: WHERE status = 'published' ORDER BY created_at DESC
#    Impact: ~500 queries/day, avg 800ms → estimated 100ms
#    Suggested SQL: CREATE INDEX idx_posts_status_created ON posts(status, created_at);
#
# 3. Table: comments, Column: post_id
#    Reason: WHERE post_id IN (...)
#    Impact: ~2000 queries/day, avg 200ms → estimated 30ms
#    Suggested SQL: CREATE INDEX idx_comments_post_id ON comments(post_id);
#
# 💡 Estimated total improvement: 60% faster queries
#
# Apply all suggestions? (Y/n)

# Analyze specific table
aidb analyze mydb --table users

# Export analysis as JSON
aidb analyze mydb --format json > analysis.json
```

---

### 5. Query Log & Learning

```bash
aidb log <database> [options]
```

**What it does:**
- Track all queries executed via tool
- Store query text, execution time, rows affected
- Identify slow queries
- Learn query patterns for future optimization

**Examples:**

```bash
# View recent queries
aidb log mydb

# View slow queries
aidb log mydb --slow --threshold 1000ms

# View most frequent queries
aidb log mydb --frequent --limit 10

# Clear log
aidb log mydb --clear
```

---

## Safety & Permission Model

### Read Operations (SELECT)
- ✅ Execute immediately
- ✅ No confirmation needed
- ✅ Timeout protection (default 30s)
- ✅ Row limit recommended (default 1000)

### Write Operations (INSERT/UPDATE/DELETE)
- ⚠️ Require `--confirm` flag
- ⚠️ Show affected rows estimate (if possible)
- ⚠️ Prompt for confirmation
- ⚠️ Run in transaction (auto-rollback on error)
- ⚠️ Log all mutations

### Schema Changes (DDL)
- 🛑 Always create rollback snapshot
- 🛑 Generate rollback SQL
- 🛑 Require explicit confirmation
- 🛑 Run in transaction
- 🛑 Verify changes after execution
- 🛑 Refresh cached schema

### Dangerous Operations
- ❌ DROP TABLE - Require `--force --confirm`
- ❌ TRUNCATE - Require `--force --confirm`
- ❌ DROP DATABASE - Blocked (too dangerous)
- ❌ Batch DELETE - Warn if >1000 rows

---

## AI Integration Workflow

### Typical AI Interaction Flow

```
User: "Show me all users who haven't logged in for 30 days"

AI: [Calls aidb query]
    1. Loads cached schema
    2. Understands: users table has 'last_login' column
    3. Generates SQL: SELECT * FROM users WHERE last_login < DATE_SUB(NOW(), INTERVAL 30 DAY)
    4. Returns: 42 users found

User: "Delete those inactive users"

AI: [Calls aidb exec with intent]
    ⚠️  This will DELETE 42 rows from users table
    ⚠️  Related data in posts, comments will be CASCADE deleted (124 rows)

    Generated SQL:
    DELETE FROM users
    WHERE last_login < DATE_SUB(NOW(), INTERVAL 30 DAY);

    Confirm deletion? (yes/no)

User: "yes"

AI: [Executes with --confirm]
    ✅ Transaction started
    ✅ Deleted 42 users
    ✅ Cascade deleted 124 related rows
    ✅ Transaction committed
    📝 Logged to query history
```

---

## Implementation Priority

Based on the architecture checklist, here's the recommended build order:

### Phase 5: Query Execution (Week 5-6)
1. ✅ **Query Planner** - EXPLAIN parsing for MySQL/PostgreSQL/MSSQL/Oracle
2. ✅ **Index Advisor** - Missing index detection
3. ✅ **SQL Parser** - Parse SELECT/INSERT/UPDATE/DELETE
4. ✅ **Query Executor** - Safe execution with transaction support

### Phase 6: Schema Modifications (Week 6-7)
1. ✅ **Rollback Manager** - Snapshot creation and restoration
2. ✅ **DDL Generator** - Generate ALTER TABLE statements
3. ✅ **Migration System** - Forward/backward migrations

### Phase 7: Natural Language Processing (Week 7-8)
1. ✅ **Intent Parser** - Parse natural language queries
2. ✅ **SQL Generator** - Generate SQL from intent
3. ✅ **Query Optimizer** - Use relationship graph for joins

---

## Configuration

**File: `.aidb/config.json`**

```json
{
  "databases": {
    "mydb": {
      "queryExecution": {
        "enabled": true,
        "requireConfirmForWrites": true,
        "defaultTimeout": 30000,
        "defaultLimit": 1000,
        "enableQueryLog": true
      },
      "schemaModification": {
        "enabled": true,
        "autoRollback": true,
        "requireConfirmForDDL": true
      },
      "indexAdvisory": {
        "enabled": true,
        "autoSuggest": true,
        "minImprovementPercent": 10
      }
    }
  }
}
```

---

## CLI Commands Summary

| Command | Purpose | Safety Level |
|---------|---------|--------------|
| `aidb query <db> <intent>` | Natural language query | 🟢 Safe (read-only) |
| `aidb exec <db> <sql>` | Direct SQL execution | 🟡 Requires --confirm for writes |
| `aidb schema:modify <db> <intent>` | Schema changes with rollback | 🔴 High risk, requires confirmation |
| `aidb analyze <db>` | Index advisory | 🟢 Safe (read-only) |
| `aidb log <db>` | View query history | 🟢 Safe (read-only) |
| `aidb rollback <db> <snapshot>` | Restore schema snapshot | 🔴 High risk, requires confirmation |

---

## Example: Complete Workflow

```bash
# 1. Connect to database (already done)
aidb connect mydb --type mysql --host localhost --database myapp

# 2. Ask AI a question
aidb query mydb "Show me users who have never posted"

# AI generates and executes:
# SELECT u.*
# FROM users u
# LEFT JOIN posts p ON u.id = p.user_id
# WHERE p.id IS NULL;

# 3. AI notices this is slow (no index on posts.user_id)
aidb analyze mydb --table posts

# Suggests: CREATE INDEX idx_posts_user_id ON posts(user_id);

# 4. Apply the suggested index
aidb schema:modify mydb "Create index on posts.user_id" --confirm

# 5. Re-run the query (now fast!)
aidb query mydb "Show me users who have never posted"

# 6. If something goes wrong, rollback
aidb rollback mydb snapshot-001
```

---

## Key Principles

1. **Safety First** - Destructive operations require explicit confirmation
2. **Reversibility** - All schema changes create rollback scripts
3. **Transparency** - Always show generated SQL before execution
4. **Intelligence** - Use cached relationships for optimal joins
5. **Learning** - Log queries to improve future suggestions
6. **Performance** - EXPLAIN before executing expensive queries

---

## Next Steps to Implement

To enable query execution and database manipulation, implement:

1. **Query Executor Service** (`packages/core/src/query/QueryExecutor.ts`)
2. **SQL Parser** (use `node-sql-parser` library)
3. **Transaction Manager** (`packages/core/src/query/TransactionManager.ts`)
4. **Rollback Manager** (`packages/core/src/rollback/RollbackManager.ts`)
5. **CLI Commands**:
   - `packages/cli/src/commands/query.ts`
   - `packages/cli/src/commands/exec.ts`
   - `packages/cli/src/commands/schema-modify.ts`
   - `packages/cli/src/commands/analyze.ts`
   - `packages/cli/src/commands/log.ts`
   - `packages/cli/src/commands/rollback.ts`

The foundation (schema extraction, relationships, adapters) is solid. Adding query execution on top of this foundation will make the tool fully functional for database manipulation while maintaining AI-friendly intelligence and safety.
