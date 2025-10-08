/**
 * MySQLSchemaExtractor - Extract schema information from MySQL
 *
 * Features:
 * - Extract tables, columns, indexes, constraints
 * - Support for MyISAM and InnoDB engines
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
  ParameterSchema,
  TableFilter,
  PrimaryKeySchema,
  IndexType,
  ConstraintType,
  ReferentialAction
} from '@aidb/contracts';
import { MySQLAdapter } from './MySQLAdapter';

export class MySQLSchemaExtractor implements ISchemaExtractor {
  constructor(private adapter: MySQLAdapter) {}

  /**
   * Extract all tables from database
   */
  async extractTables(filter?: TableFilter): Promise<TableSchema[]> {
    const database = this.adapter.getDatabaseName();

    // Get all tables
    const tablesQuery = `
      SELECT
        TABLE_NAME as tableName,
        TABLE_TYPE as tableType,
        ENGINE as engine,
        TABLE_ROWS as rowCount,
        DATA_LENGTH + INDEX_LENGTH as sizeBytes,
        TABLE_COMMENT as comment,
        CREATE_TIME as createTime
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

    const tables = await this.adapter.executeQuery<any[]>(tablesQuery, [database]);

    const tableSchemas: TableSchema[] = [];

    for (const table of tables) {
      // Apply filters
      if (filter) {
        if (filter.excludeTables?.some(pattern => this.matchPattern(table.tableName, pattern))) {
          continue;
        }
        if (filter.includeTables && !filter.includeTables.some(pattern => this.matchPattern(table.tableName, pattern))) {
          continue;
        }
      }

      // Extract columns
      const columns = await this.extractTableColumns(table.tableName);

      // Extract primary key
      const primaryKey = await this.extractPrimaryKey(table.tableName);

      // Extract indexes
      const indexes = await this.extractIndexes(table.tableName);

      // Extract constraints
      const constraints = await this.extractConstraints(table.tableName);

      tableSchemas.push({
        name: table.tableName,
        columns,
        primaryKey,
        indexes,
        constraints,
        rowCount: table.rowCount,
        sizeBytes: table.sizeBytes,
        comment: table.comment || undefined
      });
    }

    return tableSchemas;
  }

  /**
   * Extract columns for a specific table
   */
  private async extractTableColumns(tableName: string): Promise<ColumnSchema[]> {
    const database = this.adapter.getDatabaseName();

    const columnsQuery = `
      SELECT
        COLUMN_NAME as columnName,
        DATA_TYPE as dataType,
        COLUMN_TYPE as columnType,
        IS_NULLABLE as isNullable,
        COLUMN_KEY as columnKey,
        COLUMN_DEFAULT as defaultValue,
        EXTRA as extra,
        CHARACTER_MAXIMUM_LENGTH as maxLength,
        NUMERIC_PRECISION as \`precision\`,
        NUMERIC_SCALE as \`scale\`,
        COLUMN_COMMENT as comment
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const columns = await this.adapter.executeQuery<any[]>(columnsQuery, [database, tableName]);

    return columns.map(col => ({
      name: col.columnName,
      dataType: col.dataType,
      nativeType: col.columnType,
      nullable: col.isNullable === 'YES',
      defaultValue: col.defaultValue,
      autoIncrement: col.extra?.includes('auto_increment') || false,
      comment: col.comment || undefined,
      maxLength: col.maxLength || undefined,
      precision: col.precision || undefined,
      scale: col.scale || undefined
    }));
  }

  /**
   * Extract primary key for a table
   */
  private async extractPrimaryKey(tableName: string): Promise<PrimaryKeySchema | undefined> {
    const database = this.adapter.getDatabaseName();

    const pkQuery = `
      SELECT
        CONSTRAINT_NAME as constraintName,
        COLUMN_NAME as columnName
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION
    `;

    const pkColumns = await this.adapter.executeQuery<any[]>(pkQuery, [database, tableName]);

    if (pkColumns.length === 0) {
      return undefined;
    }

    return {
      name: pkColumns[0].constraintName,
      columns: pkColumns.map(pk => pk.columnName)
    };
  }

  /**
   * Extract indexes for a specific table or all tables
   */
  async extractIndexes(tableName?: string): Promise<IndexSchema[]> {
    const database = this.adapter.getDatabaseName();

    let indexQuery = `
      SELECT
        TABLE_NAME as tableName,
        INDEX_NAME as indexName,
        COLUMN_NAME as columnName,
        NON_UNIQUE as nonUnique,
        SEQ_IN_INDEX as seqInIndex,
        INDEX_TYPE as indexType
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
    `;

    const params: any[] = [database];

    if (tableName) {
      indexQuery += ' AND TABLE_NAME = ?';
      params.push(tableName);
    }

    indexQuery += ' ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX';

    const indexRows = await this.adapter.executeQuery<any[]>(indexQuery, params);

    // Group by index name
    const indexMap = new Map<string, IndexSchema>();

    for (const row of indexRows) {
      // Skip primary key (handled separately)
      if (row.indexName === 'PRIMARY') {
        continue;
      }

      const key = `${row.tableName}.${row.indexName}`;

      if (!indexMap.has(key)) {
        indexMap.set(key, {
          name: row.indexName,
          tableName: row.tableName,
          columns: [],
          unique: row.nonUnique === 0,
          type: this.mapIndexType(row.indexType)
        });
      }

      indexMap.get(key)!.columns.push(row.columnName);
    }

    return Array.from(indexMap.values());
  }

  /**
   * Extract constraints for a specific table or all tables
   */
  async extractConstraints(tableName?: string): Promise<ConstraintSchema[]> {
    const database = this.adapter.getDatabaseName();

    // Foreign key constraints
    let fkQuery = `
      SELECT
        tc.CONSTRAINT_NAME as constraintName,
        tc.TABLE_NAME as tableName,
        kcu.COLUMN_NAME as columnName,
        kcu.REFERENCED_TABLE_NAME as referencedTable,
        kcu.REFERENCED_COLUMN_NAME as referencedColumn,
        rc.DELETE_RULE as deleteRule,
        rc.UPDATE_RULE as updateRule
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE tc.TABLE_SCHEMA = ?
        AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    `;

    const params: any[] = [database];

    if (tableName) {
      fkQuery += ' AND tc.TABLE_NAME = ?';
      params.push(tableName);
    }

    const fkRows = await this.adapter.executeQuery<any[]>(fkQuery, params);

    // Group foreign keys by constraint name
    const constraintMap = new Map<string, ConstraintSchema>();

    for (const row of fkRows) {
      const key = `${row.tableName}.${row.constraintName}`;

      if (!constraintMap.has(key)) {
        constraintMap.set(key, {
          name: row.constraintName,
          type: ConstraintType.ForeignKey,
          tableName: row.tableName,
          columns: [],
          referencedTable: row.referencedTable,
          referencedColumns: [],
          onDelete: this.mapReferentialAction(row.deleteRule),
          onUpdate: this.mapReferentialAction(row.updateRule)
        });
      }

      constraintMap.get(key)!.columns.push(row.columnName);
      constraintMap.get(key)!.referencedColumns!.push(row.referencedColumn);
    }

    return Array.from(constraintMap.values());
  }

  /**
   * Extract all views
   */
  async extractViews(): Promise<ViewSchema[]> {
    const database = this.adapter.getDatabaseName();

    const viewsQuery = `
      SELECT
        TABLE_NAME as viewName,
        VIEW_DEFINITION as definition
      FROM INFORMATION_SCHEMA.VIEWS
      WHERE TABLE_SCHEMA = ?
    `;

    const views = await this.adapter.executeQuery<any[]>(viewsQuery, [database]);

    const viewSchemas: ViewSchema[] = [];

    for (const view of views) {
      const columns = await this.extractTableColumns(view.viewName);

      viewSchemas.push({
        name: view.viewName,
        definition: view.definition,
        columns
      });
    }

    return viewSchemas;
  }

  /**
   * Extract stored procedures
   */
  async extractStoredProcedures(): Promise<ProcedureSchema[]> {
    const database = this.adapter.getDatabaseName();

    const proceduresQuery = `
      SELECT
        ROUTINE_NAME as routineName,
        ROUTINE_TYPE as routineType,
        DTD_IDENTIFIER as returnType,
        ROUTINE_DEFINITION as definition
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_SCHEMA = ?
        AND ROUTINE_TYPE IN ('PROCEDURE', 'FUNCTION')
    `;

    const procedures = await this.adapter.executeQuery<any[]>(proceduresQuery, [database]);

    const procedureSchemas: ProcedureSchema[] = [];

    for (const proc of procedures) {
      const parameters = await this.extractProcedureParameters(proc.routineName);

      procedureSchemas.push({
        name: proc.routineName,
        parameters,
        returnType: proc.returnType || undefined,
        definition: proc.definition || undefined
      });
    }

    return procedureSchemas;
  }

  /**
   * Extract parameters for a stored procedure
   */
  private async extractProcedureParameters(routineName: string): Promise<ParameterSchema[]> {
    const database = this.adapter.getDatabaseName();

    const paramsQuery = `
      SELECT
        PARAMETER_NAME as paramName,
        DATA_TYPE as dataType,
        PARAMETER_MODE as mode
      FROM INFORMATION_SCHEMA.PARAMETERS
      WHERE SPECIFIC_SCHEMA = ?
        AND SPECIFIC_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const params = await this.adapter.executeQuery<any[]>(paramsQuery, [database, routineName]);

    return params.map(p => ({
      name: p.paramName,
      dataType: p.dataType,
      mode: p.mode as 'IN' | 'OUT' | 'INOUT'
    }));
  }

  /**
   * Get row count for a table
   */
  async getTableRowCount(tableName: string): Promise<number> {
    // Use backticks to escape table name (prevent SQL injection)
    const escapedTableName = tableName.replace(/`/g, '``');
    const result = await this.adapter.executeQuery<any[]>(
      `SELECT COUNT(*) as count FROM \`${escapedTableName}\``
    );
    return result[0].count;
  }

  /**
   * Get table size in bytes
   */
  async getTableSize(tableName: string): Promise<number> {
    const database = this.adapter.getDatabaseName();

    const result = await this.adapter.executeQuery<any[]>(
      `SELECT DATA_LENGTH + INDEX_LENGTH as size
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, tableName]
    );

    return result[0]?.size || 0;
  }

  /**
   * Get list of all schemas (MySQL uses databases)
   */
  async getSchemas(): Promise<string[]> {
    const result = await this.adapter.executeQuery<any[]>('SHOW DATABASES');
    return result.map(row => row.Database);
  }

  /**
   * Map MySQL index type to our IndexType enum
   */
  private mapIndexType(mysqlType: string): IndexType {
    switch (mysqlType.toUpperCase()) {
      case 'BTREE':
        return IndexType.BTree;
      case 'HASH':
        return IndexType.Hash;
      case 'FULLTEXT':
        return IndexType.FullText;
      case 'SPATIAL':
        return IndexType.Spatial;
      default:
        return IndexType.BTree;
    }
  }

  /**
   * Map MySQL referential action to our enum
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
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(tableName);
  }
}
