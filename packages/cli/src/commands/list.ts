/**
 * List Command - List all configured databases
 */

import chalk from 'chalk';
import { DirectoryManager, ConfigManager, SchemaCache } from '@aidb/core';

export async function listCommand() {
  console.log(chalk.blue.bold('\n📋 Configured Databases\n'));

  try {
    const dirManager = new DirectoryManager();
    const config = new ConfigManager(dirManager);
    const cache = new SchemaCache(dirManager);

    await config.load();
    const databases = await config.listDatabases();

    if (databases.length === 0) {
      console.log(chalk.yellow('  No databases configured yet.'));
      console.log(chalk.gray('\n  Run "aidb connect <name>" to connect to a database\n'));
      return;
    }

    for (const dbName of databases) {
      const dbConfig = await config.getDatabaseConfig(dbName);
      const metadata = await cache.getMetadata(dbName);

      console.log(chalk.cyan(`\n  ${dbName}`));
      console.log(chalk.gray(`    Type: ${dbConfig?.type || 'unknown'}`));

      if (metadata) {
        console.log(chalk.gray(`    Last refresh: ${metadata.lastRefresh.toLocaleString()}`));
        console.log(chalk.gray(`    Schema hash: ${metadata.schemaHash.substring(0, 12)}...`));
        console.log(chalk.gray(`    Cache size: ${(metadata.sizeBytes / 1024).toFixed(2)} KB`));
      } else {
        console.log(chalk.yellow(`    Status: No cache found`));
      }
    }

    console.log(chalk.green(`\n✅ Total: ${databases.length} database(s)\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
