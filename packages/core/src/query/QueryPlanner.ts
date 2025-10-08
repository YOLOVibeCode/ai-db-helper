/**
 * QueryPlanner - Analyze and optimize database query execution plans
 *
 * Features:
 * - Parse EXPLAIN output from MySQL, PostgreSQL, MSSQL
 * - Detect performance issues (full table scans, missing indexes, filesorts)
 * - Generate optimization recommendations
 * - Compare query plans
 */

import {
  IQueryPlanner,
  QueryPlan,
  QueryCostEstimate,
  QueryPerformanceMetrics,
  PerformanceSeverity,
  QueryWarning,
  DatabaseType
} from '@aidb/contracts';

export class QueryPlanner implements IQueryPlanner {
  /**
   * Get execution plan for a query
   */
  async getExecutionPlan(
    query: string,
    databaseType: DatabaseType
  ): Promise<QueryPlan> {
    // This would normally execute EXPLAIN on the database
    // For now, we'll simulate based on query structure
    const estimate = await this.estimateCost(query, databaseType);
    
    return {
      originalQuery: query,
      estimatedCost: estimate.totalCost,
      usedIndexes: [],
      suggestedIndexes: [],
      warnings: [],
      joinOrder: [],
      executionStrategy: 'table-scan',
      explainOutput: {}
    };
  }

  /**
   * Parse EXPLAIN output from database
   */
  parseExplain(
    explainOutput: any,
    databaseType: DatabaseType
  ): QueryPlan {
    switch (databaseType) {
      case DatabaseType.MySQL:
      return this.parseMySQLExplain(explainOutput);
      case DatabaseType.PostgreSQL:
      return this.parsePostgreSQLExplain(explainOutput);
      case DatabaseType.MSSQL:
        return this.parseMSSQLExplain(explainOutput);
      default:
        throw new Error(`Unsupported database type: ${databaseType}`);
    }
  }

  /**
   * Parse MySQL EXPLAIN output
   */
  private parseMySQLExplain(explainOutput: any[]): QueryPlan {
    const plan: QueryPlan = {
      originalQuery: '',
      estimatedCost: 0,
      usedIndexes: [],
      suggestedIndexes: [],
      warnings: [],
      joinOrder: [],
      executionStrategy: 'table-scan',
      explainOutput
    };

    let totalCost = 0;

    for (const row of explainOutput) {
      // Calculate cost based on rows and type
      const rowCost = this.calculateMySQLRowCost(row);
      totalCost += rowCost;

      // Detect used indexes
      if (row.key) {
        plan.usedIndexes.push(row.key);
        plan.executionStrategy = 'index-scan';
      }

      // Detect full table scan
      if (row.type === 'ALL') {
        plan.warnings.push({
          severity: 'warning',
          code: 'FULL_TABLE_SCAN',
          message: `Full table scan on ${row.table}`,
          suggestion: `Consider adding an index to improve performance`,
          affectedTable: row.table
        });
      }

      // Detect filesort
      if (row.Extra && row.Extra.includes('Using filesort')) {
        plan.warnings.push({
          severity: 'warning',
          code: 'FILESORT',
          message: `Using filesort on ${row.table}`,
          suggestion: `Consider adding an index on ORDER BY columns`,
          affectedTable: row.table
        });
      }

      // Detect temporary table
      if (row.Extra && row.Extra.includes('Using temporary')) {
        plan.warnings.push({
          severity: 'warning',
          code: 'TEMPORARY_TABLE',
          message: `Using temporary table for ${row.table}`,
          suggestion: `Consider optimizing query or adding indexes`,
          affectedTable: row.table
        });
      }
    }

    plan.estimatedCost = totalCost;
    return plan;
  }

  /**
   * Calculate cost for MySQL EXPLAIN row
   */
  private calculateMySQLRowCost(row: any): number {
    const rows = row.rows || 1;
    const typeCost = {
      'const': 1,
      'eq_ref': 1,
      'ref': 10,
      'range': 100,
      'index': rows,
      'ALL': rows * 2
    };

    return typeCost[row.type as keyof typeof typeCost] || rows;
  }

  /**
   * Parse PostgreSQL EXPLAIN output (JSON format)
   */
  private parsePostgreSQLExplain(explainOutput: any[]): QueryPlan {
    const plan: QueryPlan = {
      originalQuery: '',
      estimatedCost: 0,
      usedIndexes: [],
      suggestedIndexes: [],
      warnings: [],
      joinOrder: [],
      executionStrategy: 'table-scan',
      explainOutput
    };

    if (explainOutput.length > 0 && explainOutput[0].Plan) {
      const pgPlan = explainOutput[0].Plan;
      this.parsePostgreSQLNode(pgPlan, plan);
    }

      return plan;
    }

  /**
   * Recursively parse PostgreSQL plan node
   */
  private parsePostgreSQLNode(node: any, plan: QueryPlan): void {
    // Extract cost
    if (node['Total Cost']) {
      plan.estimatedCost = Math.max(plan.estimatedCost, node['Total Cost']);
    }

    // Extract index usage
    if (node['Index Name']) {
      plan.usedIndexes.push(node['Index Name']);
      plan.executionStrategy = 'index-scan';
    }

    // Detect sequential scan (table scan)
    if (node['Node Type'] === 'Seq Scan') {
      plan.warnings.push({
        severity: 'warning',
        code: 'FULL_TABLE_SCAN',
        message: `Sequential scan on ${node['Relation Name']}`,
        suggestion: `Consider adding an index`,
        affectedTable: node['Relation Name']
      });
      plan.executionStrategy = 'table-scan';
    }

    // Detect hash join
    if (node['Node Type'] === 'Hash Join') {
      plan.executionStrategy = 'hash-join';
    }

    // Detect merge join
    if (node['Node Type'] === 'Merge Join') {
      plan.executionStrategy = 'merge-join';
    }

    // Detect nested loop
    if (node['Node Type'] === 'Nested Loop') {
      plan.executionStrategy = 'nested-loop';
    }

    // Recursively process child nodes
    if (node.Plans) {
      for (const childNode of node.Plans) {
        this.parsePostgreSQLNode(childNode, plan);
      }
    }
  }

  /**
   * Parse MSSQL execution plan
   */
  private parseMSSQLExplain(explainOutput: any): QueryPlan {
    const plan: QueryPlan = {
      originalQuery: explainOutput.StatementText || '',
      estimatedCost: explainOutput.EstimatedTotalCost || 0,
      usedIndexes: explainOutput.IndexSeeks || [],
      suggestedIndexes: [],
      warnings: [],
      joinOrder: [],
      executionStrategy: 'table-scan',
      explainOutput
    };

    // Detect table scans
    if (explainOutput.TableScans && explainOutput.TableScans.length > 0) {
      for (const table of explainOutput.TableScans) {
        plan.warnings.push({
          severity: 'warning',
          code: 'FULL_TABLE_SCAN',
          message: `Table scan on ${table}`,
          suggestion: `Consider adding an index`,
          affectedTable: table
        });
      }
    }

    return plan;
  }

  /**
   * Analyze query performance
   */
  analyzePerformance(plan: QueryPlan): QueryPerformanceMetrics {
    const metrics: QueryPerformanceMetrics = {
      fullTableScans: 0,
      missingIndexes: 0,
      temporaryTables: 0,
      filesorts: 0,
      estimatedCost: plan.estimatedCost,
      estimatedRows: 0,
      severity: PerformanceSeverity.OPTIMAL
    };

    // Count issues
    for (const warning of plan.warnings) {
      switch (warning.code) {
        case 'FULL_TABLE_SCAN':
          metrics.fullTableScans++;
          break;
        case 'FILESORT':
          metrics.filesorts++;
          break;
        case 'TEMPORARY_TABLE':
          metrics.temporaryTables++;
          break;
      }
    }

    metrics.missingIndexes = plan.suggestedIndexes.length;

    // Determine severity
    if (metrics.fullTableScans >= 2 || metrics.estimatedCost > 50000) {
      metrics.severity = PerformanceSeverity.CRITICAL;
    } else if (metrics.fullTableScans >= 1 || metrics.filesorts >= 1 || metrics.estimatedCost > 5000) {
      metrics.severity = PerformanceSeverity.WARNING;
    } else if (metrics.estimatedCost > 100) {
      metrics.severity = PerformanceSeverity.GOOD;
    } else {
      metrics.severity = PerformanceSeverity.OPTIMAL;
    }

    return metrics;
  }

  /**
   * Generate recommendations for query optimization
   */
  generateRecommendations(plan: QueryPlan): string[] {
    const recommendations: string[] = [];

    // Group warnings by type
    const warningsByCode = new Map<string, QueryWarning[]>();
    for (const warning of plan.warnings) {
      if (!warningsByCode.has(warning.code)) {
        warningsByCode.set(warning.code, []);
      }
      warningsByCode.get(warning.code)!.push(warning);
    }

    // Generate recommendations based on warnings
    if (warningsByCode.has('FULL_TABLE_SCAN')) {
      const scans = warningsByCode.get('FULL_TABLE_SCAN')!;
      const tables = scans.map(w => w.affectedTable).join(', ');
      recommendations.push(
        `Add indexes to tables with full table scans: ${tables}`
      );
      recommendations.push(
        `Full table scans detected on ${scans.length} table(s). Consider adding WHERE clause filters or indexes.`
      );
    }

    if (warningsByCode.has('FILESORT')) {
      recommendations.push(
        `Add composite index including ORDER BY columns to avoid filesort operations`
      );
      recommendations.push(
        `Consider using covering indexes that include both WHERE and ORDER BY columns`
      );
    }

    if (warningsByCode.has('TEMPORARY_TABLE')) {
      recommendations.push(
        `Optimize query to avoid temporary tables - consider removing DISTINCT or GROUP BY if not needed`
      );
    }

    // Index usage recommendations
    if (plan.usedIndexes.length === 0 && plan.warnings.length > 0) {
      recommendations.push(
        `No indexes are being used. Review table structure and add appropriate indexes.`
      );
    }

    // Suggest query rewrite for high cost
    if (plan.estimatedCost > 10000) {
      recommendations.push(
        `High query cost detected (${plan.estimatedCost.toFixed(0)}). Consider breaking down into smaller queries or adding aggressive WHERE filters.`
      );
    }

    // Index suggestions
    for (const suggestion of plan.suggestedIndexes) {
      recommendations.push(
        `Create ${suggestion.type} index on ${suggestion.tableName}(${suggestion.columns.join(', ')}): ${suggestion.reason}`
      );
    }

    return recommendations;
  }

  /**
   * Estimate query cost based on structure
   */
  async estimateCost(
    query: string,
    _databaseType: DatabaseType
  ): Promise<QueryCostEstimate> {
    // Simple heuristic-based estimation
    const queryLower = query.toLowerCase();
    
    let baseCost = 10;
    let estimatedRows = 100;

    // Check for joins
    const joinCount = (queryLower.match(/\sjoin\s/g) || []).length;
    baseCost += joinCount * 1000;
    estimatedRows *= Math.pow(10, joinCount);

    // Check for WHERE clause
    if (!queryLower.includes('where')) {
      baseCost *= 10; // No filter = expensive
      estimatedRows *= 10;
    }

    // Check for aggregation
    if (queryLower.includes('group by') || queryLower.includes('distinct')) {
      baseCost *= 5;
    }

    // Check for ORDER BY
    if (queryLower.includes('order by')) {
      baseCost *= 2;
    }

    // Check for subqueries
    const subqueryCount = (queryLower.match(/\(\s*select/g) || []).length;
    baseCost += subqueryCount * 500;

    return {
      totalCost: baseCost,
      startupCost: baseCost * 0.1,
      estimatedRows,
      estimatedWidth: 100
    };
  }

  /**
   * Compare two query plans
   */
  comparePlans(
    plan1: QueryPlan,
    plan2: QueryPlan
  ): {
    betterPlan: QueryPlan;
    improvements: string[];
    costDifference: number;
  } {
    const costDiff = Math.abs(plan1.estimatedCost - plan2.estimatedCost);
    const betterPlan = plan1.estimatedCost < plan2.estimatedCost ? plan1 : plan2;
    const worsePlan = betterPlan === plan1 ? plan2 : plan1;

    const improvements: string[] = [];

    // Compare costs
    if (costDiff > 0) {
      const improvement = ((costDiff / worsePlan.estimatedCost) * 100).toFixed(1);
      improvements.push(`${improvement}% cost reduction (${worsePlan.estimatedCost.toFixed(0)} → ${betterPlan.estimatedCost.toFixed(0)})`);
    }

    // Compare index usage
    if (betterPlan.usedIndexes.length > worsePlan.usedIndexes.length) {
      const additionalIndexes = betterPlan.usedIndexes.length - worsePlan.usedIndexes.length;
      improvements.push(`Uses ${additionalIndexes} more index(es)`);
    }

    // Compare warnings
    if (betterPlan.warnings.length < worsePlan.warnings.length) {
      const fewerWarnings = worsePlan.warnings.length - betterPlan.warnings.length;
      improvements.push(`${fewerWarnings} fewer performance warning(s)`);
    }

    // Compare execution strategy
    if (betterPlan.executionStrategy !== worsePlan.executionStrategy) {
      improvements.push(`Better execution strategy: ${betterPlan.executionStrategy}`);
    }

    return {
      betterPlan,
      improvements,
      costDifference: costDiff
    };
  }
}
