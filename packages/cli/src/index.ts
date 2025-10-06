#!/usr/bin/env node

/**
 * AI Database Helper - CLI Entry Point
 *
 * The happiest CLI for database schema intelligence!
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { connectCommand } from './commands/connect';
import { schemaCommand } from './commands/schema';
import { listCommand } from './commands/list';
import { refreshCommand } from './commands/refresh';
import { relationshipsCommand } from './commands/relationships';
import { execCommand } from './commands/exec';
import { aiInfoCommand } from './commands/ai-info';

const program = new Command();

program
  .name('aidb')
  .description('🚀 AI Database Helper - Database schema intelligence for AI')
  .version('1.0.0')
  .addHelpText('afterAll', `

${chalk.bold.cyan('📚 QUICK EXAMPLES')}

  ${chalk.bold('Connect to databases:')}
  ${chalk.gray('$')} aidb connect mydb --connection-string "mysql://user:pass@host:3306/db"
  ${chalk.gray('$')} aidb connect analytics --connection-string "postgresql://..."
  ${chalk.gray('$')} aidb connect logs --connection-string "mssql://sa:Pass@host:1433/logs"
  ${chalk.gray('$')} aidb connect realtime --connection-string "mongodb://..."

  ${chalk.bold('View schemas:')}
  ${chalk.gray('$')} aidb list                    ${chalk.dim('# List all databases')}
  ${chalk.gray('$')} aidb schema mydb             ${chalk.dim('# View complete schema')}
  ${chalk.gray('$')} aidb schema mydb --table users  ${chalk.dim('# View specific table')}
  ${chalk.gray('$')} aidb relationships mydb      ${chalk.dim('# See relationships')}

  ${chalk.bold('Execute queries:')}
  ${chalk.gray('$')} aidb exec mydb "SELECT * FROM users WHERE id = 1"
  ${chalk.gray('$')} aidb exec mydb "UPDATE users SET name = 'Test' WHERE id = 1" --confirm
  ${chalk.gray('$')} aidb exec mydb "DELETE FROM logs WHERE date < '2020-01-01'" --dry-run

  ${chalk.bold('Multi-database workflow:')}
  ${chalk.gray('$')} aidb connect prod "mysql://..."
  ${chalk.gray('$')} aidb connect analytics "postgresql://..."
  ${chalk.gray('$')} aidb list                    ${chalk.dim('# See both databases')}
  ${chalk.gray('$')} aidb schema prod            ${chalk.dim('# Check prod schema')}
  ${chalk.gray('$')} aidb schema analytics       ${chalk.dim('# Check analytics schema')}

${chalk.bold.yellow('🤖 FOR AI ASSISTANTS (Claude, ChatGPT, etc.)')}

  ${chalk.bold('Tell your AI:')}
  ${chalk.green('>')} "I have AI Database Helper installed. To understand my database, run:"
  ${chalk.green('>')} "  aidb list                  ${chalk.dim('# See all databases')}"
  ${chalk.green('>')} "  aidb schema <db>           ${chalk.dim('# Get complete schema')}"
  ${chalk.green('>')} "  aidb relationships <db>    ${chalk.dim('# Get relationships')}"

  ${chalk.bold('What AI can do:')}
  ✅ Generate complex SQL queries with correct JOINs
  ✅ Create stored procedures with proper relationships
  ✅ Recommend indexes and optimizations
  ✅ Understand 1:1, 1:N, N:N relationships
  ✅ Find optimal join paths between tables
  ✅ Compare schemas across multiple databases
  ✅ Help with migrations and data modeling

  ${chalk.bold('AI Documentation:')}
  📖 Quick Start:       ${chalk.cyan('QUICK-START.md')}
  📖 AI Usage Guide:    ${chalk.cyan('AI-USAGE-GUIDE.md')}
  📖 Multi-Database:    ${chalk.cyan('MULTI-DATABASE-GUIDE.md')}
  📖 Full Docs:         ${chalk.cyan('https://github.com/YOLOVibeCode/ai-db-helper')}

${chalk.bold.magenta('💡 PRO TIPS')}

  ${chalk.bold('1. Connect multiple databases:')}
     Your app uses multiple DBs? Connect them all!
     AI gets complete visibility across your entire data ecosystem.

  ${chalk.bold('2. Cache once, use forever:')}
     Schema is cached locally at ~/.aidb/
     No database queries needed after initial connection.

  ${chalk.bold('3. Safe by default:')}
     Dangerous queries (UPDATE/DELETE without WHERE) require --confirm
     Use --dry-run to test before executing

  ${chalk.bold('4. Multi-format output:')}
     --format json       ${chalk.dim('# AI-optimized (compact)')}
     --format markdown   ${chalk.dim('# Human-readable')}
     --format typescript ${chalk.dim('# Type definitions')}
     --format mermaid    ${chalk.dim('# Visual diagrams')}

${chalk.bold.green('🚀 GET STARTED')}

  ${chalk.gray('$')} aidb connect mydb --connection-string "your-connection-string"
  ${chalk.gray('$')} aidb schema mydb
  ${chalk.gray('$')} aidb relationships mydb

  ${chalk.bold('Then tell your AI:')}
  ${chalk.green('>')} "Run 'aidb schema mydb' to see my database structure"

  ${chalk.dim('Documentation:')} ${chalk.cyan('cat QUICK-START.md')}
  ${chalk.dim('GitHub:')} ${chalk.cyan('https://github.com/YOLOVibeCode/ai-db-helper')}

`);

// Connect command
program
  .command('connect <database-name>')
  .description('Connect to a database and cache its schema')
  .option('--type <type>', 'Database type (mysql, postgres, mssql, sqlite, mongodb, db2, oracle, azure-sql)')
  .option('--host <host>', 'Database host')
  .option('--port <port>', 'Database port')
  .option('--database <database>', 'Database name')
  .option('--user <user>', 'Database username')
  .option('--password <password>', 'Database password')
  .action(connectCommand);

// List command
program
  .command('list')
  .description('List all configured databases')
  .action(listCommand);

// Schema command
program
  .command('schema <database-name>')
  .description('Display database schema')
  .option('--format <format>', 'Output format (json, markdown, ddl, mermaid, typescript)', 'json')
  .option('--table <table>', 'Show only specific table')
  .option('--output <file>', 'Write to file instead of stdout')
  .action(schemaCommand);

// Refresh command
program
  .command('refresh <database-name>')
  .description('Refresh database schema cache')
  .action(refreshCommand);

// Relationships command
program
  .command('relationships <database-name>')
  .description('Display database relationships')
  .option('--format <format>', 'Output format (json, markdown, mermaid)', 'markdown')
  .option('--table <table>', 'Show relationships for specific table')
  .option('--include-inferred', 'Include inferred relationships', false)
  .action(relationshipsCommand);

// Exec command
program
  .command('exec <database-name> <sql>')
  .description('Execute SQL query directly')
  .option('--confirm', 'Auto-confirm dangerous operations (required for INSERT/UPDATE/DELETE)')
  .option('--dry-run', 'Validate query without executing')
  .option('--explain', 'Show query execution plan (EXPLAIN)')
  .option('--timeout <ms>', 'Query timeout in milliseconds', '30000')
  .option('--limit <n>', 'Limit number of rows for SELECT queries')
  .option('--format <format>', 'Output format for SELECT (json, table, csv)', 'table')
  .action(execCommand);

// AI Info command
program
  .command('ai-info')
  .description('Show complete guide for AI assistants')
  .action(aiInfoCommand);

// Error handling
program.on('command:*', () => {
  console.error(chalk.red(`\n❌ Invalid command: ${program.args.join(' ')}`));
  console.log(chalk.yellow('\nRun "aidb --help" for available commands\n'));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
