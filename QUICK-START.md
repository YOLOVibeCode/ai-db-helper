# AI Database Helper - Quick Start Guide

**Get AI-powered database intelligence in 30 seconds!**

---

## 🚀 Installation

```bash
# Option 1: Install globally (recommended)
npm install -g @yolovibecode/aidb

# Option 2: Use directly with npx (no install)
npx @yolovibecode/aidb --help
```

---

## ⚡ Quick Start (3 Steps)

### **Step 1: Connect to Your Database**

```bash
# Using connection string (easiest)
aidb connect mydb --connection-string "mysql://user:pass@localhost:3306/mydb"

# Or specify details manually
aidb connect mydb --type mysql --host localhost --database mydb --user root --password secret
```

**Supported Databases:**
- MySQL/MariaDB
- PostgreSQL
- Microsoft SQL Server
- Oracle
- MongoDB

### **Step 2: View Your Schema**

```bash
# Get AI-optimized schema (compact JSON)
aidb schema mydb

# Get human-readable markdown
aidb schema mydb --format markdown

# Get relationship diagram
aidb schema mydb --format mermaid

# Get TypeScript interfaces
aidb schema mydb --format typescript
```

### **Step 3: Explore Relationships**

```bash
# See all relationships
aidb relationships mydb

# Include inferred relationships
aidb relationships mydb --include-inferred
```

**Done! 🎉** Your database schema is now cached locally. AI can query it instantly without touching your database!

---

## 🤖 For AI Assistants (Claude, ChatGPT, etc.)

### **Tell AI About This Tool:**

```
I've installed AI Database Helper. It caches database schemas locally so you can understand my database structure without querying it.

Available commands:
- aidb schema <db> - Get complete schema
- aidb relationships <db> - Get relationships
- aidb exec <db> "SQL" - Execute safe queries
- aidb analyze <db> "SQL" - Get query optimization advice

The schema is cached at ~/.aidb/ and includes:
- All tables, columns, indexes, constraints
- Primary/foreign key relationships
- Inferred relationships based on naming
- Junction table detection
- Optimal join paths
```

### **Example AI Conversation:**

**You:** "Show me my user schema"
```bash
aidb schema mydb --table users
```

**AI Response:**
```json
{
  "table": "users",
  "columns": [
    {"name": "id", "type": "INT", "pk": true},
    {"name": "email", "type": "VARCHAR(255)", "unique": true},
    {"name": "name", "type": "VARCHAR(255)"}
  ]
}
```

**You:** "How do I join users to comments?"

**AI:** "Let me check the relationships..."
```bash
aidb relationships mydb
```

**AI Response:**
```
Optimal path: users.id ← posts.user_id ← comments.post_id
SQL: SELECT u.*, c.* FROM users u
     JOIN posts p ON u.id = p.user_id
     JOIN comments c ON p.id = c.post_id
```

---

## 📋 Common Use Cases

### **1. Generate Complex Queries**

**You:** "Get all posts with comments and tags for user with email 'alice@example.com'"

**AI uses:**
```bash
aidb relationships mydb --format json
```

**AI generates:**
```sql
SELECT
  u.name,
  p.title,
  GROUP_CONCAT(DISTINCT c.content) as comments,
  GROUP_CONCAT(DISTINCT t.name) as tags
FROM users u
JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON p.id = c.post_id
LEFT JOIN post_tags pt ON p.id = pt.post_id
LEFT JOIN tags t ON pt.tag_id = t.id
WHERE u.email = 'alice@example.com'
GROUP BY u.id, p.id;
```

### **2. Create Stored Procedures**

**You:** "Create a stored procedure to get user activity summary"

**AI:**
1. Checks schema: `aidb schema mydb`
2. Checks relationships: `aidb relationships mydb`
3. Generates procedure:

```sql
CREATE PROCEDURE GetUserActivitySummary(IN user_email VARCHAR(255))
BEGIN
  SELECT
    u.id,
    u.name,
    u.email,
    COUNT(DISTINCT p.id) as post_count,
    COUNT(DISTINCT c.id) as comment_count,
    MAX(p.created_at) as last_post_date
  FROM users u
  LEFT JOIN posts p ON u.id = p.user_id
  LEFT JOIN comments c ON u.id = c.user_id
  WHERE u.email = user_email
  GROUP BY u.id;
END;
```

4. Tests it: `aidb exec mydb "CALL GetUserActivitySummary('alice@example.com')" --dry-run`

### **3. Optimize Queries**

**You:** "Why is this query slow?"

```bash
aidb analyze mydb "SELECT * FROM posts WHERE user_id = 1 AND published = 1"
```

**Output:**
```
⚠️  Missing index detected
✅  Recommendation: CREATE INDEX idx_posts_user_published ON posts(user_id, published)
📊  Estimated improvement: 85%
💾  Disk space required: 2.5 MB
🔧  Maintenance overhead: Low
```

### **4. Understand Multiplicity**

**You:** "Is this a 1:1, 1:N, or N:N relationship between users and posts?"

```bash
aidb relationships mydb --table users --related posts
```

**Output:**
```
Relationship: users → posts
Type: 1:N (One-to-Many)
From: users.id
To: posts.user_id
Confidence: 100% (explicit FK)
Description: Each user can have multiple posts
```

---

## 🎯 Connection String Examples

### **MySQL**
```bash
aidb connect prod_db --connection-string "mysql://root:password@localhost:3306/myapp"
```

### **PostgreSQL**
```bash
aidb connect prod_db --connection-string "postgresql://user:pass@localhost:5432/myapp"
```

### **Microsoft SQL Server**
```bash
aidb connect prod_db --connection-string "mssql://sa:Password123!@localhost:1433/myapp"
```

### **MongoDB**
```bash
aidb connect prod_db --connection-string "mongodb://user:pass@localhost:27017/myapp?authSource=admin"
```

### **Oracle**
```bash
aidb connect prod_db --connection-string "oracle://user:pass@localhost:1521/ORCL"
```

---

## 🔧 Advanced Usage

### **Safe Query Execution**

```bash
# Execute with safety checks
aidb exec mydb "UPDATE users SET name = 'Updated' WHERE id = 1"

# Dry-run (simulate without executing)
aidb exec mydb "DELETE FROM old_data WHERE created_at < '2020-01-01'" --dry-run

# With row limit
aidb exec mydb "SELECT * FROM large_table" --limit 100

# With timeout
aidb exec mydb "SELECT * FROM huge_join" --timeout 5000
```

### **Index Optimization**

```bash
# Analyze a query
aidb analyze mydb "SELECT * FROM posts WHERE user_id = 1"

# Get all index recommendations
aidb analyze mydb --all-tables

# Find redundant indexes
aidb analyze mydb --find-redundant

# Find unused indexes
aidb analyze mydb --find-unused
```

### **Schema Snapshots (Rollback Support)**

```bash
# Create snapshot before changes
aidb snapshot create mydb "Before adding new tables"

# List snapshots
aidb snapshot list mydb

# Rollback to snapshot
aidb snapshot rollback mydb <snapshot-id>
```

---

## 📊 Output Formats

### **Compact (AI-optimized)**
```bash
aidb schema mydb --format compact
```
```json
{"tables":[{"n":"users","cols":[{"n":"id","t":"INT","pk":true}]}]}
```

### **Markdown (Human-readable)**
```bash
aidb schema mydb --format markdown
```
```markdown
# users
- **id** INT PRIMARY KEY
- **email** VARCHAR(255) UNIQUE
- **name** VARCHAR(255)
```

### **Mermaid (Visual diagram)**
```bash
aidb schema mydb --format mermaid
```
```mermaid
erDiagram
    users ||--o{ posts : "has many"
    posts ||--o{ comments : "has many"
```

### **TypeScript (Type definitions)**
```bash
aidb schema mydb --format typescript
```
```typescript
interface User {
  id: number;
  email: string;
  name: string;
}
```

---

## 🔐 Security

**All credentials are encrypted!**
- Stored at `~/.aidb/credentials.enc`
- AES-256-GCM encryption
- Master password required
- File permissions: 600 (owner only)

**Safe query execution:**
- Dangerous operations detected (UPDATE/DELETE without WHERE)
- Confirmation prompts
- Dry-run mode available
- Row limits enforced

---

## 🆘 Troubleshooting

### **Connection Failed**
```bash
# Test connection manually
aidb connect test_db --type mysql --host localhost --database testdb --test-only
```

### **Schema Not Found**
```bash
# Refresh cached schema
aidb refresh mydb
```

### **Permission Denied**
```bash
# Check .aidb directory permissions
ls -la ~/.aidb
# Should be: drwx------ (700)
```

### **Forgot Master Password**
```bash
# Reset (WARNING: deletes all cached data)
rm -rf ~/.aidb
aidb connect mydb --connection-string "..."
```

---

## 📚 Complete Command Reference

### **Connection Management**
```bash
aidb connect <name>              # Connect to database
aidb list                        # List all databases
aidb disconnect <name>           # Remove database
aidb refresh <name>              # Refresh schema cache
```

### **Schema Exploration**
```bash
aidb schema <name>               # View complete schema
aidb schema <name> --table <t>   # View specific table
aidb schema <name> --format <f>  # Change output format
```

### **Relationship Analysis**
```bash
aidb relationships <name>                    # Show all relationships
aidb relationships <name> --include-inferred # Include inferred
aidb relationships <name> --table <t>        # Filter by table
```

### **Query Execution**
```bash
aidb exec <name> "<sql>"         # Execute query
aidb exec <name> "<sql>" --dry-run      # Simulate
aidb exec <name> "<sql>" --explain      # Show plan
aidb exec <name> "<sql>" --limit 100    # Limit rows
```

### **Query Analysis**
```bash
aidb analyze <name> "<sql>"      # Get optimization advice
aidb analyze <name> --all-tables # Analyze schema
aidb analyze <name> --find-redundant   # Find redundant indexes
aidb analyze <name> --find-unused      # Find unused indexes
```

### **Snapshots**
```bash
aidb snapshot create <name> "<description>"
aidb snapshot list <name>
aidb snapshot rollback <name> <snapshot-id>
```

---

## 💡 Pro Tips

1. **Always run `aidb schema <db>` first** - Lets AI understand your database
2. **Use `--dry-run` for destructive queries** - Test before executing
3. **Cache multiple databases** - Connect once, use forever
4. **Use TypeScript format** - Generate type definitions for your app
5. **Let AI analyze queries** - Use `aidb analyze` before running slow queries
6. **Create snapshots before schema changes** - Safety first!

---

## 🎓 Example Workflow

```bash
# 1. Connect to your database
aidb connect production --connection-string "mysql://user:pass@localhost:3306/myapp"

# 2. Let AI see the schema
aidb schema production > schema.json

# 3. Ask AI to write a complex query
# "Create a query to get top 10 users by post count with their latest comment"

# 4. AI generates query, you test it
aidb exec production "SELECT ..." --dry-run

# 5. Ask AI to optimize it
aidb analyze production "SELECT ..."

# 6. AI suggests indexes, you review
# AI: "Add index on posts(user_id, created_at)"

# 7. Create snapshot before changes
aidb snapshot create production "Before adding indexes"

# 8. Apply changes
aidb exec production "CREATE INDEX idx_posts_user_created ON posts(user_id, created_at)"

# 9. Test performance improvement
aidb exec production "SELECT ..." --explain
```

---

## 🚀 Ready to Go!

**Install now:**
```bash
npm install -g @yolovibecode/aidb
```

**Connect and start:**
```bash
aidb connect mydb --connection-string "your-connection-string"
aidb schema mydb
```

**Let AI know:**
> "I've installed AI Database Helper. Run `aidb schema mydb` to see my database structure."

**That's it! AI now understands your database!** 🎉

---

## 📖 More Resources

- **Full Documentation:** [README.md](README.md)
- **Architecture:** [architecture-checklist.md](architecture-checklist.md)
- **GitHub:** https://github.com/YOLOVibeCode/ai-db-helper
- **Issues:** https://github.com/YOLOVibeCode/ai-db-helper/issues

---

**Made with ❤️ for AI-powered development**
