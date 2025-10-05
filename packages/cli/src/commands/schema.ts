/**
 * Schema Command - Display database schema in various formats
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import { DirectoryManager, SchemaCache } from '@aidb/core';

interface SchemaOptions {
  format?: string;
  table?: string;
  output?: string;
}

export async function schemaCommand(databaseName: string, options: SchemaOptions) {
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

    // Filter by table if specified
    let output: string;

    if (options.table) {
      const table = schema.tables.find(t => t.name === options.table);
      if (!table) {
        console.error(chalk.red(`\n❌ Table '${options.table}' not found`));
        process.exit(1);
      }

      output = formatTable(table, options.format || 'json');
    } else {
      output = formatSchema(schema, options.format || 'json');
    }

    // Output to file or stdout
    if (options.output) {
      await fs.writeFile(options.output, output, 'utf-8');
      console.log(chalk.green(`\n✅ Schema written to ${options.output}\n`));
    } else {
      console.log('\n' + output + '\n');
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function formatSchema(schema: any, format: string): string {
  switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(schema, null, 2);

    case 'markdown':
      return formatAsMarkdown(schema);

    case 'compact':
      return formatAsCompact(schema);

    default:
      return JSON.stringify(schema, null, 2);
  }
}

function formatTable(table: any, format: string): string {
  switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(table, null, 2);

    case 'markdown':
      return formatTableAsMarkdown(table);

    default:
      return JSON.stringify(table, null, 2);
  }
}

function formatAsMarkdown(schema: any): string {
  let md = `# Database Schema: ${schema.databaseName}\n\n`;
  md += `**Type:** ${schema.databaseType}  \n`;
  md += `**Generated:** ${new Date(schema.generatedAt).toLocaleString()}  \n`;
  md += `**Tables:** ${schema.tables.length}  \n`;
  md += `**Views:** ${schema.views?.length || 0}  \n`;
  md += `**Relationships:** ${schema.relationships?.length || 0}  \n\n`;

  md += `## Tables\n\n`;

  for (const table of schema.tables) {
    md += formatTableAsMarkdown(table) + '\n\n';
  }

  return md;
}

function formatTableAsMarkdown(table: any): string {
  let md = `### ${table.name}\n\n`;

  if (table.comment) {
    md += `*${table.comment}*\n\n`;
  }

  md += `| Column | Type | Nullable | Default | Extra |\n`;
  md += `|--------|------|----------|---------|-------|\n`;

  for (const col of table.columns) {
    md += `| ${col.name} | ${col.nativeType} | ${col.nullable ? 'Yes' : 'No'} | ${col.defaultValue || '-'} | ${col.autoIncrement ? 'AUTO_INCREMENT' : ''} |\n`;
  }

  if (table.indexes && table.indexes.length > 0) {
    md += `\n**Indexes:**\n`;
    for (const idx of table.indexes) {
      md += `- ${idx.name} (${idx.columns.join(', ')})${idx.unique ? ' UNIQUE' : ''}\n`;
    }
  }

  if (table.constraints && table.constraints.length > 0) {
    md += `\n**Foreign Keys:**\n`;
    for (const fk of table.constraints) {
      if (fk.type === 'FOREIGN KEY') {
        md += `- ${fk.name}: ${fk.columns.join(', ')} → ${fk.referencedTable}.${fk.referencedColumns?.join(', ')}\n`;
      }
    }
  }

  return md;
}

function formatAsCompact(schema: any): string {
  const compact = {
    db: schema.databaseName,
    type: schema.databaseType,
    tables: schema.tables.map((t: any) => ({
      n: t.name,
      cols: t.columns.map((c: any) => ({
        n: c.name,
        t: c.dataType,
        null: c.nullable,
        pk: t.primaryKey?.columns.includes(c.name) || false
      })),
      rels: schema.relationships?.filter((r: any) => r.fromTable === t.name).map((r: any) => ({
        to: r.toTable,
        m: r.multiplicity,
        conf: r.confidence
      })) || []
    }))
  };

  return JSON.stringify(compact, null, 2);
}
