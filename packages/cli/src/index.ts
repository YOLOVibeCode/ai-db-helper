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

const program = new Command();

program
  .name('aidb')
  .description('🚀 AI Database Helper - Database schema intelligence for AI')
  .version('1.0.0');

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
