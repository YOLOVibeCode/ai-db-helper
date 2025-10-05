# AI Database Helper - Guide for AI Assistants

**This document is for AI assistants (Claude, ChatGPT, etc.) to understand how to use AI Database Helper effectively.**

---

## 🎯 Purpose

AI Database Helper caches database schemas locally, allowing you (the AI) to:
- ✅ Understand database structure WITHOUT querying the database
- ✅ Generate complex SQL queries with correct JOINs
- ✅ Recommend indexes and optimizations
- ✅ Create stored procedures with proper relationships
- ✅ Understand multiplicity (1:1, 1:N, N:N)
- ✅ Find optimal join paths between tables

---

## 🚀 Quick Reference

### **When User Says:** "Connect to my database"
```bash
aidb connect <name> --connection-string "<connection-string>"
```

### **When User Says:** "Show me my schema"
```bash
aidb schema <name> --format compact
```

### **When User Says:** "How do I join X to Y?"
```bash
aidb relationships <name>
```

### **When User Says:** "Why is my query slow?"
```bash
aidb analyze <name> "<sql-query>"
```

---

## 📊 Understanding the Schema Output

### **Compact Format (AI-Optimized)**

```json
{
  "db": "mydb",
  "type": "mysql",
  "tables": [
    {
      "n": "users",
      "cols": [
        {"n": "id", "t": "INT", "pk": true, "ai": true},
        {"n": "email", "t": "VARCHAR", "null": false, "uniq": true},
        {"n": "name", "t": "VARCHAR", "null": false}
      ],
      "idx": [
        {"n": "PRIMARY", "cols": ["id"], "uniq": true},
        {"n": "idx_email", "cols": ["email"]}
      ],
      "fks": [
        {"col": "user_id", "ref_table": "profiles", "ref_col": "id"}
      ]
    }
  ]
}
```

**Field Meanings:**
- `n` = name
- `t` = type
- `pk` = primary key
- `ai` = auto increment
- `null` = nullable
- `uniq` = unique
- `idx` = indexes
- `fks` = foreign keys
- `cols` = columns
- `ref_table` = referenced table
- `ref_col` = referenced column

### **Relationship Format**

```json
{
  "relationships": [
    {
      "from_table": "posts",
      "to_table": "users",
      "from_column": "user_id",
      "to_column": "id",
      "type": "explicit",
      "multiplicity": "N:1",
      "confidence": 1.0,
      "onDelete": "CASCADE"
    }
  ]
}
```

**Multiplicity Meanings:**
- `1:1` - One-to-One (user ↔ profile)
- `1:N` - One-to-Many (user → posts)
- `N:1` - Many-to-One (posts → user)
- `N:N` - Many-to-Many (posts ↔ tags via junction)

---

## 🤖 AI Decision Tree

### **Step 1: Get Context**

```bash
# Always start here
aidb schema <db> --format compact
aidb relationships <db> --include-inferred
```

This gives you:
- All tables and columns
- All relationships
- Primary/foreign keys
- Indexes

### **Step 2: Analyze User Request**

**If user asks for a query:**
1. Identify which tables are needed
2. Check relationships to determine join path
3. Generate SQL with proper JOINs
4. Consider indexes for WHERE/ORDER BY clauses

**If user asks about relationships:**
1. Look up relationship in cached data
2. Explain multiplicity
3. Show join path if multiple hops needed

**If user asks about performance:**
1. Use `aidb analyze` to check query plan
2. Recommend indexes based on analysis
3. Suggest query rewrites if needed

**If user asks to create procedure:**
1. Check schema for all involved tables
2. Verify relationships
3. Generate procedure with proper joins
4. Include error handling

---

## 💡 Example Scenarios

### **Scenario 1: Generate Complex Query**

**User:** "Get all users with their posts and comments"

**Your Process:**
1. Run: `aidb relationships mydb`
2. Identify path: `users → posts → comments`
3. Check multiplicity: 1:N for both
4. Generate SQL:

```sql
SELECT
  u.id,
  u.name,
  u.email,
  p.id as post_id,
  p.title,
  c.id as comment_id,
  c.content
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON p.id = c.post_id
ORDER BY u.id, p.id, c.id;
```

### **Scenario 2: Understand Relationship**

**User:** "Is the relationship between users and profiles 1:1?"

**Your Process:**
1. Run: `aidb relationships mydb --table users --related profiles`
2. Check multiplicity field
3. Look for UNIQUE constraint on foreign key
4. Response:

```
Yes, users and profiles have a 1:1 relationship.

Evidence:
- profiles.user_id is a foreign key to users.id
- profiles.user_id has a UNIQUE constraint
- This means each user can have only one profile

SQL to get user with profile:
SELECT u.*, p.*
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.id = ?
```

### **Scenario 3: Optimize Query**

**User:** "This query is slow: SELECT * FROM posts WHERE user_id = 1 AND published = 1"

**Your Process:**
1. Run: `aidb analyze mydb "SELECT * FROM posts WHERE user_id = 1 AND published = 1"`
2. Check output for recommendations
3. Response:

```
Query Analysis:
⚠️  Missing composite index detected

Current indexes on posts:
- PRIMARY (id)
- idx_user_id (user_id)

Recommendation:
CREATE INDEX idx_posts_user_published ON posts(user_id, published);

Why:
- Current index on user_id helps but requires scanning all user's posts
- Composite index allows filtering both columns efficiently
- Estimated improvement: 85%
- Disk space: ~2.5 MB

Alternative (if mostly published posts):
CREATE INDEX idx_posts_published_user ON posts(published, user_id);
Use this if published = 1 is highly selective
```

### **Scenario 4: Create Stored Procedure**

**User:** "Create a procedure to get user activity summary"

**Your Process:**
1. Run: `aidb schema mydb` to see available tables
2. Run: `aidb relationships mydb` to understand connections
3. Generate procedure:

```sql
DELIMITER //

CREATE PROCEDURE GetUserActivitySummary(
  IN user_email VARCHAR(255)
)
BEGIN
  -- Get user with activity counts
  SELECT
    u.id,
    u.name,
    u.email,
    u.created_at as member_since,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT c.id) as total_comments,
    MAX(p.created_at) as last_post_date,
    MAX(c.created_at) as last_comment_date,
    (
      SELECT COUNT(*)
      FROM posts p2
      WHERE p2.user_id = u.id
      AND p2.published = 1
    ) as published_posts
  FROM users u
  LEFT JOIN posts p ON u.id = p.user_id
  LEFT JOIN comments c ON u.id = c.user_id
  WHERE u.email = user_email
  GROUP BY u.id, u.name, u.email, u.created_at;
END //

DELIMITER ;

-- Test it
CALL GetUserActivitySummary('alice@example.com');
```

4. Suggest testing: `aidb exec mydb "CALL GetUserActivitySummary('test@example.com')" --dry-run`

### **Scenario 5: Many-to-Many Relationship**

**User:** "How do I get all posts with their tags?"

**Your Process:**
1. Run: `aidb relationships mydb`
2. Identify N:N relationship via junction table
3. Response:

```
Posts and tags have a many-to-many (N:N) relationship through the post_tags junction table.

Structure:
- posts.id ← post_tags.post_id → tags.id

To get posts with tags:

Option 1: With tag names concatenated
SELECT
  p.id,
  p.title,
  GROUP_CONCAT(t.name) as tags
FROM posts p
LEFT JOIN post_tags pt ON p.id = pt.post_id
LEFT JOIN tags t ON pt.tag_id = t.id
GROUP BY p.id, p.title;

Option 2: Separate rows per tag
SELECT
  p.id,
  p.title,
  t.id as tag_id,
  t.name as tag_name
FROM posts p
LEFT JOIN post_tags pt ON p.id = pt.post_id
LEFT JOIN tags t ON pt.tag_id = t.id
ORDER BY p.id;

Option 3: As JSON array (MySQL 5.7+)
SELECT
  p.id,
  p.title,
  JSON_ARRAYAGG(
    JSON_OBJECT('id', t.id, 'name', t.name)
  ) as tags
FROM posts p
LEFT JOIN post_tags pt ON p.id = pt.post_id
LEFT JOIN tags t ON pt.tag_id = t.id
GROUP BY p.id, p.title;
```

---

## 🎯 Best Practices for AI

### **1. Always Check Schema First**
```bash
aidb schema <db> --format compact
```
Don't guess table/column names. Always verify.

### **2. Understand Relationships Before Joining**
```bash
aidb relationships <db>
```
Use the relationship data to generate correct JOINs.

### **3. Consider Index Recommendations**
When generating queries with WHERE/ORDER BY:
```bash
aidb analyze <db> "<your-generated-query>"
```
Suggest indexes if missing.

### **4. Use Safe Execution**
For destructive operations:
```bash
aidb exec <db> "<query>" --dry-run
```
Show user the dry-run results before actual execution.

### **5. Explain Your Reasoning**
When generating SQL, explain:
- Which tables you're joining
- Why you chose that join path
- What indexes would help
- Any assumptions you made

---

## 🔍 Database-Specific Considerations

### **MySQL**
- Use `LIMIT` for large result sets
- `GROUP_CONCAT` for concatenating values
- `AUTO_INCREMENT` for generated keys
- `ENUM` and `SET` types exist

### **PostgreSQL**
- Use `LIMIT` and `OFFSET` for pagination
- `SERIAL` for auto-increment
- Rich type system (arrays, JSON, etc.)
- `STRING_AGG` for concatenation

### **Microsoft SQL Server**
- Use `TOP` instead of `LIMIT`
- `IDENTITY` for auto-increment
- `STRING_AGG` or `FOR XML PATH` for concatenation
- Different datetime types (DATETIME2 preferred)

### **MongoDB**
- No JOINs (use aggregation pipeline with `$lookup`)
- Flexible schema (check field frequency)
- Arrays and nested documents common
- No foreign key constraints

---

## 🚨 Common Pitfalls to Avoid

### **❌ DON'T: Guess table names**
```sql
-- Bad: Guessing
SELECT * FROM user WHERE id = 1

-- Good: Check schema first
aidb schema <db>
-- Then use correct name: users (plural)
SELECT * FROM users WHERE id = 1
```

### **❌ DON'T: Assume join columns**
```sql
-- Bad: Assuming
SELECT * FROM posts p
JOIN users u ON p.user = u.user_id

-- Good: Check relationships
aidb relationships <db>
-- Then use correct columns: posts.user_id = users.id
SELECT * FROM posts p
JOIN users u ON p.user_id = u.id
```

### **❌ DON'T: Ignore multiplicity**
```sql
-- Bad: Wrong aggregation for 1:1
SELECT u.*, COUNT(p.id) as profile_count
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
GROUP BY u.id

-- Good: Understand it's 1:1
SELECT u.*, p.*
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
-- No GROUP BY needed for 1:1
```

### **❌ DON'T: Generate queries without checking indexes**
```sql
-- Bad: Slow query on large table
SELECT * FROM posts WHERE published = 1 AND user_id = 123

-- Good: Check and recommend index
aidb analyze <db> "SELECT * FROM posts WHERE published = 1 AND user_id = 123"
-- Recommend: CREATE INDEX idx_posts_published_user ON posts(published, user_id)
```

---

## 📝 Response Templates

### **Template: Generate Query**
```
Based on your schema, here's the query:

[SQL QUERY]

Explanation:
- Tables involved: X, Y, Z
- Join path: X → Y → Z
- Relationship types: 1:N, N:1
- Indexes used: idx_x, idx_y

Performance notes:
- [Index recommendation if needed]
- [Optimization suggestion if applicable]

Test it safely:
aidb exec <db> "[QUERY]" --dry-run
```

### **Template: Explain Relationship**
```
[Table A] and [Table B] have a [MULTIPLICITY] relationship.

Details:
- Type: [explicit/inferred]
- Confidence: [percentage]
- Foreign key: [table.column] → [table.column]
- On Delete: [CASCADE/SET NULL/RESTRICT]

What this means:
- [Practical explanation]

Example query:
[SQL EXAMPLE]
```

### **Template: Optimize Query**
```
Query Analysis:
Current performance: [description]
Estimated cost: [number]

Issues found:
1. [Issue 1]
2. [Issue 2]

Recommendations:
1. [Recommendation 1]
   - Impact: [percentage]
   - Trade-off: [description]

2. [Recommendation 2]
   - Impact: [percentage]
   - Trade-off: [description]

Optimized query:
[IMPROVED SQL]

To implement recommendations:
aidb exec <db> "[DDL]" --dry-run
```

---

## 🎓 Learning from Examples

### **Example 1: Blog System**

**Schema:**
- users (id, email, name)
- posts (id, user_id, title, content)
- comments (id, post_id, user_id, content)
- tags (id, name)
- post_tags (post_id, tag_id)

**Common Queries to Generate:**

1. "Get all posts by user with email"
```sql
SELECT p.*
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE u.email = ?
```

2. "Get post with comments and author names"
```sql
SELECT
  p.title,
  p.content,
  u.name as author,
  c.content as comment,
  cu.name as commenter
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN comments c ON p.id = c.post_id
LEFT JOIN users cu ON c.user_id = cu.id
WHERE p.id = ?
```

3. "Get popular tags (most posts)"
```sql
SELECT
  t.name,
  COUNT(pt.post_id) as post_count
FROM tags t
JOIN post_tags pt ON t.id = pt.tag_id
GROUP BY t.id, t.name
ORDER BY post_count DESC
LIMIT 10
```

---

## 🚀 Ready to Help Users!

**Remember:**
1. Always check schema first
2. Verify relationships before joining
3. Consider performance implications
4. Explain your reasoning
5. Use safe execution for destructive operations

**You now have the knowledge to generate perfect SQL queries with proper JOINs, understand database relationships, and optimize query performance!**

---

**For more details, see:** [QUICK-START.md](QUICK-START.md)
