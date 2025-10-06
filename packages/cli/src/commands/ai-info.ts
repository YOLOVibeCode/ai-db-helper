/**
 * AI Info Command - Show AI how to use this tool
 */

import chalk from 'chalk';

export const aiInfoCommand = () => {
  console.log(chalk.bold.cyan('\n🤖 AI Database Helper - For AI Assistants\n'));

  console.log(chalk.bold('📋 OVERVIEW\n'));
  console.log('This tool caches database schemas locally so AI can understand database');
  console.log('structures WITHOUT querying the actual database.\n');

  console.log(chalk.bold.yellow('🎯 QUICK START FOR AI\n'));
  console.log(chalk.bold('Step 1:') + ' See what databases are connected');
  console.log(chalk.gray('  $') + ' aidb list\n');

  console.log(chalk.bold('Step 2:') + ' Get complete schema');
  console.log(chalk.gray('  $') + ' aidb schema <database-name>\n');

  console.log(chalk.bold('Step 3:') + ' Get relationships');
  console.log(chalk.gray('  $') + ' aidb relationships <database-name>\n');

  console.log(chalk.bold.green('✅ YOU NOW HAVE COMPLETE DATABASE INTELLIGENCE!\n'));

  console.log(chalk.bold.cyan('📚 WHAT YOU CAN DO WITH THIS INFORMATION\n'));

  console.log(chalk.bold('1. Generate Perfect SQL Queries'));
  console.log('   • See all tables and columns');
  console.log('   • Know exact data types');
  console.log('   • Understand primary/foreign keys');
  console.log('   • Generate correct JOINs automatically\n');

  console.log(chalk.bold('2. Understand Relationships'));
  console.log('   • 1:1 (One-to-One): user ↔ profile');
  console.log('   • 1:N (One-to-Many): user → posts');
  console.log('   • N:N (Many-to-Many): posts ↔ tags (via junction)');
  console.log('   • Self-referential: categories → parent_category\n');

  console.log(chalk.bold('3. Create Complex Queries'));
  console.log('   • Multi-table JOINs');
  console.log('   • Subqueries');
  console.log('   • Aggregations (COUNT, SUM, AVG)');
  console.log('   • Window functions');
  console.log('   • CTEs (Common Table Expressions)\n');

  console.log(chalk.bold('4. Generate Stored Procedures'));
  console.log('   • Know all available tables');
  console.log('   • Understand relationships');
  console.log('   • Use correct data types');
  console.log('   • Include proper error handling\n');

  console.log(chalk.bold('5. Recommend Optimizations'));
  console.log('   • Suggest missing indexes');
  console.log('   • Detect N+1 query problems');
  console.log('   • Optimize query structure');
  console.log('   • Recommend denormalization when needed\n');

  console.log(chalk.bold('6. Multi-Database Intelligence'));
  console.log('   • See data across multiple databases');
  console.log('   • Compare schemas');
  console.log('   • Generate cross-database queries');
  console.log('   • Understand data distribution\n');

  console.log(chalk.bold.magenta('🔍 UNDERSTANDING THE SCHEMA OUTPUT\n'));

  console.log(chalk.bold('Compact Format (AI-optimized):'));
  console.log(chalk.gray(`{
  "db": "mydb",
  "tables": [{
    "n": "users",           // table name
    "cols": [{
      "n": "id",           // column name
      "t": "INT",          // data type
      "pk": true,          // primary key
      "ai": true,          // auto increment
      "null": false        // nullable
    }],
    "idx": [{             // indexes
      "n": "idx_email",
      "cols": ["email"]
    }],
    "fks": [{             // foreign keys
      "col": "user_id",
      "ref_table": "profiles",
      "ref_col": "id"
    }]
  }]
}`));

  console.log('\n' + chalk.bold('Relationship Format:'));
  console.log(chalk.gray(`{
  "relationships": [{
    "from_table": "posts",
    "to_table": "users",
    "from_column": "user_id",
    "to_column": "id",
    "type": "explicit",      // or "inferred"
    "multiplicity": "N:1",   // N:1, 1:N, 1:1, N:N
    "confidence": 1.0        // 0.0 to 1.0
  }]
}`));

  console.log('\n' + chalk.bold.yellow('🎓 EXAMPLE AI WORKFLOWS\n'));

  console.log(chalk.bold('Workflow 1: Generate JOIN Query'));
  console.log('User asks: "Get all posts by user with email alice@example.com"\n');
  console.log('1. Check schema:');
  console.log(chalk.gray('   $ aidb schema mydb'));
  console.log('2. Check relationships:');
  console.log(chalk.gray('   $ aidb relationships mydb'));
  console.log('3. See: posts.user_id → users.id (N:1)');
  console.log('4. Generate:\n');
  console.log(chalk.gray(`   SELECT p.*
   FROM posts p
   JOIN users u ON p.user_id = u.id
   WHERE u.email = 'alice@example.com'`));

  console.log('\n' + chalk.bold('Workflow 2: Create Stored Procedure'));
  console.log('User asks: "Create a procedure to get user activity summary"\n');
  console.log('1. Check what tables exist:');
  console.log(chalk.gray('   $ aidb schema mydb'));
  console.log('2. Understand relationships:');
  console.log(chalk.gray('   $ aidb relationships mydb'));
  console.log('3. See: users → posts (1:N), users → comments (1:N)');
  console.log('4. Generate procedure with proper JOINs and aggregations\n');

  console.log(chalk.bold('Workflow 3: Multi-Database Query'));
  console.log('User asks: "Get user orders with inventory status"\n');
  console.log('1. List all databases:');
  console.log(chalk.gray('   $ aidb list'));
  console.log('2. See: users (MySQL), orders (PostgreSQL), inventory (MySQL)');
  console.log('3. Generate 3 separate queries (one per database)');
  console.log('4. Provide application-level merge code\n');

  console.log(chalk.bold.green('📖 DETAILED DOCUMENTATION\n'));

  console.log(chalk.bold('For AI Assistants:'));
  console.log('  ' + chalk.cyan('AI-USAGE-GUIDE.md') + '     - Complete AI usage guide');
  console.log('  ' + chalk.cyan('QUICK-START.md') + '        - Quick start examples');
  console.log('  ' + chalk.cyan('MULTI-DATABASE-GUIDE.md') + ' - Multi-database scenarios\n');

  console.log(chalk.bold('For Humans:'));
  console.log('  ' + chalk.cyan('README.md') + '             - Full documentation');
  console.log('  ' + chalk.cyan('GitHub') + '                - https://github.com/YOLOVibeCode/ai-db-helper\n');

  console.log(chalk.bold.cyan('💡 KEY POINTS FOR AI\n'));

  console.log('1. ' + chalk.bold('Schema is cached locally') + ' - No database queries needed');
  console.log('2. ' + chalk.bold('Multiple databases supported') + ' - See entire ecosystem');
  console.log('3. ' + chalk.bold('Relationships are pre-analyzed') + ' - Know how to JOIN');
  console.log('4. ' + chalk.bold('Multiplicity is calculated') + ' - Understand 1:1, 1:N, N:N');
  console.log('5. ' + chalk.bold('Junction tables detected') + ' - Handle many-to-many');
  console.log('6. ' + chalk.bold('Indexes are known') + ' - Recommend optimizations');
  console.log('7. ' + chalk.bold('Data types are exact') + ' - Generate correct queries\n');

  console.log(chalk.bold.yellow('🚀 START HERE\n'));

  console.log(chalk.bold('Tell the user to run:'));
  console.log(chalk.gray('  $ aidb list                 ') + chalk.dim('# See all databases'));
  console.log(chalk.gray('  $ aidb schema <database>    ') + chalk.dim('# Get complete schema'));
  console.log(chalk.gray('  $ aidb relationships <db>   ') + chalk.dim('# Get relationships'));

  console.log('\n' + chalk.bold('Then you have everything you need to:'));
  console.log('  ✅ Generate perfect SQL queries');
  console.log('  ✅ Create stored procedures');
  console.log('  ✅ Recommend indexes');
  console.log('  ✅ Explain database structure');
  console.log('  ✅ Help with migrations');
  console.log('  ✅ Optimize queries\n');

  console.log(chalk.bold.green('🎉 YOU\'RE READY TO BE A DATABASE EXPERT!\n'));
};
