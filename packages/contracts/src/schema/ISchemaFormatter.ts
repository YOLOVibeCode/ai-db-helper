/**
 * Schema formatting interface for different output formats
 */

import { DatabaseSchema } from '../types/schema-types';

export interface ISchemaFormatter {
  /**
   * Format schema as compact JSON (token-efficient for AI)
   */
  toCompactJSON(schema: DatabaseSchema): string;

  /**
   * Format schema as human-readable Markdown
   */
  toMarkdown(schema: DatabaseSchema, options?: MarkdownOptions): string;

  /**
   * Format schema as DDL (CREATE statements)
   */
  toDDL(schema: DatabaseSchema, options?: DDLOptions): string;

  /**
   * Format schema as Mermaid ER diagram
   */
  toMermaidER(schema: DatabaseSchema, options?: MermaidOptions): string;

  /**
   * Format schema as TypeScript interfaces
   */
  toTypeScript(schema: DatabaseSchema, options?: TypeScriptOptions): string;

  /**
   * Format schema as GraphViz DOT
   */
  toGraphViz(schema: DatabaseSchema): string;
}

export interface MarkdownOptions {
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  includeRelationships?: boolean;
  includeStats?: boolean;
  tableOfContents?: boolean;
}

export interface DDLOptions {
  includeDropStatements?: boolean;
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  databaseType?: string;
}

export interface MermaidOptions {
  includeMultiplicity?: boolean;
  includeAttributes?: boolean;
  maxTablesPerDiagram?: number;
}

export interface TypeScriptOptions {
  includeComments?: boolean;
  includeValidation?: boolean;
  exportTypes?: boolean;
  interfacePrefix?: string;
}
