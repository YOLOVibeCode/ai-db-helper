/**
 * IndexAdvisor Implementation
 *
 * Analyzes database schemas and queries to recommend optimal indexes
 * for performance improvement.
 */

import {
  IIndexAdvisor,
  IndexUsageStats,
  QueryPattern,
  DatabaseSchema,
  QueryPlan,
  IndexRecommendation,
  TableSchema
} from '@aidb/contracts';

/**
 * SQL Parser utility for extracting query components
 */
class SQLParser {
  /**
   * Extract table names from query
   */
  extractTables(query: string): string[] {
    const tables: string[] = [];
    const fromMatch = query.match(/FROM\s+(\w+)/gi);
    const joinMatch = query.match(/JOIN\s+(\w+)/gi);

    if (fromMatch) {
      fromMatch.forEach(match => {
        const table = match.replace(/FROM\s+/i, '').trim();
        if (!tables.includes(table)) tables.push(table);
      });
    }

    if (joinMatch) {
      joinMatch.forEach(match => {
        const table = match.replace(/JOIN\s+/i, '').trim();
        if (!tables.includes(table)) tables.push(table);
      });
    }

    return tables;
  }

  /**
   * Extract WHERE clause columns
   */
  extractWhereColumns(query: string, tableName?: string): string[] {
    const columns: string[] = [];
    // Match WHERE clause, stop at ORDER BY, GROUP BY, LIMIT, HAVING, or end
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|\s+HAVING|$)/is);

    if (whereMatch) {
      const whereClause = whereMatch[1].trim();

      // Match patterns: column_name =, table.column_name =, column_name >, etc.
      // This regex captures optional table prefix and column name before operators
      const regex = /(\w+\.)?(\w+)\s*(=|>|<|>=|<=|!=|<>|IN|LIKE|BETWEEN)/gi;
      let match;

      while ((match = regex.exec(whereClause)) !== null) {
        const tablePart = match[1] ? match[1].slice(0, -1) : null; // Remove trailing dot
        const column = match[2];

        // Filter out SQL keywords and comparison values
        const keywords = ['AND', 'OR', 'NOT', 'NULL', 'TRUE', 'FALSE', 'IS'];
        if (keywords.includes(column.toUpperCase())) {
          continue;
        }

        // If table name specified, only include columns from that table
        if (tableName) {
          if (tablePart === tableName || (!tablePart && !columns.includes(column))) {
            if (!columns.includes(column)) {
              columns.push(column);
            }
          }
        } else {
          // No specific table filter - add all columns
          if (!columns.includes(column)) {
            columns.push(column);
          }
        }
      }
    }

    return columns;
  }

  /**
   * Extract JOIN columns
   */
  extractJoinColumns(query: string): Array<{ table: string; column: string }> {
    const joins: Array<{ table: string; column: string }> = [];
    const joinMatches = query.match(/JOIN\s+(\w+)\s+ON\s+(\w+\.\w+)\s*=\s*(\w+\.\w+)/gi);

    if (joinMatches) {
      joinMatches.forEach(match => {
        const parts = match.match(/JOIN\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
        if (parts) {
          joins.push({ table: parts[2], column: parts[3] });
          joins.push({ table: parts[4], column: parts[5] });
        }
      });
    }

    return joins;
  }

  /**
   * Extract ORDER BY columns
   */
  extractOrderByColumns(query: string): string[] {
    const columns: string[] = [];
    const orderMatch = query.match(/ORDER BY\s+(.+?)(?:LIMIT|$)/is);

    if (orderMatch) {
      const orderClause = orderMatch[1];
      const columnMatches = orderClause.match(/(\w+\.)?(\w+)/g);

      if (columnMatches) {
        columnMatches.forEach(match => {
          const parts = match.split('.');
          const column = parts.length > 1 ? parts[1] : parts[0];
          if (!['ASC', 'DESC'].includes(column.toUpperCase()) && !columns.includes(column)) {
            columns.push(column);
          }
        });
      }
    }

    return columns;
  }

  /**
   * Extract GROUP BY columns
   */
  extractGroupByColumns(query: string): string[] {
    const columns: string[] = [];
    const groupMatch = query.match(/GROUP BY\s+(.+?)(?:ORDER BY|LIMIT|$)/is);

    if (groupMatch) {
      const groupClause = groupMatch[1];
      const columnMatches = groupClause.match(/(\w+\.)?(\w+)/g);

      if (columnMatches) {
        columnMatches.forEach(match => {
          const parts = match.split('.');
          const column = parts.length > 1 ? parts[1] : parts[0];
          if (!columns.includes(column)) {
            columns.push(column);
          }
        });
      }
    }

    return columns;
  }

  /**
   * Detect FULLTEXT search
   */
  hasFulltextSearch(query: string): boolean {
    return query.match(/MATCH\s*\(.+?\)\s+AGAINST/i) !== null;
  }
}

export class IndexAdvisor implements IIndexAdvisor {
  private parser: SQLParser;

  constructor() {
    this.parser = new SQLParser();
  }

  /**
   * Analyze schema and recommend indexes
   */
  async analyzeSchema(schema: DatabaseSchema): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    for (const table of schema.tables) {
      // Check for foreign key columns without indexes
      const fkColumns = this.detectForeignKeyColumns(table);
      for (const fkCol of fkColumns) {
        if (!this.hasIndexOnColumn(table, fkCol)) {
          recommendations.push({
            tableName: table.name,
            columns: [fkCol],
            type: 'btree',
            reason: `Foreign key column likely used in JOINs`,
            priority: 'high',
            estimatedImpact: 80,
            createStatement: `CREATE INDEX idx_${table.name}_${fkCol} ON ${table.name}(${fkCol})`
          });
        }
      }

      // Check for common columns that should be indexed
      const commonColumns = ['email', 'username', 'status', 'created_at', 'updated_at'];
      for (const col of table.columns) {
        if (commonColumns.includes(col.name) && !this.hasIndexOnColumn(table, col.name)) {
          recommendations.push({
            tableName: table.name,
            columns: [col.name],
            type: 'btree',
            reason: `Commonly queried column`,
            priority: 'medium',
            estimatedImpact: 60,
            createStatement: `CREATE INDEX idx_${table.name}_${col.name} ON ${table.name}(${col.name})`
          });
        }
      }
    }

    // Limit to most impactful recommendations
    return recommendations
      .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
      .slice(0, 10);
  }

  /**
   * Analyze query and recommend indexes
   */
  async analyzeQuery(query: string, schema: DatabaseSchema): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Handle FULLTEXT search
    if (this.parser.hasFulltextSearch(query)) {
      const tables = this.parser.extractTables(query);
      if (tables.length > 0) {
        const match = query.match(/MATCH\s*\(([^)]+)\)/i);
        if (match) {
          const columns = match[1].split(',').map(c => c.trim());
          recommendations.push({
            tableName: tables[0],
            columns,
            type: 'fulltext',
            reason: 'FULLTEXT search detected',
            priority: 'high',
            estimatedImpact: 95,
            createStatement: `CREATE FULLTEXT INDEX idx_${tables[0]}_ft ON ${tables[0]}(${columns.join(', ')})`
          });
        }
      }
      return recommendations;
    }

    // Analyze WHERE clause
    const tables = this.parser.extractTables(query);
    for (const tableName of tables) {
      const table = schema.tables.find(t => t.name === tableName);
      if (!table) continue;

      const whereColumns = this.parser.extractWhereColumns(query, tableName);

      // Single column indexes
      for (const column of whereColumns) {
        if (!this.hasIndexOnColumn(table, column)) {
          recommendations.push({
            tableName: table.name,
            columns: [column],
            type: 'btree',
            reason: `WHERE clause on ${column}`,
            priority: 'high',
            estimatedImpact: 85,
            createStatement: `CREATE INDEX idx_${table.name}_${column} ON ${table.name}(${column})`
          });
        }
      }

      // Composite indexes for multiple WHERE columns
      if (whereColumns.length > 1) {
        const hasComposite = table.indexes && table.indexes.some(idx =>
          idx.columns.length > 1 &&
          whereColumns.every(col => idx.columns.includes(col))
        );

        if (!hasComposite) {
          recommendations.push({
            tableName: table.name,
            columns: whereColumns,
            type: 'btree',
            reason: `Multiple WHERE columns`,
            priority: 'high',
            estimatedImpact: 90,
            createStatement: `CREATE INDEX idx_${table.name}_${whereColumns.join('_')} ON ${table.name}(${whereColumns.join(', ')})`
          });
        }
      }
    }

    // Analyze JOIN columns
    const joinColumns = this.parser.extractJoinColumns(query);
    for (const join of joinColumns) {
      const table = schema.tables.find(t => t.name === join.table);
      if (table && !this.hasIndexOnColumn(table, join.column)) {
        recommendations.push({
          tableName: join.table,
          columns: [join.column],
          type: 'btree',
          reason: `JOIN condition on ${join.column}`,
          priority: 'high',
          estimatedImpact: 85,
          createStatement: `CREATE INDEX idx_${join.table}_${join.column} ON ${join.table}(${join.column})`
        });
      }
    }

    // Analyze ORDER BY columns
    const orderByColumns = this.parser.extractOrderByColumns(query);
    for (const column of orderByColumns) {
      for (const tableName of tables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (table && table.columns.find(c => c.name === column)) {
          if (!this.hasIndexOnColumn(table, column)) {
            recommendations.push({
              tableName: table.name,
              columns: [column],
              type: 'btree',
              reason: `ORDER BY clause on ${column}`,
              priority: 'medium',
              estimatedImpact: 70,
              createStatement: `CREATE INDEX idx_${table.name}_${column} ON ${table.name}(${column})`
            });
          }
        }
      }
    }

    // Remove duplicates and return
    return this.deduplicateRecommendations(recommendations);
  }

  /**
   * Analyze query plan and recommend indexes
   */
  async analyzePlan(plan: QueryPlan, schema: DatabaseSchema): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Use suggested indexes from plan
    for (const suggestion of plan.suggestedIndexes) {
      recommendations.push({
        tableName: suggestion.tableName,
        columns: suggestion.columns,
        type: suggestion.type,
        reason: suggestion.reason,
        priority: suggestion.priority,
        estimatedImpact: suggestion.estimatedImprovement,
        createStatement: suggestion.createStatement
      });
    }

    // Analyze warnings for additional recommendations
    for (const warning of plan.warnings) {
      if (warning.code === 'FULL_TABLE_SCAN') {
        // Try to get table name from affectedTable or extract from message
        let tableName = warning.affectedTable;
        if (!tableName && warning.message) {
          // Extract table name from message like "Full table scan on posts (50000 rows)"
          const match = warning.message.match(/table scan on (\w+)/i);
          if (match) {
            tableName = match[1];
          }
        }

        if (tableName) {
          const table = schema.tables.find(t => t.name === tableName);
          if (table && table.rowCount && table.rowCount > 1000) {
            // High priority for large tables
            const whereColumns = this.parser.extractWhereColumns(plan.originalQuery, tableName);
            for (const column of whereColumns) {
              if (!this.hasIndexOnColumn(table, column)) {
                recommendations.push({
                  tableName,
                  columns: [column],
                  type: 'btree',
                  reason: `Full table scan on large table (${table.rowCount} rows)`,
                  priority: 'high',
                  estimatedImpact: 90,
                  createStatement: `CREATE INDEX idx_${tableName}_${column} ON ${tableName}(${column})`
                });
              }
            }
          }
        }
      }
    }

    return this.deduplicateRecommendations(recommendations);
  }

  /**
   * Analyze multiple queries to find common patterns
   */
  async analyzeQueryPatterns(
    queries: string[],
    schema: DatabaseSchema
  ): Promise<{ patterns: QueryPattern[]; recommendations: IndexRecommendation[] }> {
    const patternMap = new Map<string, QueryPattern>();

    // Analyze each query
    for (const query of queries) {
      const tables = this.parser.extractTables(query);
      const whereColumns = this.parser.extractWhereColumns(query);
      const joinColumns = this.parser.extractJoinColumns(query).map(j => j.column);
      const orderByColumns = this.parser.extractOrderByColumns(query);
      const groupByColumns = this.parser.extractGroupByColumns(query);

      // Create pattern key
      const key = `${tables.join(',')}_${whereColumns.sort().join(',')}_${joinColumns.sort().join(',')}`;

      if (patternMap.has(key)) {
        const pattern = patternMap.get(key)!;
        pattern.frequency++;
      } else {
        patternMap.set(key, {
          tables,
          whereColumns,
          joinColumns,
          orderByColumns,
          groupByColumns,
          frequency: 1
        });
      }
    }

    const patterns = Array.from(patternMap.values());
    const recommendations: IndexRecommendation[] = [];

    // Generate recommendations based on frequency
    for (const pattern of patterns) {
      if (pattern.frequency >= 2) {
        // Recommend indexes for frequently used columns
        for (const tableName of pattern.tables) {
          const table = schema.tables.find(t => t.name === tableName);
          if (!table) continue;

          for (const column of pattern.whereColumns) {
            if (table.columns.find(c => c.name === column) && !this.hasIndexOnColumn(table, column)) {
              recommendations.push({
                tableName: table.name,
                columns: [column],
                type: 'btree',
                reason: `Frequently queried column (${pattern.frequency} times)`,
                priority: pattern.frequency >= 3 ? 'high' : 'medium',
                estimatedImpact: Math.min(95, 50 + pattern.frequency * 10),
                usageCount: pattern.frequency,
                createStatement: `CREATE INDEX idx_${table.name}_${column} ON ${table.name}(${column})`
              });
            }
          }
        }
      }
    }

    return {
      patterns,
      recommendations: this.deduplicateRecommendations(recommendations)
    };
  }

  /**
   * Find redundant indexes
   */
  async findRedundantIndexes(
    schema: DatabaseSchema
  ): Promise<{ redundantIndexes: IndexUsageStats[]; potentialSavings: string }> {
    const redundantIndexes: IndexUsageStats[] = [];
    let totalSavingsBytes = 0;

    for (const table of schema.tables) {
      const indexes = table.indexes || [];

      for (let i = 0; i < indexes.length; i++) {
        const idx1 = indexes[i];

        for (let j = i + 1; j < indexes.length; j++) {
          const idx2 = indexes[j];

          // Check if idx2 is redundant with idx1 (idx2 came later)
          if (this.isIndexRedundant(idx2.columns, idx1.columns)) {
            const estimatedSize = this.estimateIndexSize(table, idx2.columns);
            totalSavingsBytes += estimatedSize;

            redundantIndexes.push({
              indexName: idx2.name,
              table: table.name,
              columns: idx2.columns,
              usageCount: 0,
              selectivity: 0.5,
              cardinality: 0,
              isRedundant: true,
              redundantWith: idx1.name
            });
          }
          // Also check if idx1 is redundant with idx2 (for composite index cases)
          else if (this.isIndexRedundant(idx1.columns, idx2.columns)) {
            const estimatedSize = this.estimateIndexSize(table, idx1.columns);
            totalSavingsBytes += estimatedSize;

            redundantIndexes.push({
              indexName: idx1.name,
              table: table.name,
              columns: idx1.columns,
              usageCount: 0,
              selectivity: 0.5,
              cardinality: 0,
              isRedundant: true,
              redundantWith: idx2.name
            });
          }
        }
      }
    }

    const savingsMB = (totalSavingsBytes / (1024 * 1024)).toFixed(2);
    return {
      redundantIndexes,
      potentialSavings: `${savingsMB} MB`
    };
  }

  /**
   * Find unused indexes
   */
  async findUnusedIndexes(
    _schema: DatabaseSchema,
    usageStats: IndexUsageStats[] = []
  ): Promise<IndexUsageStats[]> {
    const unused: IndexUsageStats[] = [];
    const recentThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    for (const stats of usageStats) {
      // Don't flag as unused if used recently (within 24 hours)
      if (stats.lastUsed && stats.lastUsed > recentThreshold) {
        continue;
      }

      // Only flag as unused if usage count is zero AND hasn't been used recently
      if (stats.usageCount === 0 && (!stats.lastUsed || stats.lastUsed <= recentThreshold)) {
        unused.push(stats);
      }
    }

    return unused;
  }

  /**
   * Estimate impact of adding an index
   */
  async estimateIndexImpact(
    recommendation: IndexRecommendation,
    schema: DatabaseSchema
  ): Promise<{
    improvementPercent: number;
    diskSpaceRequired: number;
    maintenanceOverhead: string;
  }> {
    const table = schema.tables.find(t => t.name === recommendation.tableName);

    if (!table) {
      return {
        improvementPercent: 0,
        diskSpaceRequired: 0,
        maintenanceOverhead: 'Unknown'
      };
    }

    // Estimate improvement based on table size and selectivity
    const rowCount = table.rowCount || 1000;
    let improvementPercent = recommendation.estimatedImpact;

    // Adjust based on table size
    if (rowCount > 100000) {
      improvementPercent = Math.min(95, improvementPercent + 10);
    } else if (rowCount < 1000) {
      improvementPercent = Math.max(20, improvementPercent - 20);
    }

    // Estimate disk space (rough estimate)
    const diskSpaceRequired = this.estimateIndexSize(table, recommendation.columns);

    // Maintenance overhead
    const overhead = recommendation.columns.length > 2
      ? 'High - composite index will slow INSERT/UPDATE operations'
      : 'Low - single-column index has minimal INSERT/UPDATE impact';

    return {
      improvementPercent: Math.round(improvementPercent),
      diskSpaceRequired,
      maintenanceOverhead: overhead
    };
  }

  /**
   * Generate optimal index set for workload
   */
  async generateOptimalIndexSet(
    queries: string[],
    schema: DatabaseSchema,
    maxIndexes?: number
  ): Promise<IndexRecommendation[]> {
    const allRecommendations: IndexRecommendation[] = [];

    // Analyze query patterns
    const { recommendations } = await this.analyzeQueryPatterns(queries, schema);
    allRecommendations.push(...recommendations);

    // Analyze individual queries
    for (const query of queries) {
      const queryRecs = await this.analyzeQuery(query, schema);
      allRecommendations.push(...queryRecs);
    }

    // Deduplicate and sort by priority and impact
    const deduplicated = this.deduplicateRecommendations(allRecommendations);

    // Sort by usage frequency and estimated impact
    const sorted = deduplicated.sort((a, b) => {
      const scoreA = (a.usageCount || 1) * a.estimatedImpact;
      const scoreB = (b.usageCount || 1) * b.estimatedImpact;
      return scoreB - scoreA;
    });

    // Limit to maxIndexes if specified
    if (maxIndexes) {
      return sorted.slice(0, maxIndexes);
    }

    return sorted;
  }

  // Helper methods

  private detectForeignKeyColumns(table: TableSchema): string[] {
    const fkColumns: string[] = [];

    // Check constraints for foreign keys
    if (table.constraints) {
      for (const constraint of table.constraints) {
        if (constraint.type === 'FOREIGN KEY' && constraint.columns) {
          fkColumns.push(...constraint.columns);
        }
      }
    }

    // Also check for common naming patterns (id suffix)
    for (const col of table.columns) {
      if (col.name.endsWith('_id') && col.name !== 'id' && !fkColumns.includes(col.name)) {
        fkColumns.push(col.name);
      }
    }

    return fkColumns;
  }

  private hasIndexOnColumn(table: TableSchema, columnName: string): boolean {
    if (!table.indexes) return false;

    return table.indexes.some(idx =>
      idx.columns.includes(columnName) ||
      (idx.columns.length === 1 && idx.columns[0] === columnName)
    );
  }

  private isIndexRedundant(columns1: string[], columns2: string[]): boolean {
    // An index is redundant if:
    // 1. It's identical to another index (same columns in same order)
    // 2. It's a prefix of another index (covered by the other index)

    // Check if identical
    if (columns1.length === columns2.length) {
      return columns1.every((col, i) => col === columns2[i]);
    }

    // Check if columns1 is a prefix of columns2
    if (columns1.length < columns2.length) {
      for (let i = 0; i < columns1.length; i++) {
        if (columns1[i] !== columns2[i]) return false;
      }
      return true;
    }

    return false;
  }

  private estimateIndexSize(table: TableSchema, columns: string[]): number {
    const rowCount = table.rowCount || 1000;
    const avgColumnSize = 50; // bytes
    const indexOverhead = 10; // bytes per row

    return columns.length * avgColumnSize * rowCount + (indexOverhead * rowCount);
  }

  private deduplicateRecommendations(recommendations: IndexRecommendation[]): IndexRecommendation[] {
    const seen = new Map<string, IndexRecommendation>();

    for (const rec of recommendations) {
      const key = `${rec.tableName}_${rec.columns.sort().join('_')}`;

      if (!seen.has(key)) {
        seen.set(key, rec);
      } else {
        // Keep the one with higher impact
        const existing = seen.get(key)!;
        if (rec.estimatedImpact > existing.estimatedImpact) {
          seen.set(key, rec);
        }
      }
    }

    return Array.from(seen.values());
  }
}
