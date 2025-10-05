import {
  ISchemaExtractor,
  TableSchema,
  ColumnSchema,
  IndexSchema,
  ConstraintSchema,
  ViewSchema,
  ProcedureSchema,
  PrimaryKeySchema,
  IndexType,
  ConstraintType,
  ReferentialAction,
  TableFilter
} from '@aidb/contracts';
import { MSSQLAdapter } from './MSSQLAdapter';

/**
 * MSSQL Schema Extractor
 * Extracts complete schema information from Microsoft SQL Server databases
 */
export class MSSQLSchemaExtractor implements ISchemaExtractor {
  constructor(private adapter: MSSQLAdapter) {}

  /**
   * Extract all tables from database
   */
  async extractTables(filter?: TableFilter): Promise<TableSchema[]> {
    const database = this.adapter.getDatabaseName();

    const tablesQuery = `
      SELECT
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        p.rows AS row_count,
        (SUM(a.total_pages) * 8) AS size_kb
      FROM INFORMATION_SCHEMA.TABLES t
      INNER JOIN sys.tables st ON t.TABLE_NAME = st.name
      INNER JOIN sys.partitions p ON st.object_id = p.object_id
      INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
      WHERE t.TABLE_CATALOG = @param0
        AND t.TABLE_TYPE = 'BASE TABLE'
        AND p.index_id IN (0, 1)
      GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME, p.rows
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
    `;

    const tables = await this.adapter.executeQuery<any[]>(tablesQuery, [database]);
    const tableSchemas: TableSchema[] = [];

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const schemaName = table.TABLE_SCHEMA;

      // Apply filter
      if (filter?.includeTables && !filter.includeTables.includes(tableName)) {
        continue;
      }
      if (filter?.excludeTables && filter.excludeTables.includes(tableName)) {
        continue;
      }

      const columns = await this.extractTableColumns(schemaName, tableName);
      const primaryKey = await this.extractPrimaryKey(schemaName, tableName);
      const indexes = await this.extractIndexes(tableName);
      const constraints = await this.extractConstraints(tableName);

      tableSchemas.push({
        name: tableName,
        schema: schemaName,
        columns,
        primaryKey,
        indexes,
        constraints,
        rowCount: table.row_count || 0,
        sizeBytes: (table.size_kb || 0) * 1024,
      });
    }

    return tableSchemas;
  }

  /**
   * Extract columns for a specific table
   */
  private async extractTableColumns(schemaName: string, tableName: string): Promise<ColumnSchema[]> {
    const database = this.adapter.getDatabaseName();

    const columnsQuery = `
      SELECT
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        ep.value AS column_comment
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN sys.extended_properties ep
        ON ep.major_id = OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME)
        AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'ColumnId')
        AND ep.name = 'MS_Description'
      WHERE c.TABLE_CATALOG = @param0
        AND c.TABLE_SCHEMA = @param1
        AND c.TABLE_NAME = @param2
      ORDER BY c.ORDINAL_POSITION
    `;

    const columns = await this.adapter.executeQuery<any[]>(columnsQuery, [database, schemaName, tableName]);

    return columns.map(col => ({
      name: col.COLUMN_NAME,
      dataType: col.DATA_TYPE,
      nativeType: col.DATA_TYPE,
      nullable: col.IS_NULLABLE === 'YES',
      defaultValue: col.COLUMN_DEFAULT || undefined,
      autoIncrement: false, // TODO: detect IDENTITY columns
      comment: col.column_comment || undefined,
      maxLength: col.CHARACTER_MAXIMUM_LENGTH || undefined,
      precision: col.NUMERIC_PRECISION || undefined,
      scale: col.NUMERIC_SCALE || undefined
    }));
  }

  /**
   * Extract primary key information
   */
  private async extractPrimaryKey(schemaName: string, tableName: string): Promise<PrimaryKeySchema | undefined> {
    const pkQuery = `
      SELECT
        kc.CONSTRAINT_NAME,
        kc.COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kc
      INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        ON kc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        AND kc.TABLE_SCHEMA = tc.TABLE_SCHEMA
        AND kc.TABLE_NAME = tc.TABLE_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        AND kc.TABLE_SCHEMA = @param0
        AND kc.TABLE_NAME = @param1
      ORDER BY kc.ORDINAL_POSITION
    `;

    const pkColumns = await this.adapter.executeQuery<any[]>(pkQuery, [schemaName, tableName]);

    if (pkColumns.length === 0) {
      return undefined;
    }

    return {
      name: pkColumns[0].CONSTRAINT_NAME,
      columns: pkColumns.map(pk => pk.COLUMN_NAME),
    };
  }

  /**
   * Extract indexes for a specific table or all tables
   */
  async extractIndexes(tableName?: string): Promise<IndexSchema[]> {
    let indexQuery = `
      SELECT
        t.name AS table_name,
        s.name AS schema_name,
        i.name AS index_name,
        i.is_unique,
        COL_NAME(ic.object_id, ic.column_id) AS column_name,
        i.type_desc AS index_type
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE i.is_primary_key = 0
    `;

    const params: any[] = [];
    if (tableName) {
      indexQuery += ' AND t.name = @param0';
      params.push(tableName);
    }

    indexQuery += ' ORDER BY t.name, i.name, ic.key_ordinal';

    const indexRows = await this.adapter.executeQuery<any[]>(indexQuery, params);

    // Group by index name
    const indexMap = new Map<string, IndexSchema>();

    for (const row of indexRows) {
      const key = `${row.schema_name}.${row.table_name}.${row.index_name}`;

      if (!indexMap.has(key)) {
        indexMap.set(key, {
          name: row.index_name,
          tableName: `${row.schema_name}.${row.table_name}`,
          columns: [],
          unique: row.is_unique,
          type: this.mapIndexType(row.index_type),
        });
      }

      indexMap.get(key)!.columns.push(row.column_name);
    }

    return Array.from(indexMap.values());
  }

  /**
   * Map MSSQL index type to our IndexType enum
   */
  private mapIndexType(mssqlType: string): IndexType {
    switch (mssqlType?.toUpperCase()) {
      case 'CLUSTERED':
        return IndexType.Clustered;
      case 'NONCLUSTERED':
        return IndexType.NonClustered;
      case 'HEAP':
      default:
        return IndexType.BTree;
    }
  }

  /**
   * Extract constraints for a specific table or all tables
   */
  async extractConstraints(tableName?: string): Promise<ConstraintSchema[]> {
    let constraintQuery = `
      SELECT
        s.name AS schema_name,
        t.name AS table_name,
        fk.name AS constraint_name,
        'FOREIGN KEY' AS constraint_type,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS referenced_schema,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column,
        fk.delete_referential_action_desc AS delete_rule,
        fk.update_referential_action_desc AS update_rule
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (tableName) {
      constraintQuery += ' AND t.name = @param0';
      params.push(tableName);
    }

    constraintQuery += ' ORDER BY fk.name';

    const constraints = await this.adapter.executeQuery<any[]>(constraintQuery, params);

    // Group by constraint name to handle multi-column foreign keys
    const constraintMap = new Map<string, ConstraintSchema>();

    for (const c of constraints) {
      const key = `${c.schema_name}.${c.table_name}.${c.constraint_name}`;

      if (!constraintMap.has(key)) {
        constraintMap.set(key, {
          name: c.constraint_name,
          type: ConstraintType.ForeignKey,
          tableName: `${c.schema_name}.${c.table_name}`,
          columns: [],
          referencedTable: `${c.referenced_schema}.${c.referenced_table}`,
          referencedColumns: [],
          onDelete: this.mapReferentialAction(c.delete_rule),
          onUpdate: this.mapReferentialAction(c.update_rule),
        });
      }

      constraintMap.get(key)!.columns.push(c.column_name);
      constraintMap.get(key)!.referencedColumns!.push(c.referenced_column);
    }

    return Array.from(constraintMap.values());
  }

  /**
   * Map MSSQL referential action to our enum
   */
  private mapReferentialAction(action: string): ReferentialAction {
    switch (action?.toUpperCase()) {
      case 'CASCADE':
        return ReferentialAction.Cascade;
      case 'SET_NULL':
      case 'SET NULL':
        return ReferentialAction.SetNull;
      case 'SET_DEFAULT':
      case 'SET DEFAULT':
        return ReferentialAction.SetDefault;
      case 'NO_ACTION':
      case 'NO ACTION':
      default:
        return ReferentialAction.NoAction;
    }
  }

  /**
   * Extract all views
   */
  async extractViews(): Promise<ViewSchema[]> {
    const database = this.adapter.getDatabaseName();

    const viewsQuery = `
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS
      WHERE TABLE_CATALOG = @param0
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `;

    const views = await this.adapter.executeQuery<any[]>(viewsQuery, [database]);

    const viewSchemas: ViewSchema[] = [];

    for (const view of views) {
      const columns = await this.extractTableColumns(view.TABLE_SCHEMA, view.TABLE_NAME);

      viewSchemas.push({
        name: view.TABLE_NAME,
        schema: view.TABLE_SCHEMA,
        definition: view.VIEW_DEFINITION,
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
        ROUTINE_SCHEMA,
        ROUTINE_NAME,
        ROUTINE_DEFINITION,
        CREATED,
        LAST_ALTERED
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_CATALOG = @param0
        AND ROUTINE_TYPE = 'PROCEDURE'
      ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
    `;

    const procedures = await this.adapter.executeQuery<any[]>(proceduresQuery, [database]);

    return procedures.map(p => ({
      name: p.ROUTINE_NAME,
      schema: p.ROUTINE_SCHEMA,
      definition: p.ROUTINE_DEFINITION || undefined,
      parameters: [],
    }));
  }

  /**
   * Get row count for a table
   */
  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.adapter.executeQuery<any[]>(
      `SELECT COUNT(*) as count FROM ${tableName}`
    );
    return result[0].count;
  }

  /**
   * Get table size in bytes
   */
  async getTableSize(tableName: string): Promise<number> {
    const sizeQuery = `
      SELECT
        SUM(a.total_pages) * 8 * 1024 AS size_bytes
      FROM sys.tables t
      INNER JOIN sys.partitions p ON t.object_id = p.object_id
      INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
      WHERE t.name = @param0
        AND p.index_id IN (0, 1)
    `;

    const result = await this.adapter.executeQuery<any[]>(sizeQuery, [tableName]);
    return result[0]?.size_bytes || 0;
  }

  /**
   * Get list of all schemas
   */
  async getSchemas(): Promise<string[]> {
    const result = await this.adapter.executeQuery<any[]>(
      'SELECT name FROM sys.schemas ORDER BY name'
    );
    return result.map(row => row.name);
  }
}
