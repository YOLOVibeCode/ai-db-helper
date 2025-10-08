# AI Database Helper - Quick Start Guide

**Get AI-powered database intelligence in 30 seconds!**

---

## 🌟 Key Feature: Multi-Database Support

**Connect to ALL your databases simultaneously!**
- ✅ Main application database
- ✅ Analytics/reporting database
- ✅ Legacy systems
- ✅ Microservices databases
- ✅ MongoDB + SQL together

**AI gets complete visibility across your entire data ecosystem.**

---

## 🚀 Installation

```bash
# Option 1: Install globally (recommended)
npm install -g @yolovibecode/aidb

# Option 2: Use directly with npx (no install)
npx @yolovibecode/aidb --help
```

---

## ⚡ Quick Start (Connect Multiple Databases)

### **Step 1: Connect to Your Databases**

```bash
# Connect to your main database
aidb connect main_app --connection-string "mysql://user:pass@localhost:3306/app"

# Connect to your analytics database
aidb connect analytics --connection-string "postgresql://user:pass@localhost:5432/analytics"

# Connect to your logging/monitoring database
aidb connect logs --connection-string "mssql://sa:Pass@localhost:1433/logs"

# Connect to MongoDB for real-time data
aidb connect realtime --connection-string "mongodb://user:pass@localhost:27017/realtime"

# List all connected databases
aidb list
```

**Output:**
```
Connected Databases:
├─ main_app (mysql) - 23 tables
├─ analytics (postgresql) - 8 tables
├─ logs (mssql) - 5 tables
└─ realtime (mongodb) - 3 collections

Total: 4 databases cached locally
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

---

## 🌐 Multi-Database Scenarios

### **Scenario: Microservices Architecture**

**Your application uses 3 databases:**
```bash
# User service
aidb connect users "mysql://user:pass@users-db:3306/users"

# Order service
aidb connect orders "postgresql://user:pass@orders-db:5432/orders"

# Inventory service
aidb connect inventory "mysql://user:pass@inv-db:3306/inventory"
```

**Now ask AI:**
> "Create a report showing user orders with inventory status"

**AI Response:**
```
I see your data is across 3 databases. Here's the strategy:

1. Query users.users for user data
2. Query orders.orders for order information
3. Query inventory.stock for availability
4. Combine in application layer

Query 1 (users database):
SELECT id, email, name FROM users WHERE email = ?

Query 2 (orders database):
SELECT id, user_id, product_id, quantity
FROM orders WHERE user_id = ?

Query 3 (inventory database):
SELECT product_id, quantity_available
FROM stock WHERE product_id IN (?)

Application code to merge:
[JavaScript/TypeScript example provided]
```

### **Scenario: Main DB + Analytics**

```bash
aidb connect prod "mysql://app:pass@prod:3306/ecommerce"
aidb connect analytics "postgresql://analyst:pass@analytics:5432/warehouse"
```

**AI now knows:**
- Operational queries → Use `prod`
- Reports/analytics → Use `analytics`
- Which tables are in which database
- Schema differences between them

### **Scenario: Legacy + Modern Stack**

```bash
aidb connect legacy "oracle://user:pass@legacy:1521/ORCL"
aidb connect modern "postgresql://user:pass@modern:5432/app"
```

**Ask AI:** "Help me migrate data from legacy to modern"

**AI can:**
- Compare schemas
- Generate migration SQL
- Identify data type conversions
- Map old columns to new columns

**See complete guide:** [MULTI-DATABASE-GUIDE.md](MULTI-DATABASE-GUIDE.md)

---
