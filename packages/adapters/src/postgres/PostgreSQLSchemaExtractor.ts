/**
 * PostgreSQLSchemaExtractor - Extract schema information from PostgreSQL
 *
 * Features:
 * - Multi-schema support (public, custom schemas)
 * - Extract tables, columns, indexes, constraints
 * - Custom types (enums, composites)
 * - Foreign key relationship discovery
 * - Schema filtering support
 */

import {
  ISchemaExtractor,
  TableSchema,
  ColumnSchema,
  IndexSchema,
  ConstraintSchema,
  ViewSchema,
  ProcedureSchema,
  TableFilter,
  PrimaryKeySchema,
  IndexType,
  ConstraintType,
  ReferentialAction
} from '@aidb/contracts';
import { PostgreSQLAdapter } from './PostgreSQLAdapter';

export class PostgreSQLSchemaExtractor implements ISchemaExtractor {
  constructor(private adapter: PostgreSQLAdapter) {}

  /**
   * Extract all tables from database
   */
  async extractTables(filter?: TableFilter): Promise<TableSchema[]> {
    // Get target schemas
    const targetSchemas = filter?.includeSchemas || ['public'];

    // Get all tables
    const tablesQuery = `
      SELECT
        schemaname as schema_name,
        tablename as table_name,
        pg_total_relation_size(schemaname || '.' || tablename) as size_bytes
      FROM pg_catalog.pg_tables
      WHERE schemaname = ANY($1::text[])
      ORDER BY schemaname, tablename
    `;

    const tables = await this.adapter.executeQuery<any[]>(tablesQuery, [targetSchemas]);

    const tableSchemas: TableSchema[] = [];

    for (const table of tables) {
      const fullTableName = `${table.schema_name}.${table.table_name}`;

      // Apply filters
      if (filter) {
        if (filter.excludeTables?.some(pattern => this.matchPattern(table.table_name, pattern))) {
          continue;
        }
        if (filter.includeTables && !filter.includeTables.some(pattern => this.matchPattern(table.table_name, pattern))) {
          continue;
        }
      }

      // Extract columns
      const columns = await this.extractTableColumns(table.schema_name, table.table_name);

      // Extract primary key
      const primaryKey = await this.extractPrimaryKey(table.schema_name, table.table_name);

      // Extract indexes
      const indexes = await this.extractIndexes(table.table_name);

      // Extract constraints
      const constraints = await this.extractConstraints(table.table_name);

      // Get row count
      const rowCount = await this.getTableRowCount(fullTableName);

      tableSchemas.push({
        name: table.table_name,
        schema: table.schema_name,
        columns,
        primaryKey,
        indexes,
        constraints,
        rowCount,
        sizeBytes: parseInt(table.size_bytes) || undefined
      });
    }

    return tableSchemas;
  }

  /**
   * Extract columns for a specific table
   */
  private async extractTableColumns(schemaName: string, tableName: string): Promise<ColumnSchema[]> {
    const columnsQuery = `
      SELECT
        column_name,
        data_type,
        udt_name as native_type,
        is_nullable,
        column_default,
        character_maximum_length as max_length,
        numeric_precision as precision,
        numeric_scale as scale,
        col_description((table_schema || '.' || table_name)::regclass, ordinal_position) as comment
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;

    const columns = await this.adapter.executeQuery<any[]>(columnsQuery, [schemaName, tableName]);

    return columns.map(col => ({
      name: col.column_name,
      dataType: col.data_type,
      nativeType: col.native_type,
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default,
      autoIncrement: col.column_default?.includes('nextval') || false,
      comment: col.comment || undefined,
      maxLength: col.max_length || undefined,
      precision: col.precision || undefined,
      scale: col.scale || undefined
    }));
  }

  /**
   * Extract primary key for a table
   */
  private async extractPrimaryKey(schemaName: string, tableName: string): Promise<PrimaryKeySchema | undefined> {
    const pkQuery = `
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1
        AND tc.table_name = $2
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `;

    const pkColumns = await this.adapter.executeQuery<any[]>(pkQuery, [schemaName, tableName]);

    if (pkColumns.length === 0) {
      return undefined;
    }

    return {
      name: pkColumns[0].constraint_name,
      columns: pkColumns.map(pk => pk.column_name)
    };
  }

  /**
   * Extract indexes for a specific table or all tables
   */
  async extractIndexes(tableName?: string): Promise<IndexSchema[]> {
    let indexQuery = `
      SELECT
        schemaname as schema_name,
        tablename as table_name,
        indexname as index_name,
        indexdef as index_definition
      FROM pg_indexes
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    `;

    const params: any[] = [];

    if (tableName) {
      indexQuery += ' AND tablename = $1';
      params.push(tableName);
    }

    indexQuery += ' ORDER BY schemaname, tablename, indexname';

    const indexes = await this.adapter.executeQuery<any[]>(indexQuery, params);

    return indexes
      .filter(idx => !idx.index_name.endsWith('_pkey')) // Skip primary key indexes
      .map(idx => {
        // Parse index definition to extract columns
        const columns = this.parseIndexColumns(idx.index_definition);
        const unique = idx.index_definition.includes('UNIQUE');
        const indexType = this.detectIndexType(idx.index_definition);

        return {
          name: idx.index_name,
          tableName: idx.table_name,
          columns,
          unique,
          type: indexType
        };
      });
  }

  /**
   * Extract constraints for a specific table or all tables
   */
  async extractConstraints(tableName?: string): Promise<ConstraintSchema[]> {
    let fkQuery = `
      SELECT
        tc.constraint_name,
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
    `;

    const params: any[] = [];

    if (tableName) {
      fkQuery += ' AND tc.table_name = $1';
      params.push(tableName);
    }

    fkQuery += ' ORDER BY tc.constraint_name';

    const fkRows = await this.adapter.executeQuery<any[]>(fkQuery, params);

    // Group foreign keys by constraint name
    const constraintMap = new Map<string, ConstraintSchema>();

    for (const row of fkRows) {
      const key = `${row.table_schema}.${row.table_name}.${row.constraint_name}`;

      if (!constraintMap.has(key)) {
        constraintMap.set(key, {
          name: row.constraint_name,
          type: ConstraintType.ForeignKey,
          tableName: row.table_name,
          columns: [],
          referencedTable: row.foreign_table_name,
          referencedColumns: [],
          onDelete: this.mapReferentialAction(row.delete_rule),
          onUpdate: this.mapReferentialAction(row.update_rule)
        });
      }

      constraintMap.get(key)!.columns.push(row.column_name);
      constraintMap.get(key)!.referencedColumns!.push(row.foreign_column_name);
    }

    return Array.from(constraintMap.values());
  }

  /**
   * Extract all views
   */
  async extractViews(): Promise<ViewSchema[]> {
    const viewsQuery = `
      SELECT
        schemaname as schema_name,
        viewname as view_name,
        definition
      FROM pg_catalog.pg_views
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    `;

    const views = await this.adapter.executeQuery<any[]>(viewsQuery);

    const viewSchemas: ViewSchema[] = [];

    for (const view of views) {
      const columns = await this.extractTableColumns(view.schema_name, view.view_name);

      viewSchemas.push({
        name: view.view_name,
        schema: view.schema_name,
        definition: view.definition,
        columns
      });
    }

    return viewSchemas;
  }

  /**
   * Extract stored procedures (functions in PostgreSQL)
   */
  async extractStoredProcedures(): Promise<ProcedureSchema[]> {
    const functionsQuery = `
      SELECT
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition,
        pg_get_function_result(p.oid) as return_type,
        l.lanname as language
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_catalog.pg_language l ON p.prolang = l.oid
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, p.proname
    `;

    const functions = await this.adapter.executeQuery<any[]>(functionsQuery);

    return functions.map(func => ({
      name: func.function_name,
      schema: func.schema_name,
      parameters: [], // TODO: Parse from definition
      returnType: func.return_type,
      language: func.language,
      definition: func.definition
    }));
  }

  /**
   * Get row count for a table
   */
  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.adapter.executeQuery<any[]>(
      `SELECT COUNT(*) as count FROM ${tableName}`
    );
    return parseInt(result[0].count);
  }

  /**
   * Get table size in bytes
   */
  async getTableSize(tableName: string): Promise<number> {
    const result = await this.adapter.executeQuery<any[]>(
      `SELECT pg_total_relation_size($1) as size`,
      [tableName]
    );
    return parseInt(result[0].size);
  }

  /**
   * Get list of all schemas
   */
  async getSchemas(): Promise<string[]> {
    const result = await this.adapter.executeQuery<any[]>(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
    return result.map(row => row.schema_name);
  }

  /**
   * Parse index columns from CREATE INDEX statement
   */
  private parseIndexColumns(indexDef: string): string[] {
    // Extract columns from index definition
    // Example: CREATE INDEX idx_name ON table (col1, col2)
    const match = indexDef.match(/\((.*?)\)/);
    if (!match) return [];

    return match[1]
      .split(',')
      .map(col => col.trim().replace(/^"(.*)"$/, '$1'));
  }

  /**
   * Detect index type from definition
   */
  private detectIndexType(indexDef: string): IndexType {
    if (indexDef.includes('USING btree')) return IndexType.BTree;
    if (indexDef.includes('USING hash')) return IndexType.Hash;
    if (indexDef.includes('USING gin')) return IndexType.GIN;
    if (indexDef.includes('USING gist')) return IndexType.GiST;
    return IndexType.BTree; // Default
  }

  /**
   * Map PostgreSQL referential action to our enum
   */
  private mapReferentialAction(action: string): ReferentialAction {
    switch (action?.toUpperCase()) {
      case 'CASCADE':
        return ReferentialAction.Cascade;
      case 'SET NULL':
        return ReferentialAction.SetNull;
      case 'SET DEFAULT':
        return ReferentialAction.SetDefault;
      case 'RESTRICT':
        return ReferentialAction.Restrict;
      case 'NO ACTION':
      default:
        return ReferentialAction.NoAction;
    }
  }

  /**
   * Match table name against pattern (supports wildcards)
   */
  private matchPattern(tableName: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(tableName);
  }
}
