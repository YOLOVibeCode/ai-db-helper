/**
 * Exec Command - Execute SQL directly
 */

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import {
  DirectoryManager,
  CredentialVault,
  SchemaCache,
  QueryExecutor
} from '@aidb/core';
import { MySQLAdapter, PostgreSQLAdapter, MSSQLAdapter, OracleAdapter } from '@aidb/adapters';
import { DatabaseType, QueryType } from '@aidb/contracts';

interface ExecOptions {
  confirm?: boolean;
  dryRun?: boolean;
  explain?: boolean;
  timeout?: string;
  limit?: string;
  format?: 'json' | 'table' | 'csv';
}

export async function execCommand(databaseName: string, sql: string, options: ExecOptions) {
  console.log(chalk.blue.bold('\n🚀 AI Database Helper - Execute SQL\n'));

  try {
    // Initialize infrastructure
    const dirManager = new DirectoryManager();
    await dirManager.initialize();

    const vault = new CredentialVault(dirManager);
    const cache = new SchemaCache(dirManager);

    // Load credentials
    const { masterPassword } = await inquirer.prompt([
      {
        type: 'password',
        name: 'masterPassword',
        message: 'Enter master password:',
        mask: '*',
        validate: (input: string) => input.length > 0 || 'Password required'
      }
    ]);

    vault.setMasterPassword(masterPassword);

    const credentials = await vault.retrieve(databaseName);
    if (!credentials) {
      throw new Error(`Database '${databaseName}' not found. Run 'aidb connect ${databaseName}' first.`);
    }

    // Load schema for validation
    const schema = await cache.load(databaseName);

    // Create adapter
    const adapter = createAdapter(credentials.type);
    await adapter.connect(credentials);

    // Create executor
    const executor = new QueryExecutor();
    executor.setAdapter(adapter);
    if (schema) {
      executor.setSchema(schema);
    }

    console.log(chalk.cyan('📝 SQL Query:'));
    console.log(chalk.gray(sql));
    console.log('');

    // Validate query
    const spinner = ora('Validating query...').start();
    const validation = await executor.validate(sql);

    if (!validation.isValid) {
      spinner.fail(chalk.red('Query validation failed'));
      console.log(chalk.red('\n❌ Errors:'));
      validation.errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Query validated'));

    // Show warnings
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      validation.warnings.forEach(warn => console.log(chalk.yellow(`  - ${warn}`)));
    }

    // Check if dangerous
    if (validation.isDangerous) {
      console.log(chalk.red('\n⚠️  DANGEROUS OPERATION DETECTED'));
      console.log(chalk.yellow(`Query type: ${validation.queryType}`));
      console.log(chalk.yellow(`Tables affected: ${validation.tables.join(', ')}`));

      if (!options.confirm && !options.dryRun) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'This operation will modify data. Continue?',
            default: false
          }
        ]);

        if (!proceed) {
          console.log(chalk.yellow('\n⛔ Operation cancelled'));
          process.exit(0);
        }
      }
    }

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.cyan('\n🔍 DRY RUN MODE - Query will not be executed'));
      console.log(chalk.gray(`Query type: ${validation.queryType}`));
      console.log(chalk.gray(`Tables: ${validation.tables.join(', ')}`));
      console.log(chalk.gray(`Dangerous: ${validation.isDangerous ? 'Yes' : 'No'}`));
      await adapter.disconnect();
      return;
    }

    // EXPLAIN mode
    if (options.explain) {
      spinner.start('Running EXPLAIN...');
      try {
        const explainSql = `EXPLAIN ${sql}`;
        const explainResult = await adapter.executeQuery(explainSql);

        spinner.succeed(chalk.green('EXPLAIN complete'));
        console.log(chalk.cyan('\n📊 Query Plan:'));
        console.table(explainResult);
      } catch (error) {
        spinner.fail(chalk.red('EXPLAIN failed'));
        console.log(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      }
    }

    // Execute query
    spinner.start('Executing query...');

    const execOptions = {
      timeout: options.timeout ? parseInt(options.timeout) : 30000,
      limit: options.limit ? parseInt(options.limit) : undefined
    };

    const result = await executor.execute(sql, execOptions);

    spinner.succeed(chalk.green('Query executed successfully'));

    // Display results
    console.log(chalk.green('\n✅ Results:\n'));

    if (validation.queryType === QueryType.SELECT) {
      // Display SELECT results
      console.log(chalk.gray(`Rows returned: ${result.rowCount}`));
      console.log(chalk.gray(`Execution time: ${result.executionTimeMs}ms`));
      console.log('');

      if (result.rows.length > 0) {
        if (options.format === 'json') {
          console.log(JSON.stringify(result.rows, null, 2));
        } else if (options.format === 'csv') {
          // Simple CSV output
          const headers = Object.keys(result.rows[0]);
          console.log(headers.join(','));
          result.rows.forEach(row => {
            console.log(headers.map(h => row[h]).join(','));
          });
        } else {
          // Table format (default)
          console.table(result.rows);
        }
      } else {
        console.log(chalk.gray('No rows returned'));
      }
    } else {
      // Display INSERT/UPDATE/DELETE results
      console.log(chalk.gray(`Rows affected: ${result.affectedRows || 0}`));
      console.log(chalk.gray(`Execution time: ${result.executionTimeMs}ms`));
    }

    // Disconnect
    await adapter.disconnect();

    console.log(chalk.green('\n✓ Complete\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function createAdapter(type: DatabaseType) {
  switch (type) {
    case DatabaseType.MySQL:
      return new MySQLAdapter();
    case DatabaseType.PostgreSQL:
      return new PostgreSQLAdapter();
    case DatabaseType.MSSQL:
    case DatabaseType.AzureSQL:
      return new MSSQLAdapter();
    case DatabaseType.Oracle:
      return new OracleAdapter();
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}
