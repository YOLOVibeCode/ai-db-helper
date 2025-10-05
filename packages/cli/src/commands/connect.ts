/**
 * Connect Command - Connect to a database and cache its schema
 */

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import {
  DirectoryManager,
  CredentialVault,
  SchemaCache,
  ConfigManager,
  RelationshipAnalyzer,
  RelationshipGraph
} from '@aidb/core';
import {
  MySQLAdapter,
  MySQLSchemaExtractor,
  PostgreSQLAdapter,
  PostgreSQLSchemaExtractor,
  MSSQLAdapter,
  MSSQLSchemaExtractor,
  OracleAdapter,
  OracleSchemaExtractor,
  MongoDBAdapter,
  MongoDBSchemaExtractor
} from '@aidb/adapters';
import { ConnectionCredentials, DatabaseType, DatabaseSchema } from '@aidb/contracts';

interface ConnectOptions {
  type?: string;
  host?: string;
  port?: string;
  database?: string;
  user?: string;
  password?: string;
}

export async function connectCommand(databaseName: string, options: ConnectOptions) {
  console.log(chalk.blue.bold('\n🚀 AI Database Helper - Connect\n'));

  try {
    // Initialize infrastructure
    const dirManager = new DirectoryManager();
    await dirManager.initialize();

    const vault = new CredentialVault(dirManager);
    const cache = new SchemaCache(dirManager);
    const config = new ConfigManager(dirManager);

    // Get or prompt for connection details
    const credentials = await getCredentials(databaseName, options);

    // Prompt for master password
    const { masterPassword } = await inquirer.prompt([
      {
        type: 'password',
        name: 'masterPassword',
        message: 'Enter master password to encrypt credentials:',
        mask: '*',
        validate: (input: string) => input.length >= 8 || 'Password must be at least 8 characters'
      }
    ]);

    vault.setMasterPassword(masterPassword);

    // Test connection
    console.log(chalk.cyan('\n📡 Testing connection...'));
    const spinner = ora('Connecting to database').start();

    const adapter = createAdapter(credentials);
    await adapter.connect(credentials);

    spinner.succeed(chalk.green('Connected successfully!'));

    // Extract schema
    spinner.start('Extracting schema...');

    const extractor = createExtractor(adapter, credentials.type);

    let tables, views, procedures;

    // MongoDB uses different interface (NoSQL)
    if (credentials.type === DatabaseType.MongoDB) {
      const mongoExtractor = extractor as MongoDBSchemaExtractor;
      const collections = await mongoExtractor.inferAllSchemas({ sampleSize: 100 });
      tables = collections.map(c => mongoExtractor.toTableSchema(c));
      views = [];
      procedures = [];
    } else {
      const sqlExtractor = extractor as any; // TypeScript can't narrow the union type
      tables = await sqlExtractor.extractTables();
      views = await sqlExtractor.extractViews();
      procedures = await sqlExtractor.extractStoredProcedures();
    }

    spinner.text = 'Analyzing relationships...';

    // Build schema object
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

    spinner.text = 'Building relationship graph...';

    // Build relationship graph
    const graph = new RelationshipGraph();
    graph.buildGraph(schema, schema.relationships);

    spinner.succeed(chalk.green('Schema extracted successfully!'));

    // Save to cache
    spinner.start('Saving to cache...');
    await cache.save(databaseName, schema);
    spinner.succeed(chalk.green('Schema cached!'));

    // Save credentials
    spinner.start('Encrypting and saving credentials...');
    await vault.store(databaseName, credentials);
    spinner.succeed(chalk.green('Credentials saved!'));

    // Update config
    await config.load();
    await config.setDatabaseConfig(databaseName, {
      type: credentials.type,
      lastRefresh: new Date(),
      autoRefresh: false,
      schemaHash: schema.schemaHash,
      defaultFormat: 'json',
      schemaSubset: { enabled: false },
      relationships: {
        includeInferred: true,
        inferenceConfidenceThreshold: 0.7,
        autoDetectJunctions: true
      },
      queryPlanning: {
        enabled: true,
        trackQueryLog: false,
        indexSuggestions: true
      }
    });

    // Disconnect
    await adapter.disconnect();

    // Show summary
    console.log(chalk.green.bold('\n✅ Database connected successfully!\n'));
    console.log(chalk.white('Summary:'));
    console.log(chalk.gray(`  Database: ${databaseName}`));
    console.log(chalk.gray(`  Type: ${credentials.type}`));
    console.log(chalk.gray(`  Tables: ${tables.length}`));
    console.log(chalk.gray(`  Views: ${views.length}`));
    console.log(chalk.gray(`  Procedures: ${procedures.length}`));
    console.log(chalk.gray(`  Relationships: ${explicit.length} explicit, ${inferred.length} inferred`));
    console.log(chalk.gray(`  Junction tables: ${junctions.length}`));
    console.log(chalk.green(`\n💾 Schema cached at: ${cache.getCachePath(databaseName)}`));
    console.log(chalk.yellow(`\n💡 Next: Run "aidb schema ${databaseName}" to view the schema\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function getCredentials(databaseName: string, options: ConnectOptions): Promise<ConnectionCredentials> {
  // If minimal required options provided (type, host, database), use them
  // For MongoDB, user is optional (no auth mode)
  if (options.type && options.host && options.database) {
    return {
      type: options.type as DatabaseType,
      host: options.host,
      port: options.port ? parseInt(options.port) : getDefaultPort(options.type as DatabaseType),
      database: options.database,
      username: options.user,
      password: options.password
    };
  }

  // Otherwise, prompt
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Database type:',
      choices: ['mysql', 'postgres', 'mssql', 'sqlite', 'mongodb', 'db2', 'oracle', 'azure-sql'],
      default: options.type || 'mysql'
    },
    {
      type: 'input',
      name: 'host',
      message: 'Host:',
      default: options.host || 'localhost'
    },
    {
      type: 'input',
      name: 'port',
      message: 'Port:',
      default: (answers: any) => options.port || getDefaultPort(answers.type).toString()
    },
    {
      type: 'input',
      name: 'database',
      message: 'Database name:',
      default: options.database || databaseName
    },
    {
      type: 'input',
      name: 'username',
      message: 'Username:',
      default: options.user || 'root'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*'
    }
  ]);

  return {
    type: answers.type,
    host: answers.host,
    port: parseInt(answers.port),
    database: answers.database,
    username: answers.username,
    password: answers.password
  };
}

function createAdapter(credentials: ConnectionCredentials) {
  switch (credentials.type) {
    case DatabaseType.MySQL:
      return new MySQLAdapter();
    case DatabaseType.PostgreSQL:
      return new PostgreSQLAdapter();
    case DatabaseType.MSSQL:
    case DatabaseType.AzureSQL:
      return new MSSQLAdapter();
    case DatabaseType.Oracle:
      return new OracleAdapter();
    case DatabaseType.MongoDB:
      return new MongoDBAdapter();
    default:
      throw new Error(`Unsupported database type: ${credentials.type}`);
  }
}

function createExtractor(adapter: any, type: DatabaseType) {
  switch (type) {
    case DatabaseType.MySQL:
      return new MySQLSchemaExtractor(adapter);
    case DatabaseType.PostgreSQL:
      return new PostgreSQLSchemaExtractor(adapter);
    case DatabaseType.MSSQL:
    case DatabaseType.AzureSQL:
      return new MSSQLSchemaExtractor(adapter);
    case DatabaseType.Oracle:
      return new OracleSchemaExtractor(adapter);
    case DatabaseType.MongoDB:
      return new MongoDBSchemaExtractor(adapter);
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}

function getDefaultPort(type: DatabaseType): number {
  switch (type) {
    case DatabaseType.MySQL:
      return 3306;
    case DatabaseType.PostgreSQL:
      return 5432;
    case DatabaseType.MSSQL:
    case DatabaseType.AzureSQL:
      return 1433;
    case DatabaseType.MongoDB:
      return 27017;
    case DatabaseType.Oracle:
      return 1521;
    case DatabaseType.DB2:
      return 50000;
    default:
      return 3306;
  }
}
