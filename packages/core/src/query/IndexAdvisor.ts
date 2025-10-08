/**
 * IndexAdvisor - Recommend and analyze database indexes
 *
 * Features:
 * - Analyze schema for missing indexes
 * - Analyze queries for index opportunities
 * - Detect redundant and unused indexes
 * - Estimate index impact
 * - Generate optimal index set for workload
 */

import {
  IIndexAdvisor,
  DatabaseSchema,
  TableSchema,
  IndexRecommendation,
  QueryPlan,
  IndexUsageStats,
  QueryPattern
} from '@aidb/contracts';

export class IndexAdvisor implements IIndexAdvisor {
  /**
   * Analyze schema and recommend indexes
   */
  async analyzeSchema(schema: DatabaseSchema): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    for (const table of schema.tables) {
      // Skip very small tables (< 100 rows)
      if (table.rowCount !== undefined && table.rowCount < 100) {
        continue;
      }

      // Check for missing indexes on foreign key columns
      const fkRecommendations = this.analyzeForeignKeys(table);
      recommendations.push(...fkRecommendations);

      // Check for high-cardinality columns without indexes
      const cardinalityRecs = this.analyzeCardinality(table);
      recommendations.push(...cardinalityRecs);
    }

    return recommendations;
  }

  /**
   * Analyze foreign key columns for missing indexes
   */
  private analyzeForeignKeys(table: TableSchema): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    const existingIndexColumns = new Set(
      table.indexes.flatMap(idx => idx.columns)
    );

    for (const constraint of table.constraints) {
      if (constraint.type === 'FOREIGN KEY' && constraint.columns) {
        for (const column of constraint.columns) {
          // Check if column already has an index
          if (!existingIndexColumns.has(column)) {
            recommendations.push({
              tableName: table.name,
              columns: [column],
              type: 'btree',
              reason: `Foreign key column without index - impacts JOIN performance`,
              priority: 'high',
              estimatedImpact: 70,
              createStatement: this.generateCreateIndexSQL(table.name, [column])
            });
          }
        }
      }
    }

    return recommendations;
  }

  /**
   * Analyze column cardinality for index opportunities
   */
  private analyzeCardinality(table: TableSchema): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    const existingIndexColumns = new Set(
      table.indexes.flatMap(idx => idx.columns)
    );

    // Look for likely high-cardinality columns (email, uuid, etc.)
    const highCardinalityPatterns = ['email', 'uuid', 'guid', 'token', 'code'];

    for (const column of table.columns) {
      if (existingIndexColumns.has(column.name)) {
        continue; // Already indexed
      }

      // Check column name patterns
      const columnNameLower = column.name.toLowerCase();
      const isHighCardinality = highCardinalityPatterns.some(
        pattern => columnNameLower.includes(pattern)
      );

      if (isHighCardinality) {
          recommendations.push({
            tableName: table.name,
          columns: [column.name],
            type: 'btree',
          reason: `High-cardinality column (${column.name}) likely used in WHERE clauses`,
            priority: 'medium',
            estimatedImpact: 60,
          createStatement: this.generateCreateIndexSQL(table.name, [column.name])
          });
      }
    }

    return recommendations;
  }

  /**
   * Analyze query and recommend indexes
   */
  async analyzeQuery(query: string, schema: DatabaseSchema): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    const parsedQuery = this.parseQuery(query);

    for (const table of parsedQuery.tables) {
      const tableSchema = schema.tables.find(t => t.name === table);
      if (!tableSchema) continue;

      const existingIndexColumns = new Set(
        tableSchema.indexes.flatMap(idx => idx.columns)
      );

      // Recommend indexes for WHERE clause columns
      for (const column of parsedQuery.whereColumns) {
        if (!existingIndexColumns.has(column)) {
          recommendations.push({
            tableName: table,
            columns: [column],
            type: 'btree',
            reason: `WHERE clause filtering on ${column}`,
            priority: 'high',
            estimatedImpact: 75,
            createStatement: this.generateCreateIndexSQL(table, [column])
          });
        }
      }

      // Recommend indexes for JOIN columns
      for (const column of parsedQuery.joinColumns) {
        if (!existingIndexColumns.has(column)) {
          recommendations.push({
            tableName: table,
            columns: [column],
            type: 'btree',
            reason: `JOIN condition on ${column}`,
            priority: 'high',
            estimatedImpact: 80,
            createStatement: this.generateCreateIndexSQL(table, [column])
          });
        }
      }

      // Recommend composite index for WHERE + ORDER BY
      if (parsedQuery.whereColumns.length > 0 && parsedQuery.orderByColumns.length > 0) {
        const compositeColumns = [...parsedQuery.whereColumns, ...parsedQuery.orderByColumns];
        const hasCompositeIndex = tableSchema.indexes.some(idx => 
          idx.columns.length > 1 &&
          compositeColumns.every(col => idx.columns.includes(col))
        );

        if (!hasCompositeIndex) {
          recommendations.push({
            tableName: table,
            columns: compositeColumns,
            type: 'btree',
            reason: `Composite index for WHERE + ORDER BY optimization`,
            priority: 'medium',
            estimatedImpact: 65,
            createStatement: this.generateCreateIndexSQL(table, compositeColumns)
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Simple SQL query parser
   */
  private parseQuery(query: string): QueryPattern {
    const queryLower = query.toLowerCase();
    
    const pattern: QueryPattern = {
      tables: [],
      whereColumns: [],
      joinColumns: [],
      orderByColumns: [],
      groupByColumns: [],
      frequency: 1
    };

    // Extract tables
    const fromMatch = queryLower.match(/from\s+(\w+)/);
    if (fromMatch) {
      pattern.tables.push(fromMatch[1]);
    }

    const joinMatches = queryLower.matchAll(/join\s+(\w+)/g);
    for (const match of joinMatches) {
      pattern.tables.push(match[1]);
    }

    // Extract WHERE columns (simplified)
    const whereMatch = queryLower.match(/where\s+(.+?)(?:order\s+by|group\s+by|limit|$)/);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnMatches = whereClause.matchAll(/(\w+)\s*[=<>]/g);
      for (const match of columnMatches) {
        pattern.whereColumns.push(match[1]);
      }
    }

    // Extract JOIN columns
    const joinCondMatches = queryLower.matchAll(/on\s+\w+\.(\w+)\s*=\s*\w+\.(\w+)/g);
    for (const match of joinCondMatches) {
      pattern.joinColumns.push(match[1], match[2]);
    }

    // Extract ORDER BY columns
    const orderByMatch = queryLower.match(/order\s+by\s+(.+?)(?:limit|$)/);
    if (orderByMatch) {
      const orderCols = orderByMatch[1].split(',');
      for (const col of orderCols) {
        const colMatch = col.trim().match(/(\w+)/);
        if (colMatch) {
          pattern.orderByColumns.push(colMatch[1]);
        }
      }
    }

    // Extract GROUP BY columns
    const groupByMatch = queryLower.match(/group\s+by\s+(.+?)(?:order\s+by|limit|$)/);
    if (groupByMatch) {
      const groupCols = groupByMatch[1].split(',');
      for (const col of groupCols) {
        const colMatch = col.trim().match(/(\w+)/);
        if (colMatch) {
          pattern.groupByColumns.push(colMatch[1]);
        }
      }
    }

    return pattern;
  }

  /**
   * Analyze query plan and recommend indexes
   */
  async analyzePlan(plan: QueryPlan, schema: DatabaseSchema): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Analyze warnings for index opportunities
    for (const warning of plan.warnings) {
      if (warning.code === 'FULL_TABLE_SCAN' && warning.affectedTable) {
        const table = schema.tables.find(t => t.name === warning.affectedTable);
        if (table) {
          // Recommend index based on query structure
          const queryRecs = await this.analyzeQuery(plan.originalQuery, schema);
          recommendations.push(...queryRecs);
        }
      }
    }

    return recommendations;
  }

  /**
   * Analyze multiple queries to find common patterns
   */
  async analyzeQueryPatterns(
    queries: string[],
    schema: DatabaseSchema
  ): Promise<{
    patterns: QueryPattern[];
    recommendations: IndexRecommendation[];
  }> {
    const patternMap = new Map<string, QueryPattern>();
    const columnUsage = new Map<string, number>();

    // Parse all queries
    for (const query of queries) {
      const pattern = this.parseQuery(query);
      
      // Count column usage
      for (const column of [...pattern.whereColumns, ...pattern.joinColumns]) {
        columnUsage.set(column, (columnUsage.get(column) || 0) + 1);
      }

      // Track patterns
      const key = JSON.stringify({
        tables: pattern.tables.sort(),
        whereColumns: pattern.whereColumns.sort()
      });

      if (patternMap.has(key)) {
        patternMap.get(key)!.frequency++;
      } else {
        patternMap.set(key, pattern);
      }
    }

    const patterns = Array.from(patternMap.values());
    const recommendations: IndexRecommendation[] = [];

    // Generate recommendations based on frequency
    for (const [column, count] of columnUsage.entries()) {
      if (count >= 2) { // Used in 2+ queries
        // Find which table has this column
        for (const table of schema.tables) {
          if (table.columns.some(c => c.name === column)) {
            const hasIndex = table.indexes.some(idx => idx.columns.includes(column));
            if (!hasIndex) {
              recommendations.push({
                tableName: table.name,
                columns: [column],
                type: 'btree',
                reason: `Frequently used in queries (${count} times)`,
                priority: count >= 5 ? 'high' : 'medium',
                estimatedImpact: Math.min(90, 50 + count * 5),
                usageCount: count,
                createStatement: this.generateCreateIndexSQL(table.name, [column])
              });
            }
          }
        }
      }
    }

    return { patterns, recommendations };
  }

  /**
   * Find redundant indexes
   */
  async findRedundantIndexes(
    schema: DatabaseSchema
  ): Promise<{
    redundantIndexes: IndexUsageStats[];
    potentialSavings: string;
  }> {
    const redundantIndexes: IndexUsageStats[] = [];

    for (const table of schema.tables) {
      // Sort indexes by column count (longer first)
      const sortedIndexes = [...table.indexes].sort((a, b) => b.columns.length - a.columns.length);

      for (let i = 0; i < sortedIndexes.length; i++) {
        const currentIndex = sortedIndexes[i];
        
        for (let j = i + 1; j < sortedIndexes.length; j++) {
          const otherIndex = sortedIndexes[j];
          
          // Check if otherIndex is a prefix of currentIndex
          if (this.isIndexPrefix(otherIndex.columns, currentIndex.columns)) {
            redundantIndexes.push({
              indexName: otherIndex.name,
              table: table.name,
              columns: otherIndex.columns,
              usageCount: 0,
              selectivity: 0,
              cardinality: 0,
              isRedundant: true,
              redundantWith: currentIndex.name
            });
          }
        }
      }
    }

    // Estimate space savings
    const avgIndexSize = 1024 * 1024; // 1MB per index (rough estimate)
    const totalSavings = redundantIndexes.length * avgIndexSize;
    const potentialSavings = this.formatBytes(totalSavings);

    return { redundantIndexes, potentialSavings };
  }

  /**
   * Check if columns1 is a prefix of columns2
   */
  private isIndexPrefix(columns1: string[], columns2: string[]): boolean {
    if (columns1.length >= columns2.length) return false;
    
    for (let i = 0; i < columns1.length; i++) {
      if (columns1[i] !== columns2[i]) return false;
    }
    
    return true;
  }

  /**
   * Find unused indexes
   */
  async findUnusedIndexes(
    _schema: DatabaseSchema,
    usageStats?: IndexUsageStats[]
  ): Promise<IndexUsageStats[]> {
    const unusedIndexes: IndexUsageStats[] = [];

    // If no usage stats provided, return empty (can't determine without actual usage data)
    if (!usageStats) {
      return unusedIndexes;
    }

    for (const stat of usageStats) {
      if (stat.usageCount === 0 && stat.indexName !== 'PRIMARY') {
        unusedIndexes.push(stat);
      }
    }

    return unusedIndexes;
  }

  /**
   * Estimate impact of adding an index
   */
  async estimateIndexImpact(
    recommendation: IndexRecommendation,
    schema: DatabaseSchema,
    sampleQueries?: string[]
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

    // Estimate improvement based on table size and index selectivity
    let improvementPercent = recommendation.estimatedImpact || 50;
    
    if (sampleQueries && sampleQueries.length > 0) {
      // Count queries that would benefit
      let benefitingQueries = 0;
      for (const query of sampleQueries) {
        const pattern = this.parseQuery(query);
        const wouldBenefit = recommendation.columns.some(col =>
          pattern.whereColumns.includes(col) || pattern.joinColumns.includes(col)
        );
        if (wouldBenefit) benefitingQueries++;
      }
      improvementPercent = (benefitingQueries / sampleQueries.length) * 100;
    }

    // Estimate disk space (rough calculation)
    const rowCount = table.rowCount || 1000;
    const bytesPerEntry = 16; // Rough average for B-tree index
    const diskSpaceRequired = rowCount * bytesPerEntry * recommendation.columns.length;

    // Estimate maintenance overhead
    const maintenanceOverhead = recommendation.columns.length === 1 ? 'Low' : 
                                recommendation.columns.length === 2 ? 'Medium' : 'High';

    return {
      improvementPercent: Math.round(improvementPercent),
      diskSpaceRequired,
      maintenanceOverhead
    };
  }

  /**
   * Generate optimal index set for workload
   */
  async generateOptimalIndexSet(
    queries: string[],
    schema: DatabaseSchema,
    maxIndexes: number = 10
  ): Promise<IndexRecommendation[]> {
    // Analyze query patterns
    const { recommendations } = await this.analyzeQueryPatterns(queries, schema);

    // Sort by impact (priority + usage count)
    recommendations.sort((a, b) => {
      const scoreA = this.calculateIndexScore(a);
      const scoreB = this.calculateIndexScore(b);
      return scoreB - scoreA;
    });

    // Take top N recommendations
    return recommendations.slice(0, maxIndexes);
  }

  /**
   * Calculate index score for prioritization
   */
  private calculateIndexScore(recommendation: IndexRecommendation): number {
    let score = recommendation.estimatedImpact || 50;
    
    // Priority bonus
    if (recommendation.priority === 'high') score += 30;
    else if (recommendation.priority === 'medium') score += 15;
    
    // Usage count bonus
    if (recommendation.usageCount) {
      score += Math.min(20, recommendation.usageCount * 2);
    }
    
    // Single-column indexes score higher (easier to maintain)
    if (recommendation.columns.length === 1) {
      score += 10;
    }

    return score;
  }

  /**
   * Generate CREATE INDEX SQL statement
   */
  private generateCreateIndexSQL(tableName: string, columns: string[]): string {
    const indexName = `idx_${tableName}_${columns.join('_')}`;
    return `CREATE INDEX ${indexName} ON ${tableName}(${columns.join(', ')})`;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
