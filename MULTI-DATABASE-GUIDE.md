# Multi-Database Support - Complete Guide

**AI Database Helper supports connecting to MULTIPLE databases simultaneously with full visibility across all of them.**

---

## 🌐 Overview

### **Key Capability: Multi-Database Architecture**

Your application might use:
- 🗄️ **Main database** - Users, authentication, core data
- 📊 **Analytics database** - Reports, metrics, aggregations
- 📝 **Logging database** - Audit logs, activity tracking
- 🛒 **Legacy database** - Old system integration
- 🔄 **External API database** - Third-party data sync

**AI Database Helper caches ALL of them locally** and gives AI complete visibility across your entire data ecosystem.

---

## ⚡ Quick Start: Connect Multiple Databases

```bash
# Connect to your main application database
aidb connect main_app --connection-string "mysql://user:pass@localhost:3306/app_db"

# Connect to your analytics database
aidb connect analytics --connection-string "postgresql://user:pass@localhost:5432/analytics_db"

# Connect to your logging database
aidb connect logs --connection-string "mssql://sa:Pass@localhost:1433/logs_db"

# Connect to MongoDB for real-time data
aidb connect realtime --connection-string "mongodb://user:pass@localhost:27017/realtime_db"

# List all connected databases
aidb list
```

**Output:**
```
Connected Databases:
├─ main_app (mysql) - app_db - 47 tables
├─ analytics (postgresql) - analytics_db - 12 tables
├─ logs (mssql) - logs_db - 8 tables
└─ realtime (mongodb) - realtime_db - 5 collections

Total: 4 databases, 72 tables/collections cached
```

---

## 🎯 Multi-Database Scenarios

### **Scenario 1: Microservices Architecture**

**Your Setup:**
- `users_service` - User management (MySQL)
- `orders_service` - Order processing (PostgreSQL)
- `inventory_service` - Stock management (MySQL)
- `notifications_service` - Email/SMS queue (MongoDB)

**Connect All:**
```bash
aidb connect users --connection-string "mysql://user:pass@users-db:3306/users"
aidb connect orders --connection-string "postgresql://user:pass@orders-db:5432/orders"
aidb connect inventory --connection-string "mysql://user:pass@inventory-db:3306/inventory"
aidb connect notifications --connection-string "mongodb://user:pass@notif-db:27017/notifications"
```

**Now AI Knows:**
- Where user data lives (`users.users` table)
- Where order data lives (`orders.orders` table)
- How inventory is tracked (`inventory.stock` table)
- How notifications are queued (`notifications.queue` collection)

**Ask AI:**
> "Create a report that shows user orders with current inventory status"

**AI Response:**
```
I can see your data is split across three databases:

1. User data: users.users (MySQL)
2. Order data: orders.orders (PostgreSQL)
3. Inventory: inventory.stock (MySQL)

Since these are separate databases, I'll create three queries that you can join in your application:

Query 1 - Get users:
SELECT id, email, name FROM users.users WHERE id IN (...);

Query 2 - Get orders:
SELECT id, user_id, product_id, quantity, created_at
FROM orders.orders
WHERE user_id IN (...);

Query 3 - Get inventory:
SELECT product_id, quantity_available
FROM inventory.stock
WHERE product_id IN (...);

Application-level join pseudocode:
const users = await usersDb.query(query1);
const orders = await ordersDb.query(query2);
const inventory = await inventoryDb.query(query3);

const report = users.map(user => ({
  ...user,
  orders: orders.filter(o => o.user_id === user.id).map(order => ({
    ...order,
    inventory: inventory.find(i => i.product_id === order.product_id)
  }))
}));
```

---

### **Scenario 2: Main DB + Analytics Warehouse**

**Your Setup:**
- `production` - Live application data (MySQL)
- `warehouse` - Analytics/reporting (PostgreSQL with read replicas)

**Connect Both:**
```bash
aidb connect production --connection-string "mysql://app:pass@prod-db:3306/app"
aidb connect warehouse --connection-string "postgresql://analytics:pass@warehouse:5432/dw"
```

**Ask AI:**
> "Which tables in production are replicated to the warehouse?"

```bash
# AI compares both schemas
aidb schema production --format compact > prod_schema.json
aidb schema warehouse --format compact > warehouse_schema.json
```

**AI Response:**
```
Comparing schemas...

Tables in BOTH databases:
✓ users (production.users → warehouse.dim_users)
✓ orders (production.orders → warehouse.fact_orders)
✓ products (production.products → warehouse.dim_products)

Tables ONLY in production:
⚠️ sessions (real-time, not replicated)
⚠️ user_tokens (sensitive, not replicated)
⚠️ password_resets (temporary, not replicated)

Tables ONLY in warehouse:
📊 daily_sales_summary (aggregated)
📊 user_segments (calculated)
📊 product_performance (analytics)

Recommendation:
For operational queries → use production
For reporting/analytics → use warehouse
```

---

### **Scenario 3: Legacy + Modern Stack**

**Your Setup:**
- `legacy_app` - Old Oracle database (cannot modify)
- `new_app` - Modern PostgreSQL (active development)
- `integration` - SQL Server bridge database

**Connect All:**
```bash
aidb connect legacy --connection-string "oracle://user:pass@legacy:1521/ORCL"
aidb connect modern --connection-string "postgresql://user:pass@modern:5432/app"
aidb connect bridge --connection-string "mssql://sa:pass@bridge:1433/integration"
```

**Ask AI:**
> "I need to migrate customer data from legacy to modern. What's the schema difference?"

**AI Response:**
```
Schema Comparison: legacy.customers vs modern.customers

Column Mapping:
legacy.CUST_ID (NUMBER) → modern.customer_id (INTEGER)
legacy.CUST_NAME (VARCHAR2) → modern.full_name (VARCHAR)
legacy.EMAIL_ADDR (VARCHAR2) → modern.email (VARCHAR)
legacy.PHONE_NO (VARCHAR2) → modern.phone (VARCHAR)
legacy.CREATED (DATE) → modern.created_at (TIMESTAMP)

New columns in modern:
+ email_verified (BOOLEAN) - default false
+ updated_at (TIMESTAMP) - auto-updated
+ deleted_at (TIMESTAMP) - soft delete

Missing in modern:
- CUST_CATEGORY - Not migrated (deprecated)
- CREDIT_LIMIT - Moved to modern.customer_credits

Migration SQL:
INSERT INTO modern.customers (
  customer_id, full_name, email, phone, created_at
)
SELECT
  CUST_ID,
  CUST_NAME,
  EMAIL_ADDR,
  PHONE_NO,
  CAST(CREATED AS TIMESTAMP)
FROM legacy.customers
WHERE NOT EXISTS (
  SELECT 1 FROM modern.customers
  WHERE customer_id = legacy.customers.CUST_ID
);
```

---

### **Scenario 4: Multi-Tenant SaaS**

**Your Setup:**
- `master` - Tenant configuration and routing
- `tenant_001` - Company A's database
- `tenant_002` - Company B's database
- `tenant_003` - Company C's database

**Connect Master + Multiple Tenants:**
```bash
aidb connect master --connection-string "postgresql://admin:pass@master:5432/master"
aidb connect tenant_001 --connection-string "postgresql://user:pass@shard1:5432/tenant_001"
aidb connect tenant_002 --connection-string "postgresql://user:pass@shard1:5432/tenant_002"
aidb connect tenant_003 --connection-string "postgresql://user:pass@shard2:5432/tenant_003"
```

**Ask AI:**
> "Create a cross-tenant analytics query to find top features used"

**AI Response:**
```
I can see you have a multi-tenant setup with consistent schema across tenants.

Schema per tenant:
- users (id, email, company_id, created_at)
- features (id, name, category)
- feature_usage (id, user_id, feature_id, used_at)

Cross-tenant aggregation query (run on each tenant):

-- Query template for each tenant
SELECT
  :tenant_id as tenant_id,
  f.name as feature_name,
  f.category,
  COUNT(DISTINCT fu.user_id) as unique_users,
  COUNT(*) as total_uses
FROM feature_usage fu
JOIN features f ON fu.feature_id = f.id
WHERE fu.used_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY f.id, f.name, f.category
ORDER BY unique_users DESC
LIMIT 10;

Application code to aggregate:
const results = await Promise.all([
  tenant001Db.query(query, ['tenant_001']),
  tenant002Db.query(query, ['tenant_002']),
  tenant003Db.query(query, ['tenant_003'])
]);

const combined = results.flat().reduce((acc, row) => {
  const key = row.feature_name;
  if (!acc[key]) {
    acc[key] = { ...row, unique_users: 0, total_uses: 0 };
  }
  acc[key].unique_users += row.unique_users;
  acc[key].total_uses += row.total_uses;
  return acc;
}, {});
```

---

## 🔍 AI Understanding Across Databases

### **AI Can Now:**

**1. Compare Schemas**
```bash
# AI compares table structures across databases
aidb schema db1 --table users > users_db1.json
aidb schema db2 --table users > users_db2.json
```

**2. Find Data Relationships**
Even across databases:
- User ID in `main_app.users`
- Referenced in `analytics.user_metrics`
- Also in `logs.user_activities`

**3. Recommend Query Strategy**
```
AI: "This query needs data from 3 databases:
1. User details from main_app
2. Purchase history from orders_db
3. Behavior analytics from analytics_db

I'll create 3 optimized queries you can combine in your application layer."
```

**4. Detect Schema Drift**
```
AI: "Warning: The 'users' table exists in both db1 and db2 but has different columns:
- db1.users has 'email_verified' (BOOLEAN)
- db2.users missing 'email_verified'
This might cause sync issues."
```

**5. Generate Federation Queries**
For databases that support cross-database queries (MySQL, PostgreSQL with foreign data wrappers):
```sql
-- AI knows this is possible in MySQL
SELECT
  u.name,
  COUNT(o.id) as order_count
FROM main_app.users u
LEFT JOIN orders_db.orders o ON u.id = o.user_id
GROUP BY u.id;
```

---

## 📊 Example: Real Application

### **Setup: E-commerce with 4 Databases**

```bash
# Production MySQL - core app
aidb connect prod "mysql://app:pass@prod:3306/ecommerce"

# PostgreSQL - analytics
aidb connect analytics "postgresql://analyst:pass@analytics:5432/warehouse"

# MongoDB - user sessions
aidb connect sessions "mongodb://app:pass@mongo:27017/sessions"

# MSSQL - legacy inventory
aidb connect inventory "mssql://sa:Pass@legacy:1433/inventory"
```

### **Check What's Connected**
```bash
aidb list
```

**Output:**
```
Connected Databases:
├─ prod (mysql) - ecommerce - 23 tables
│  └─ Tables: users, orders, products, cart_items, payments, ...
│
├─ analytics (postgresql) - warehouse - 8 tables
│  └─ Tables: daily_sales, user_segments, product_performance, ...
│
├─ sessions (mongodb) - sessions - 2 collections
│  └─ Collections: active_sessions, session_history
│
└─ inventory (mssql) - inventory - 5 tables
   └─ Tables: stock, warehouses, suppliers, shipments, ...

Total: 4 databases, 38 tables/collections cached
Cache size: 2.3 MB
Last updated: 2 minutes ago
```

### **AI Conversation**

**You:** "How is our data distributed?"

**AI runs:**
```bash
aidb schema prod
aidb schema analytics
aidb schema sessions
aidb schema inventory
```

**AI answers:**
```
Your e-commerce data is distributed across 4 databases:

PROD (MySQL) - Core Application:
├─ users (auth, profiles)
├─ orders (order management)
├─ products (catalog)
├─ payments (transactions)
└─ cart_items (shopping cart)

ANALYTICS (PostgreSQL) - Reporting:
├─ daily_sales (aggregated sales)
├─ user_segments (marketing)
└─ product_performance (metrics)

SESSIONS (MongoDB) - Real-time:
├─ active_sessions (current users)
└─ session_history (activity log)

INVENTORY (SQL Server) - Legacy:
├─ stock (current inventory)
├─ warehouses (locations)
└─ shipments (tracking)
```

**You:** "Create a query to get order details with current inventory"

**AI generates:**
```sql
-- Step 1: Get order from prod
SELECT
  o.id as order_id,
  o.user_id,
  o.status,
  oi.product_id,
  oi.quantity as ordered_quantity,
  p.name as product_name
FROM prod.orders o
JOIN prod.order_items oi ON o.id = oi.order_id
JOIN prod.products p ON oi.product_id = p.id
WHERE o.id = ?;

-- Step 2: Check inventory in legacy system
SELECT
  product_id,
  quantity_available,
  warehouse_id,
  last_updated
FROM inventory.stock
WHERE product_id IN (?);

-- Application layer:
const orderDetails = await prodDb.query(query1, [orderId]);
const productIds = orderDetails.map(item => item.product_id);
const inventoryData = await inventoryDb.query(query2, [productIds]);

const result = orderDetails.map(item => ({
  ...item,
  inventory: inventoryData.find(inv => inv.product_id === item.product_id)
}));
```

---

## 🎯 Commands for Multi-Database

### **List All Databases**
```bash
aidb list
# Shows all connected databases with stats
```

### **Compare Schemas**
```bash
aidb schema db1 --table users --format json > db1_users.json
aidb schema db2 --table users --format json > db2_users.json
diff db1_users.json db2_users.json
```

### **View Specific Database**
```bash
aidb schema prod          # Production database
aidb schema analytics     # Analytics database
aidb relationships prod   # Relationships in prod
```

### **Execute on Specific Database**
```bash
aidb exec prod "SELECT * FROM users WHERE id = 1"
aidb exec analytics "SELECT * FROM daily_sales WHERE date = CURRENT_DATE"
aidb exec sessions '{"collection": "active_sessions", "operation": "find"}'
```

### **Analyze Across Databases**
```bash
aidb analyze prod "SELECT * FROM users"
aidb analyze analytics "SELECT * FROM daily_sales"
# AI can compare performance characteristics
```

### **Refresh All**
```bash
# Refresh specific database
aidb refresh prod

# Refresh all (not implemented yet, but could be)
aidb list | grep "├─" | awk '{print $2}' | xargs -I {} aidb refresh {}
```

---

## 🤖 AI Multi-Database Intelligence

### **What AI Understands**

When you tell AI:
> "I have multiple databases connected. Check them with: `aidb list`"

**AI knows:**
1. **Data Location** - Where each piece of data lives
2. **Schema Differences** - How tables differ across databases
3. **Query Strategy** - Whether to use joins or application-level merging
4. **Performance** - Which database to query for what
5. **Relationships** - Even across database boundaries
6. **Federation** - When cross-database queries are possible

### **AI Can Recommend**

**Data Access Patterns:**
```
AI: "For user profile → query prod
     For user analytics → query analytics
     For user session → query sessions
     Combine in application layer"
```

**Schema Synchronization:**
```
AI: "The 'users' table in prod has 'last_login' but analytics doesn't.
     Analytics query will fail if you try to filter by last_login.
     Consider syncing this field or querying prod first."
```

**Query Optimization:**
```
AI: "You're joining users (prod) with orders (prod) - use single query
     But orders (prod) with metrics (analytics) - use two queries
     MySQL can't cross-database join to PostgreSQL"
```

---

## 🔧 Advanced: Database Groups

You can mentally group databases:

```bash
# Production stack
aidb connect prod_app "mysql://..."
aidb connect prod_analytics "postgresql://..."
aidb connect prod_cache "mongodb://..."

# Staging stack
aidb connect stage_app "mysql://..."
aidb connect stage_analytics "postgresql://..."

# Development stack
aidb connect dev_local "mysql://..."
```

Now AI knows:
- What's in production vs staging vs dev
- Schema differences between environments
- How to generate queries for each environment

---

## 📚 Best Practices

### **1. Clear Naming**
```bash
# Good
aidb connect prod_users "..."
aidb connect prod_orders "..."
aidb connect analytics_warehouse "..."

# Bad
aidb connect db1 "..."
aidb connect db2 "..."
aidb connect db3 "..."
```

### **2. Document Relationships**
Tell AI about cross-database relationships:
```
"The user_id in prod.orders references prod.users.id
 The same user_id in analytics.user_metrics also references prod.users.id
 And sessions.active_sessions uses user_id too"
```

### **3. Keep Schemas in Sync**
```bash
# After schema changes
aidb refresh prod
aidb refresh analytics
```

### **4. Use Meaningful Contexts**
```
"Our microservices use:
- users_service: auth and profiles
- orders_service: order processing
- inventory_service: stock management
Each has its own database"
```

---

## 🚀 Summary

**Multi-Database Support Highlights:**
- ✅ Connect to unlimited databases simultaneously
- ✅ Mix database types (MySQL, PostgreSQL, MSSQL, MongoDB, Oracle)
- ✅ AI has complete visibility across all databases
- ✅ Compare schemas between databases
- ✅ Generate cross-database queries
- ✅ Understand data distribution
- ✅ Detect schema drift
- ✅ Recommend optimal query strategies

**Your AI assistant now understands your ENTIRE data ecosystem!** 🎉

---

**Next:** [QUICK-START.md](QUICK-START.md) | [AI-USAGE-GUIDE.md](AI-USAGE-GUIDE.md)
