# 🚀 AI Database Helper - Installation & Usage Guide

## ✅ **Package Successfully Published to NPM!**

**Package Name:** `@rvegajr/aidb`  
**Version:** 1.0.1  
**NPM Registry:** https://www.npmjs.com/package/@rvegajr/aidb  
**GitHub:** https://github.com/YOLOVibeCode/ai-db-helper

---

## 📦 **Installation**

### **Global Installation (Recommended for CLI Usage)**

```bash
npm install -g @rvegajr/aidb
```

### **Verify Installation**

```bash
aidb --version
# Output: 1.0.1

aidb --help
# Shows all available commands
```

### **Local Project Installation**

```bash
# For use as a library in your Node.js project
npm install @rvegajr/aidb
```

---

## 🎯 **Quick Start**

### **1. Connect to a Database**

```bash
# MySQL
aidb connect mydb --connection-string "mysql://user:password@localhost:3306/database"

# PostgreSQL
aidb connect analytics --connection-string "postgresql://user:password@localhost:5432/analytics"

# MSSQL
aidb connect logs --connection-string "mssql://sa:Password123@localhost:1433/logs"

# MongoDB
aidb connect realtime --connection-string "mongodb://localhost:27017/realtime"
```

### **2. List Connected Databases**

```bash
aidb list
```

### **3. View Database Schema**

```bash
# View complete schema
aidb schema mydb

# View as Markdown
aidb schema mydb --format markdown

# View as Mermaid ER diagram
aidb schema mydb --format mermaid > schema.mmd
```

### **4. Analyze Relationships**

```bash
# Show all relationships
aidb relationships mydb

# Show as Mermaid diagram
aidb relationships mydb --format mermaid

# Find join path between tables
aidb join-path mydb --from users --to orders
```

### **5. Execute Queries**

```bash
# Execute SQL query
aidb exec mydb "SELECT * FROM users LIMIT 10"

# With output formatting
aidb exec mydb "SELECT * FROM users" --format json

# Dry-run (validate without executing)
aidb exec mydb "UPDATE users SET status = 'active'" --dry-run
```

### **6. Refresh Schema Cache**

```bash
# Refresh schema from database
aidb refresh mydb
```

---

## 💡 **Use Cases**

### **For AI Assistants**

```bash
# Get AI-optimized schema information
aidb ai-info

# Export schema for AI context
aidb schema mydb --format json > schema.json
```

### **For Developers**

```bash
# Quick database exploration
aidb connect production --connection-string "..."
aidb relationships production --format mermaid

# Find optimal join paths
aidb join-path production --from users --to orders

# Execute queries safely
aidb exec production "SELECT COUNT(*) FROM users"
```

### **For Database Administrators**

```bash
# Analyze schema structure
aidb schema production --format markdown > db-docs.md

# Track schema changes
aidb refresh production
aidb diff production  # Shows what changed
```

---

## 📚 **Available Commands**

| Command | Description |
|---------|-------------|
| `aidb connect` | Connect to a database and cache its schema |
| `aidb list` | List all configured databases |
| `aidb schema` | Display database schema (JSON, Markdown, Mermaid, DDL) |
| `aidb relationships` | Display database relationships |
| `aidb exec` | Execute SQL query directly |
| `aidb refresh` | Refresh database schema cache |
| `aidb ai-info` | Show complete guide for AI assistants |

---

## 🔧 **Advanced Usage**

### **Using as a Library**

```typescript
import {
  SchemaCache,
  QueryExecutor,
  RelationshipAnalyzer,
  QueryPlanner,
  IndexAdvisor
} from '@rvegajr/aidb';

// Initialize components
const cache = new SchemaCache('/path/to/.aidb');
const executor = new QueryExecutor(adapter);
const planner = new QueryPlanner();
const advisor = new IndexAdvisor();

// Load schema
const schema = await cache.load('mydb');

// Analyze query performance
const plan = await planner.getExecutionPlan(
  'SELECT * FROM users WHERE email = ?',
  DatabaseType.MySQL
);

// Get index recommendations
const recommendations = await advisor.analyzeQuery(
  'SELECT * FROM users WHERE email = ?',
  schema
);
```

### **Multi-Database Management**

```bash
# Connect to multiple databases
aidb connect users-db --connection-string "mysql://..."
aidb connect orders-db --connection-string "postgresql://..."
aidb connect analytics --connection-string "mssql://..."

# View all schemas
aidb list

# AI can now see across all your databases!
```

---

## 🎉 **Features**

✅ **Multi-Database Support**
- MySQL, PostgreSQL, MSSQL, MongoDB, Oracle, DB2, Azure SQL

✅ **Relationship Intelligence**
- Automatic FK discovery
- Inferred relationship detection
- Join path optimization

✅ **Query Analysis** (NEW in v1.0.1!)
- EXPLAIN plan parsing
- Performance recommendations
- Index suggestions

✅ **Schema Management**
- Fast local caching
- Change detection
- Multiple output formats

✅ **Safety Features**
- Query validation
- Dry-run mode
- Encrypted credentials

---

## 📖 **Documentation**

- **Full Documentation:** [README.md](https://github.com/YOLOVibeCode/ai-db-helper/blob/main/README.md)
- **NPM Package:** https://www.npmjs.com/package/@rvegajr/aidb
- **GitHub Repository:** https://github.com/YOLOVibeCode/ai-db-helper
- **Issues:** https://github.com/YOLOVibeCode/ai-db-helper/issues

---

## 🤝 **Support**

Need help? Found a bug? Have a feature request?

- **GitHub Issues:** https://github.com/YOLOVibeCode/ai-db-helper/issues
- **GitHub Discussions:** https://github.com/YOLOVibeCode/ai-db-helper/discussions

---

## 📄 **License**

MIT License - See [LICENSE](https://github.com/YOLOVibeCode/ai-db-helper/blob/main/LICENSE)

---

## 🎊 **What's New in v1.0.1**

- ✨ **QueryPlanner** - EXPLAIN parsing and query optimization
- ✨ **IndexAdvisor** - Missing index detection and recommendations
- 🐛 Fixed MySQL getTableRowCount bug
- ⚡ Modernized build system for faster builds
- ✅ 100% test pass rate (95/95 tests)

---

**Enjoy using AI Database Helper! 🚀**

```bash
# Get started now!
npm install -g @rvegajr/aidb
aidb --help
```

