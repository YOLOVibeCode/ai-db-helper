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
import { OracleAdapter } from './OracleAdapter';

/**
 * Oracle Schema Extractor
 * Extracts complete schema information from Oracle databases
 */
export class OracleSchemaExtractor implements ISchemaExtractor {
  constructor(private adapter: OracleAdapter) {}

  /**
   * Extract all tables from database
   */
  async extractTables(filter?: TableFilter): Promise<TableSchema[]> {
    const tablesQuery = `
      SELECT
        t.TABLE_NAME,
        t.OWNER,
        NVL(s.NUM_ROWS, 0) AS row_count,
        NVL(s.BLOCKS * 8192, 0) AS size_bytes
      FROM ALL_TABLES t
      LEFT JOIN ALL_TAB_STATISTICS s ON t.TABLE_NAME = s.TABLE_NAME AND t.OWNER = s.OWNER
      WHERE t.OWNER = USER
      ORDER BY t.TABLE_NAME
    `;

    const tables = await this.adapter.executeQuery<any[]>(tablesQuery);
    const tableSchemas: TableSchema[] = [];

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const schemaName = table.OWNER;

      // Apply filter
      if (filter?.includeTables && !filter.includeTables.includes(tableName)) {
        continue;
      }
      if (filter?.excludeTables && filter.excludeTables.includes(tableName)) {
        continue;
      }

      const columns = await this.extractTableColumns(tableName);
      const primaryKey = await this.extractPrimaryKey(tableName);
      const indexes = await this.extractIndexes(tableName);
      const constraints = await this.extractConstraints(tableName);

      tableSchemas.push({
        name: tableName,
        schema: schemaName,
        columns,
        primaryKey,
        indexes,
        constraints,
        rowCount: Number(table.row_count) || 0,
        sizeBytes: Number(table.size_bytes) || 0,
      });
    }

    return tableSchemas;
  }

  /**
   * Extract columns for a specific table
   */
  private async extractTableColumns(tableName: string): Promise<ColumnSchema[]> {
    const columnsQuery = `
      SELECT
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.DATA_LENGTH,
        c.DATA_PRECISION,
        c.DATA_SCALE,
        c.NULLABLE,
        c.DATA_DEFAULT,
        com.COMMENTS
      FROM ALL_TAB_COLUMNS c
      LEFT JOIN ALL_COL_COMMENTS com
        ON c.TABLE_NAME = com.TABLE_NAME
        AND c.COLUMN_NAME = com.COLUMN_NAME
        AND c.OWNER = com.OWNER
      WHERE c.TABLE_NAME = :1
        AND c.OWNER = USER
      ORDER BY c.COLUMN_ID
    `;

    const columns = await this.adapter.executeQuery<any[]>(columnsQuery, [tableName]);

    return columns.map(col => ({
      name: col.COLUMN_NAME,
      dataType: col.DATA_TYPE,
      nativeType: col.DATA_TYPE,
      nullable: col.NULLABLE === 'Y',
      defaultValue: col.DATA_DEFAULT?.trim() || undefined,
      autoIncrement: false, // Oracle uses sequences, not auto-increment
      comment: col.COMMENTS || undefined,
      maxLength: col.DATA_LENGTH || undefined,
      precision: col.DATA_PRECISION || undefined,
      scale: col.DATA_SCALE || undefined
    }));
  }

  /**
   * Extract primary key information
   */
  private async extractPrimaryKey(tableName: string): Promise<PrimaryKeySchema | undefined> {
    const pkQuery = `
      SELECT
        c.CONSTRAINT_NAME,
        cc.COLUMN_NAME
      FROM ALL_CONSTRAINTS c
      INNER JOIN ALL_CONS_COLUMNS cc
        ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
        AND c.OWNER = cc.OWNER
      WHERE c.TABLE_NAME = :1
        AND c.OWNER = USER
        AND c.CONSTRAINT_TYPE = 'P'
      ORDER BY cc.POSITION
    `;

    const pkColumns = await this.adapter.executeQuery<any[]>(pkQuery, [tableName]);

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
        i.TABLE_NAME,
        i.TABLE_OWNER,
        i.INDEX_NAME,
        i.UNIQUENESS,
        ic.COLUMN_NAME,
        i.INDEX_TYPE
      FROM ALL_INDEXES i
      INNER JOIN ALL_IND_COLUMNS ic
        ON i.INDEX_NAME = ic.INDEX_NAME
        AND i.OWNER = ic.INDEX_OWNER
      WHERE i.OWNER = USER
        AND NOT EXISTS (
          SELECT 1 FROM ALL_CONSTRAINTS c
          WHERE c.INDEX_NAME = i.INDEX_NAME
            AND c.CONSTRAINT_TYPE = 'P'
        )
    `;

    const params: any[] = [];
    if (tableName) {
      indexQuery += ' AND i.TABLE_NAME = :1';
      params.push(tableName);
    }

    indexQuery += ' ORDER BY i.TABLE_NAME, i.INDEX_NAME, ic.COLUMN_POSITION';

    const indexRows = await this.adapter.executeQuery<any[]>(indexQuery, params);

    // Group by index name
    const indexMap = new Map<string, IndexSchema>();

    for (const row of indexRows) {
      const key = `${row.TABLE_OWNER}.${row.TABLE_NAME}.${row.INDEX_NAME}`;

      if (!indexMap.has(key)) {
        indexMap.set(key, {
          name: row.INDEX_NAME,
          tableName: `${row.TABLE_OWNER}.${row.TABLE_NAME}`,
          columns: [],
          unique: row.UNIQUENESS === 'UNIQUE',
          type: this.mapIndexType(row.INDEX_TYPE),
        });
      }

      indexMap.get(key)!.columns.push(row.COLUMN_NAME);
    }

    return Array.from(indexMap.values());
  }

  /**
   * Map Oracle index type to our IndexType enum
   */
  private mapIndexType(oracleType: string): IndexType {
    switch (oracleType?.toUpperCase()) {
      case 'NORMAL':
      case 'NORMAL/REV':
        return IndexType.BTree;
      case 'BITMAP':
        return IndexType.Hash;
      case 'FUNCTION-BASED NORMAL':
        return IndexType.BTree;
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
        c.TABLE_NAME,
        c.OWNER,
        c.CONSTRAINT_NAME,
        c.CONSTRAINT_TYPE,
        cc.COLUMN_NAME,
        rc.TABLE_NAME AS ref_table,
        rcc.COLUMN_NAME AS ref_column,
        c.DELETE_RULE
      FROM ALL_CONSTRAINTS c
      INNER JOIN ALL_CONS_COLUMNS cc
        ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
        AND c.OWNER = cc.OWNER
      LEFT JOIN ALL_CONSTRAINTS rc
        ON c.R_CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND c.R_OWNER = rc.OWNER
      LEFT JOIN ALL_CONS_COLUMNS rcc
        ON rc.CONSTRAINT_NAME = rcc.CONSTRAINT_NAME
        AND rc.OWNER = rcc.OWNER
        AND cc.POSITION = rcc.POSITION
      WHERE c.OWNER = USER
        AND c.CONSTRAINT_TYPE = 'R'
    `;

    const params: any[] = [];
    if (tableName) {
      constraintQuery += ' AND c.TABLE_NAME = :1';
      params.push(tableName);
    }

    constraintQuery += ' ORDER BY c.TABLE_NAME, c.CONSTRAINT_NAME, cc.POSITION';

    const constraints = await this.adapter.executeQuery<any[]>(constraintQuery, params);

    // Group by constraint name to handle multi-column foreign keys
    const constraintMap = new Map<string, ConstraintSchema>();

    for (const c of constraints) {
      const key = `${c.OWNER}.${c.TABLE_NAME}.${c.CONSTRAINT_NAME}`;

      if (!constraintMap.has(key)) {
        constraintMap.set(key, {
          name: c.CONSTRAINT_NAME,
          type: ConstraintType.ForeignKey,
          tableName: `${c.OWNER}.${c.TABLE_NAME}`,
          columns: [],
          referencedTable: c.ref_table,
          referencedColumns: [],
          onDelete: this.mapReferentialAction(c.DELETE_RULE),
          onUpdate: ReferentialAction.NoAction, // Oracle doesn't support ON UPDATE CASCADE
        });
      }

      constraintMap.get(key)!.columns.push(c.COLUMN_NAME);
      if (c.ref_column) {
        constraintMap.get(key)!.referencedColumns!.push(c.ref_column);
      }
    }

    return Array.from(constraintMap.values());
  }

  /**
   * Map Oracle referential action to our enum
   */
  private mapReferentialAction(action: string): ReferentialAction {
    switch (action?.toUpperCase()) {
      case 'CASCADE':
        return ReferentialAction.Cascade;
      case 'SET NULL':
        return ReferentialAction.SetNull;
      case 'NO ACTION':
      default:
        return ReferentialAction.NoAction;
    }
  }

  /**
   * Extract all views
   */
  async extractViews(): Promise<ViewSchema[]> {
    const viewsQuery = `
      SELECT
        VIEW_NAME,
        OWNER,
        TEXT
      FROM ALL_VIEWS
      WHERE OWNER = USER
      ORDER BY VIEW_NAME
    `;

    const views = await this.adapter.executeQuery<any[]>(viewsQuery);

    const viewSchemas: ViewSchema[] = [];

    for (const view of views) {
      const columns = await this.extractTableColumns(view.VIEW_NAME);

      viewSchemas.push({
        name: view.VIEW_NAME,
        schema: view.OWNER,
        definition: view.TEXT,
        columns
      });
    }

    return viewSchemas;
  }

  /**
   * Extract stored procedures
   */
  async extractStoredProcedures(): Promise<ProcedureSchema[]> {
    const proceduresQuery = `
      SELECT
        OBJECT_NAME,
        OWNER,
        CREATED,
        LAST_DDL_TIME
      FROM ALL_OBJECTS
      WHERE OBJECT_TYPE = 'PROCEDURE'
        AND OWNER = USER
      ORDER BY OBJECT_NAME
    `;

    const procedures = await this.adapter.executeQuery<any[]>(proceduresQuery);

    return procedures.map(p => ({
      name: p.OBJECT_NAME,
      schema: p.OWNER,
      definition: undefined, // Oracle requires separate queries to get procedure body
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
    return result[0].count || result[0].COUNT;
  }

  /**
   * Get table size in bytes
   */
  async getTableSize(tableName: string): Promise<number> {
    const sizeQuery = `
      SELECT
        NVL(s.BLOCKS * 8192, 0) AS size_bytes
      FROM ALL_TAB_STATISTICS s
      WHERE s.TABLE_NAME = :1
        AND s.OWNER = USER
    `;

    const result = await this.adapter.executeQuery<any[]>(sizeQuery, [tableName]);
    return Number(result[0]?.size_bytes || result[0]?.SIZE_BYTES || 0);
  }

  /**
   * Get list of all schemas
   */
  async getSchemas(): Promise<string[]> {
    const result = await this.adapter.executeQuery<any[]>(
      'SELECT username FROM all_users ORDER BY username'
    );
    return result.map(row => row.username || row.USERNAME);
  }
}
