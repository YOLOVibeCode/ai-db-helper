/**
 * Refresh Command - Refresh database schema cache
 */

import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  DirectoryManager,
  CredentialVault,
  SchemaCache,
  RelationshipAnalyzer
} from '@aidb/core';
import { MySQLAdapter, MySQLSchemaExtractor, PostgreSQLAdapter, PostgreSQLSchemaExtractor } from '@aidb/adapters';
import { DatabaseType, DatabaseSchema } from '@aidb/contracts';

export async function refreshCommand(databaseName: string) {
  console.log(chalk.blue.bold(`\n🔄 Refreshing schema for ${databaseName}\n`));

  try {
    const dirManager = new DirectoryManager();
    const vault = new CredentialVault(dirManager);
    const cache = new SchemaCache(dirManager);

    // Check if database exists
    const exists = await cache.exists(databaseName);
    if (!exists) {
      console.error(chalk.red(`\n❌ Database '${databaseName}' not found`));
      console.log(chalk.yellow('  Run "aidb connect" first\n'));
      process.exit(1);
    }

    // Prompt for master password
    const { masterPassword } = await inquirer.prompt([
      {
        type: 'password',
        name: 'masterPassword',
        message: 'Enter master password:',
        mask: '*'
      }
    ]);

    vault.setMasterPassword(masterPassword);

    // Retrieve credentials
    const credentials = await vault.retrieve(databaseName);
    if (!credentials) {
      console.error(chalk.red('\n❌ Credentials not found'));
      process.exit(1);
    }

    // Connect to database
    const spinner = ora('Connecting to database').start();

    const adapter = createAdapter(credentials.type);
    await adapter.connect(credentials);

    spinner.succeed(chalk.green('Connected!'));

    // Extract schema
    spinner.start('Extracting schema...');

    const extractor = createExtractor(adapter, credentials.type);
    const tables = await extractor.extractTables();
    const views = await extractor.extractViews();
    const procedures = await extractor.extractStoredProcedures();

    spinner.text = 'Analyzing relationships...';

    const schema: DatabaseSchema = {
      databaseName,
      databaseType: credentials.type,
      version: '1.0.0',
      generatedAt: new Date(),
      schemaHash: '',
      tables,
      views,
      procedures,
      metadata: {
        extractedAt: new Date(),
        extractionDurationMs: 0,
        tableCount: tables.length,
        relationshipCount: 0
      }
    };

    // Analyze relationships
    const analyzer = new RelationshipAnalyzer(adapter);
    const explicit = await analyzer.discoverExplicitRelationships(schema);
    const inferred = await analyzer.inferImplicitRelationships(schema);
    const junctions = await analyzer.detectJunctionTables(schema, [...explicit, ...inferred]);

    schema.relationships = [...explicit, ...inferred];
    schema.junctionTables = junctions;
    schema.metadata!.relationshipCount = explicit.length + inferred.length;

    spinner.succeed(chalk.green('Schema extracted!'));

    // Save to cache
    spinner.start('Updating cache...');
    await cache.save(databaseName, schema);
    spinner.succeed(chalk.green('Cache updated!'));

    // Disconnect
    await adapter.disconnect();

    // Show summary
    console.log(chalk.green.bold('\n✅ Schema refreshed successfully!\n'));
    console.log(chalk.gray(`  Tables: ${tables.length}`));
    console.log(chalk.gray(`  Views: ${views.length}`));
    console.log(chalk.gray(`  Relationships: ${explicit.length} explicit, ${inferred.length} inferred\n`));

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
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}

function createExtractor(adapter: any, type: DatabaseType) {
  switch (type) {
    case DatabaseType.MySQL:
      return new MySQLSchemaExtractor(adapter);
    case DatabaseType.PostgreSQL:
      return new PostgreSQLSchemaExtractor(adapter);
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}
