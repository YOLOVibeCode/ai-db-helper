/**
 * Relationships Command - Display database relationships
 */

import chalk from 'chalk';
import { DirectoryManager, SchemaCache, RelationshipGraph } from '@aidb/core';

interface RelationshipsOptions {
  format?: string;
  table?: string;
  includeInferred?: boolean;
}

export async function relationshipsCommand(databaseName: string, options: RelationshipsOptions) {
  try {
    const dirManager = new DirectoryManager();
    const cache = new SchemaCache(dirManager);

    // Load schema from cache
    const schema = await cache.load(databaseName);

    if (!schema) {
      console.error(chalk.red(`\n❌ No schema found for database '${databaseName}'`));
      console.log(chalk.yellow('  Run "aidb connect" to cache the schema first\n'));
      process.exit(1);
    }

    if (!schema.relationships || schema.relationships.length === 0) {
      console.log(chalk.yellow('\n⚠️  No relationships found\n'));
      return;
    }

    // Filter relationships
    let relationships = schema.relationships;

    if (!options.includeInferred) {
      relationships = relationships.filter(r => r.type === 'explicit');
    }

    if (options.table) {
      relationships = relationships.filter(
        r => r.fromTable === options.table || r.toTable === options.table
      );
    }

    // Format output
    const format = options.format || 'markdown';

    if (format === 'json') {
      console.log('\n' + JSON.stringify(relationships, null, 2) + '\n');
      return;
    }

    if (format === 'mermaid') {
      const graph = new RelationshipGraph();
      graph.buildGraph(schema, relationships);
      console.log('\n' + graph.exportMermaidER() + '\n');
      return;
    }

    // Default: Markdown format
    console.log(chalk.blue.bold(`\n📊 Database Relationships: ${databaseName}\n`));

    // Group by table
    const tableGroups = new Map<string, any[]>();

    for (const rel of relationships) {
      if (!tableGroups.has(rel.fromTable)) {
        tableGroups.set(rel.fromTable, []);
      }
      tableGroups.get(rel.fromTable)!.push(rel);
    }

    // Display by table
    for (const [tableName, rels] of tableGroups.entries()) {
      console.log(chalk.cyan(`\n${tableName}`));

      for (const rel of rels) {
        const typeIcon = rel.type === 'explicit' ? '✓' : '~';
        const confidenceColor = rel.confidence >= 0.9 ? chalk.green : rel.confidence >= 0.7 ? chalk.yellow : chalk.red;
        const multiplicityIcon = getMultiplicityIcon(rel.multiplicity);

        console.log(
          chalk.gray(`  ${typeIcon} ${rel.fromColumn}`) +
          chalk.white(` ${multiplicityIcon} `) +
          chalk.gray(`${rel.toTable}.${rel.toColumn}`) +
          confidenceColor(` (${(rel.confidence * 100).toFixed(0)}%)`)
        );

        if (rel.type === 'inferred') {
          console.log(chalk.gray(`     └─ inferred from naming convention`));
        }
      }
    }

    // Show junction tables
    if (schema.junctionTables && schema.junctionTables.length > 0) {
      console.log(chalk.blue.bold('\n🔗 Junction Tables (Many-to-Many):\n'));

      for (const junction of schema.junctionTables) {
        console.log(chalk.cyan(`  ${junction.tableName}`));
        console.log(chalk.gray(`    Connects: ${junction.leftTable} ↔ ${junction.rightTable}`));
        console.log(chalk.gray(`    Confidence: ${(junction.confidence * 100).toFixed(0)}%`));

        if (junction.additionalColumns.length > 0) {
          console.log(chalk.gray(`    Extra columns: ${junction.additionalColumns.join(', ')}`));
        }
      }
    }

    // Statistics
    const stats = {
      total: relationships.length,
      explicit: relationships.filter(r => r.type === 'explicit').length,
      inferred: relationships.filter(r => r.type === 'inferred').length,
      oneToOne: relationships.filter(r => r.multiplicity === '1:1').length,
      oneToMany: relationships.filter(r => r.multiplicity === '1:N').length,
      manyToOne: relationships.filter(r => r.multiplicity === 'N:1').length,
      junctions: schema.junctionTables?.length || 0
    };

    console.log(chalk.blue.bold('\n📈 Statistics:\n'));
    console.log(chalk.gray(`  Total relationships: ${stats.total}`));
    console.log(chalk.gray(`  Explicit (FK): ${stats.explicit}`));
    console.log(chalk.gray(`  Inferred: ${stats.inferred}`));
    console.log(chalk.gray(`  1:1: ${stats.oneToOne}, 1:N: ${stats.oneToMany}, N:1: ${stats.manyToOne}`));
    console.log(chalk.gray(`  Junction tables: ${stats.junctions}\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function getMultiplicityIcon(multiplicity: string): string {
  switch (multiplicity) {
    case '1:1':
      return '──';
    case '1:N':
      return '─→';
    case 'N:1':
      return '←─';
    case 'N:N':
      return '↔';
    default:
      return '─';
  }
}
