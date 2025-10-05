/**
 * QueryPlanner Implementation
 *
 * Analyzes database query execution plans to identify performance issues
 * and optimization opportunities.
 */

import {
  IQueryPlanner,
  QueryPlan,
  QueryCostEstimate,
  QueryPerformanceMetrics,
  PerformanceSeverity,
  DatabaseType
} from '@aidb/contracts';

export class QueryPlanner implements IQueryPlanner {
  /**
   * Get execution plan for a query
   */
  async getExecutionPlan(
    query: string,
    _databaseType: DatabaseType
  ): Promise<QueryPlan> {
    // In a real implementation, this would execute EXPLAIN via database adapter
    // For now, return a basic plan structure
    return {
      originalQuery: query,
      estimatedCost: this.estimateBasicCost(query),
      usedIndexes: [],
      suggestedIndexes: [],
      warnings: [],
      joinOrder: [],
      executionStrategy: this.detectStrategy(query),
      explainOutput: {}
    };
  }

  /**
   * Analyze query performance
   */
  analyzePerformance(plan: QueryPlan): QueryPerformanceMetrics {
    let fullTableScans = 0;
    let missingIndexes = 0;
    let temporaryTables = 0;
    let filesorts = 0;

    // Count issues from warnings
    plan.warnings.forEach(warning => {
      if (warning.code === 'FULL_TABLE_SCAN' || warning.message.toLowerCase().includes('full table scan')) {
        fullTableScans++;
      }
      if (warning.code === 'MISSING_INDEX' || warning.message.toLowerCase().includes('missing index')) {
        missingIndexes++;
      }
      if (warning.message.toLowerCase().includes('temporary table')) {
        temporaryTables++;
      }
      if (warning.code === 'FILESORT' || warning.message.toLowerCase().includes('filesort')) {
        filesorts++;
      }
    });

    // Also count from suggested indexes
    missingIndexes += plan.suggestedIndexes.length;

    const estimatedCost = plan.estimatedCost || 0;
    const estimatedRows = this.extractEstimatedRows(plan);

    const severity = this.calculateSeverity(
      fullTableScans,
      missingIndexes,
      temporaryTables,
      filesorts,
      estimatedCost
    );

    return {
      fullTableScans,
      missingIndexes,
      temporaryTables,
      filesorts,
      estimatedCost,
      estimatedRows,
      severity
    };
  }

  /**
   * Parse EXPLAIN output from database
   */
  parseExplain(explainOutput: any, databaseType: DatabaseType): QueryPlan {
    if (databaseType === DatabaseType.MySQL) {
      return this.parseMySQLExplain(explainOutput);
    } else if (databaseType === DatabaseType.PostgreSQL) {
      return this.parsePostgreSQLExplain(explainOutput);
    }

    // Default fallback
    return {
      originalQuery: '',
      estimatedCost: 0,
      usedIndexes: [],
      suggestedIndexes: [],
      warnings: [],
      joinOrder: [],
      executionStrategy: 'table-scan',
      explainOutput
    };
  }

  /**
   * Generate recommendations for query optimization
   */
  generateRecommendations(plan: QueryPlan): string[] {
    const recommendations: string[] = [];

    // Check for SELECT *
    if (plan.originalQuery && plan.originalQuery.includes('SELECT *')) {
      recommendations.push('Avoid SELECT * - specify only needed columns to reduce data transfer');
    }

    // Check for high cost queries without LIMIT
    if (plan.estimatedCost > 5000 && !plan.originalQuery.includes('LIMIT')) {
      recommendations.push('Consider adding LIMIT clause to reduce result set size');
    }

    // Check for missing indexes from warnings
    plan.warnings.forEach(warning => {
      if (warning.code === 'FULL_TABLE_SCAN') {
        recommendations.push(`Add index on ${warning.affectedTable || 'table'} to avoid full table scan`);
      }
    });

    // Check for suggested indexes
    plan.suggestedIndexes.forEach(index => {
      recommendations.push(
        `Create index on ${index.tableName}(${index.columns.join(', ')}) - ${index.reason}`
      );
    });

    // Check for subqueries that could be JOINs
    if (plan.originalQuery && plan.originalQuery.includes('IN (SELECT')) {
      recommendations.push('Consider rewriting subquery as JOIN for better performance');
    }

    // Check for filesorts
    const hasFilesort = plan.warnings.some(w =>
      w.code === 'FILESORT' || w.message.toLowerCase().includes('filesort')
    );
    if (hasFilesort) {
      recommendations.push('Add index on ORDER BY columns to avoid filesort');
    }

    return recommendations;
  }

  /**
   * Estimate query cost
   */
  async estimateCost(
    query: string,
    _databaseType: DatabaseType
  ): Promise<QueryCostEstimate> {
    const totalCost = this.estimateBasicCost(query);
    const startupCost = totalCost * 0.1; // Rough estimate
    const estimatedRows = this.estimateRows(query);

    return {
      totalCost,
      startupCost,
      estimatedRows
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
    const cost1 = plan1.estimatedCost;
    const cost2 = plan2.estimatedCost;
    const costDifference = Math.abs(cost1 - cost2);

    const betterPlan = cost1 < cost2 ? plan1 : plan2;
    const worsePlan = cost1 < cost2 ? plan2 : plan1;

    const improvements: string[] = [];

    // Compare indexes used
    if (betterPlan.usedIndexes.length > worsePlan.usedIndexes.length) {
      improvements.push(
        `Uses ${betterPlan.usedIndexes.length - worsePlan.usedIndexes.length} more indexes: ${betterPlan.usedIndexes.join(', ')}`
      );
    }

    // Compare warnings
    if (betterPlan.warnings.length < worsePlan.warnings.length) {
      improvements.push(
        `Reduces performance warnings from ${worsePlan.warnings.length} to ${betterPlan.warnings.length}`
      );
    }

    // Compare execution strategy
    if (betterPlan.executionStrategy !== worsePlan.executionStrategy) {
      improvements.push(
        `Better execution strategy: ${betterPlan.executionStrategy} vs ${worsePlan.executionStrategy}`
      );
    }

    // Cost improvement
    if (costDifference > 0) {
      const percentImprovement = ((costDifference / Math.max(cost1, cost2)) * 100).toFixed(1);
      improvements.push(`${percentImprovement}% cost reduction`);
    }

    return {
      betterPlan,
      improvements,
      costDifference
    };
  }

  // Private helper methods

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

    if (!Array.isArray(explainOutput)) {
      return plan;
    }

    let totalRows = 0;

    explainOutput.forEach((row) => {
      const type = row.type || row.access_type;
      const table = row.table;
      const key = row.key;
      const rows = row.rows || 0;

      totalRows += rows;

      // Track used indexes
      if (key && key !== 'NULL' && key !== null) {
        if (!plan.usedIndexes.includes(key)) {
          plan.usedIndexes.push(key);
        }
      }

      // Detect full table scans
      if (type === 'ALL') {
        plan.warnings.push({
          severity: 'warning',
          code: 'FULL_TABLE_SCAN',
          message: `Full table scan on ${table}`,
          suggestion: 'Add index on frequently queried columns',
          affectedTable: table
        });
      }

      // Detect filesort
      if (row.Extra && row.Extra.includes('Using filesort')) {
        plan.warnings.push({
          severity: 'warning',
          code: 'FILESORT',
          message: 'Using filesort - consider adding index on ORDER BY columns',
          suggestion: 'Add index on ORDER BY columns'
        });
      }

      // Detect temporary table
      if (row.Extra && row.Extra.includes('Using temporary')) {
        plan.warnings.push({
          severity: 'warning',
          code: 'TEMP_TABLE',
          message: 'Using temporary table',
          suggestion: 'Optimize query to avoid temporary tables'
        });
      }
    });

    plan.estimatedCost = totalRows;
    plan.executionStrategy = this.determineStrategyFromExplain(explainOutput);

    return plan;
  }

  private parsePostgreSQLExplain(explainOutput: any): QueryPlan {
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

    if (!explainOutput || !explainOutput.Plan) {
      return plan;
    }

    const pgPlan = explainOutput.Plan;

    // Extract cost
    plan.estimatedCost = pgPlan['Total Cost'] || 0;

    // Extract index usage
    if (pgPlan['Index Name']) {
      plan.usedIndexes.push(pgPlan['Index Name']);
    }

    // Detect sequential scans
    if (pgPlan['Node Type'] === 'Seq Scan') {
      plan.warnings.push({
        severity: 'warning',
        code: 'FULL_TABLE_SCAN',
        message: `Sequential scan on ${pgPlan['Relation Name']}`,
        suggestion: 'Add index to improve performance',
        affectedTable: pgPlan['Relation Name']
      });
    }

    // Determine strategy
    const nodeType = pgPlan['Node Type'];
    if (nodeType === 'Index Scan' || nodeType === 'Index Only Scan') {
      plan.executionStrategy = 'index-scan';
    } else if (nodeType === 'Seq Scan') {
      plan.executionStrategy = 'table-scan';
    } else if (nodeType === 'Hash Join') {
      plan.executionStrategy = 'hash-join';
    } else if (nodeType === 'Merge Join') {
      plan.executionStrategy = 'merge-join';
    } else if (nodeType === 'Nested Loop') {
      plan.executionStrategy = 'nested-loop';
    }

    return plan;
  }

  private calculateSeverity(
    fullTableScans: number,
    missingIndexes: number,
    temporaryTables: number,
    filesorts: number,
    estimatedCost: number
  ): PerformanceSeverity {
    // Calculate total issues
    const totalIssues = fullTableScans + missingIndexes + temporaryTables + filesorts;

    // Critical: Multiple serious issues or very high cost
    if (totalIssues >= 3 || estimatedCost > 50000 || fullTableScans >= 2) {
      return PerformanceSeverity.CRITICAL;
    }

    // Warning: Some issues or moderate cost
    if (totalIssues >= 1 || estimatedCost > 5000) {
      return PerformanceSeverity.WARNING;
    }

    // Good: Minor issues or low cost
    if (estimatedCost > 100 || missingIndexes > 0) {
      return PerformanceSeverity.GOOD;
    }

    // Optimal: No issues and low cost
    return PerformanceSeverity.OPTIMAL;
  }

  private extractEstimatedRows(plan: QueryPlan): number {
    // Try to extract from explain output
    if (Array.isArray(plan.explainOutput)) {
      return plan.explainOutput.reduce((sum, row) => sum + (row.rows || 0), 0);
    }

    if (plan.explainOutput?.Plan?.['Plan Rows']) {
      return plan.explainOutput.Plan['Plan Rows'];
    }

    // Fallback estimate based on cost
    return Math.ceil(plan.estimatedCost / 10);
  }

  private estimateBasicCost(query: string): number {
    let cost = 100; // Base cost

    // Increase cost for JOINs
    const joinCount = (query.match(/JOIN/gi) || []).length;
    cost += joinCount * 500;

    // Increase cost for subqueries
    const subqueryCount = (query.match(/SELECT.*FROM.*\(SELECT/gi) || []).length;
    cost += subqueryCount * 1000;

    // Increase cost for ORDER BY without LIMIT
    if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
      cost += 1000;
    }

    // Decrease cost for specific lookups (WHERE id = ?)
    if (query.match(/WHERE\s+id\s*=/i)) {
      cost = Math.min(cost, 10);
    }

    return cost;
  }

  private estimateRows(query: string): number {
    // Simple heuristic based on query type
    if (query.includes('WHERE id =')) {
      return 1;
    }

    if (query.includes('LIMIT')) {
      const match = query.match(/LIMIT\s+(\d+)/i);
      if (match) {
        return parseInt(match[1]);
      }
    }

    if (query.includes('JOIN')) {
      return 1000; // Assume moderate result set for joins
    }

    return 100; // Default estimate
  }

  private detectStrategy(query: string): any {
    if (query.includes('WHERE id =')) {
      return 'index-scan';
    }

    if (query.includes('JOIN')) {
      return 'nested-loop';
    }

    return 'table-scan';
  }

  private determineStrategyFromExplain(explainOutput: any[]): any {
    if (!explainOutput || explainOutput.length === 0) {
      return 'table-scan';
    }

    const hasIndex = explainOutput.some(row => row.key && row.key !== 'NULL' && row.key !== null);
    if (hasIndex) {
      return 'index-scan';
    }

    const hasJoin = explainOutput.length > 1;
    if (hasJoin) {
      return 'nested-loop';
    }

    return 'table-scan';
  }
}
