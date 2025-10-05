/**
 * QueryExecutor Implementation
 * Executes SQL queries with safety checks and validation
 */

import {
  IQueryExecutor,
  QueryResult,
  QueryExecutionOptions,
  QueryValidation,
  QueryType,
  IDatabaseAdapter,
  DatabaseSchema
} from '@aidb/contracts';

export class QueryExecutor implements IQueryExecutor {
  private adapter?: IDatabaseAdapter;
  private schema?: DatabaseSchema;

  /**
   * Set the database adapter
   */
  setAdapter(adapter: IDatabaseAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Set the database schema for validation
   */
  setSchema(schema: DatabaseSchema): void {
    this.schema = schema;
  }

  /**
   * Execute a SQL query
   */
  async execute<T = any>(
    sql: string,
    options: QueryExecutionOptions = {}
  ): Promise<QueryResult<T>> {
    if (!this.adapter) {
      throw new Error('Database adapter not set');
    }

    const startTime = Date.now();

    // Validate query first
    const validation = await this.validate(sql);

    if (!validation.isValid) {
      throw new Error(`Invalid SQL: ${validation.errors.join(', ')}`);
    }

    // Dry run - don't execute
    if (options.dryRun) {
      return {
        rows: [] as T[],
        rowCount: 0,
        affectedRows: 0,
        executionTimeMs: Date.now() - startTime,
        query: sql
      };
    }

    // Apply limit for SELECT queries
    let finalSql = sql;
    if (validation.queryType === QueryType.SELECT && options.limit) {
      finalSql = this.applyLimit(sql, options.limit);
    }

    // Execute query
    try {
      const result = await this.adapter.executeQuery<any>(finalSql, options.params);

      const executionTimeMs = Date.now() - startTime;

      // Handle different result formats
      if (Array.isArray(result)) {
        // SELECT query
        return {
          rows: result as T[],
          rowCount: result.length,
          executionTimeMs,
          query: finalSql
        };
      } else if (result && typeof result === 'object' && 'affectedRows' in result) {
        // INSERT/UPDATE/DELETE query
        return {
          rows: [] as T[],
          rowCount: 0,
          affectedRows: result.affectedRows,
          executionTimeMs,
          query: finalSql
        };
      } else {
        // Unknown result format
        return {
          rows: [] as T[],
          rowCount: 0,
          executionTimeMs,
          query: finalSql
        };
      }
    } catch (error) {
      const err = error as Error;
      throw new Error(`Query execution failed: ${err.message}`);
    }
  }

  /**
   * Validate a SQL query without executing
   */
  async validate(sql: string): Promise<QueryValidation> {
    // Detect query type
    const queryType = this.detectQueryType(sql);

    // Extract tables
    const tables = this.extractTables(sql);

    // Check for dangerous operations
    const isDangerous = this.isDangerousQuery(sql, queryType);

    // Validate syntax (basic)
    const syntaxErrors = this.validateSyntax(sql);

    // Check warnings
    const warnings: string[] = [];

    if (queryType === QueryType.DELETE && !sql.toUpperCase().includes('WHERE')) {
      warnings.push('DELETE without WHERE clause affects all rows');
    }

    if (queryType === QueryType.UPDATE && !sql.toUpperCase().includes('WHERE')) {
      warnings.push('UPDATE without WHERE clause affects all rows');
    }

    // Validate tables exist in schema
    if (this.schema) {
      const schemaTableNames = this.schema.tables.map(t => t.name.toLowerCase());
      for (const table of tables) {
        if (!schemaTableNames.includes(table.toLowerCase())) {
          warnings.push(`Table '${table}' not found in schema`);
        }
      }
    }

    return {
      isValid: syntaxErrors.length === 0,
      queryType,
      isDangerous,
      tables,
      errors: syntaxErrors,
      warnings
    };
  }

  /**
   * Execute multiple queries in a batch
   */
  async executeBatch(
    queries: string[],
    options: QueryExecutionOptions = {}
  ): Promise<QueryResult[]> {
    if (!this.adapter) {
      throw new Error('Database adapter not set');
    }

    const results: QueryResult[] = [];

    // If transaction is requested, wrap in BEGIN/COMMIT
    if (options.transaction) {
      try {
        await this.adapter.executeQuery('BEGIN');

        for (const query of queries) {
          const result = await this.execute(query, { ...options, transaction: false });
          results.push(result);
        }

        await this.adapter.executeQuery('COMMIT');
      } catch (error) {
        await this.adapter.executeQuery('ROLLBACK');
        throw error;
      }
    } else {
      for (const query of queries) {
        const result = await this.execute(query, options);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Detect query type
   */
  private detectQueryType(sql: string): QueryType {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith('SELECT')) return QueryType.SELECT;
    if (trimmed.startsWith('INSERT')) return QueryType.INSERT;
    if (trimmed.startsWith('UPDATE')) return QueryType.UPDATE;
    if (trimmed.startsWith('DELETE')) return QueryType.DELETE;
    if (
      trimmed.startsWith('CREATE') ||
      trimmed.startsWith('ALTER') ||
      trimmed.startsWith('DROP') ||
      trimmed.startsWith('TRUNCATE')
    ) {
      return QueryType.DDL;
    }

    return QueryType.UNKNOWN;
  }

  /**
   * Extract table names from SQL
   */
  private extractTables(sql: string): string[] {
    const tables: string[] = [];

    // Basic regex to extract table names (simplified)
    // FROM clause
    const fromMatch = sql.match(/FROM\s+(\w+)/gi);
    if (fromMatch) {
      fromMatch.forEach(match => {
        const tableName = match.replace(/FROM\s+/i, '').trim();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      });
    }

    // JOIN clause
    const joinMatch = sql.match(/JOIN\s+(\w+)/gi);
    if (joinMatch) {
      joinMatch.forEach(match => {
        const tableName = match.replace(/JOIN\s+/i, '').trim();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      });
    }

    // INTO clause
    const intoMatch = sql.match(/INTO\s+(\w+)/gi);
    if (intoMatch) {
      intoMatch.forEach(match => {
        const tableName = match.replace(/INTO\s+/i, '').trim();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      });
    }

    // UPDATE clause
    const updateMatch = sql.match(/UPDATE\s+(\w+)/gi);
    if (updateMatch) {
      updateMatch.forEach(match => {
        const tableName = match.replace(/UPDATE\s+/i, '').trim();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      });
    }

    // ALTER TABLE clause
    const alterMatch = sql.match(/ALTER\s+TABLE\s+(\w+)/gi);
    if (alterMatch) {
      alterMatch.forEach(match => {
        const tableName = match.replace(/ALTER\s+TABLE\s+/i, '').trim();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      });
    }

    return tables;
  }

  /**
   * Check if query is dangerous
   */
  private isDangerousQuery(sql: string, queryType: QueryType): boolean {
    const upper = sql.toUpperCase();

    // DDL is always dangerous
    if (queryType === QueryType.DDL) {
      return true;
    }

    // DELETE/UPDATE without WHERE
    if (
      (queryType === QueryType.DELETE || queryType === QueryType.UPDATE) &&
      !upper.includes('WHERE')
    ) {
      return true;
    }

    // TRUNCATE
    if (upper.includes('TRUNCATE')) {
      return true;
    }

    return false;
  }

  /**
   * Validate SQL syntax (basic)
   */
  private validateSyntax(sql: string): string[] {
    const errors: string[] = [];

    // Basic syntax checks
    const trimmed = sql.trim().toUpperCase();

    // Check for common typos
    if (trimmed.startsWith('SELEC ') || trimmed.startsWith('SELCT ')) {
      errors.push('Invalid SQL: Did you mean SELECT?');
    }

    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses');
    }

    // Check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push('Unbalanced single quotes');
    }

    return errors;
  }

  /**
   * Apply LIMIT clause to SELECT query
   */
  private applyLimit(sql: string, limit: number): string {
    const upper = sql.toUpperCase();

    // Check if LIMIT already exists
    if (upper.includes('LIMIT')) {
      return sql;
    }

    // Add LIMIT
    return `${sql.trim()} LIMIT ${limit}`;
  }
}
