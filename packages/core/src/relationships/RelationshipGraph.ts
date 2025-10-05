/**
 * RelationshipGraph - Graph-based relationship navigation and pathfinding
 *
 * Features:
 * - Build directed graph from relationships
 * - Find optimal join paths (Dijkstra's algorithm)
 * - Calculate join costs based on indexes and table sizes
 * - Export as Mermaid ER diagrams
 * - Get related tables within depth
 */

import { Graph as GraphLib } from 'graphlib';
import {
  IRelationshipGraph,
  Graph,
  GraphNode,
  GraphEdge,
  JoinPath,
  JoinStep,
  RelatedTable,
  Relationship,
  DatabaseSchema
} from '@aidb/contracts';

export class RelationshipGraph implements IRelationshipGraph {
  private graph: GraphLib;
  private schema?: DatabaseSchema;
  private relationships: Relationship[] = [];

  constructor() {
    this.graph = new GraphLib({ directed: true, multigraph: true });
  }

  /**
   * Build graph from schema and relationships
   */
  buildGraph(schema: DatabaseSchema, relationships: Relationship[]): Graph {
    this.schema = schema;
    this.relationships = relationships;
    this.graph = new GraphLib({ directed: true, multigraph: true });

    // Add nodes for each table
    for (const table of schema.tables) {
      this.graph.setNode(table.name, {
        tableName: table.name,
        rowCount: table.rowCount || 0
      });
    }

    // Add edges for each relationship
    for (const rel of relationships) {
      const edgeId = `${rel.fromTable}->${rel.toTable}:${rel.fromColumn}`;

      this.graph.setEdge(
        rel.fromTable,
        rel.toTable,
        {
          relationship: rel,
          weight: this.calculateEdgeWeight(rel.fromTable, rel.toTable, rel)
        },
        edgeId
      );
    }

    // Export to our Graph format
    return this.exportGraph();
  }

  /**
   * Find optimal join path between two tables using Dijkstra's algorithm
   */
  findJoinPath(fromTable: string, toTable: string, maxHops = 5): JoinPath[] {
    if (!this.schema) {
      throw new Error('Graph not built. Call buildGraph() first.');
    }

    // Check if tables exist
    if (!this.graph.hasNode(fromTable)) {
      throw new Error(`Table '${fromTable}' not found in schema`);
    }
    if (!this.graph.hasNode(toTable)) {
      throw new Error(`Table '${toTable}' not found in schema`);
    }

    // Find all paths using modified Dijkstra's
    const allPaths = this.findAllPaths(fromTable, toTable, maxHops);

    if (allPaths.length === 0) {
      return [];
    }

    // Convert paths to JoinPath objects
    const joinPaths: JoinPath[] = [];

    for (const path of allPaths) {
      const steps: JoinStep[] = [];
      let totalCost = 0;
      const recommendedIndexes: string[] = [];

      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];

        // Get edge (relationship) between these tables
        const edges = this.graph.outEdges(from, to);
        if (!edges || edges.length === 0) continue;

        const edgeData = this.graph.edge(edges[0]);
        const rel: Relationship = edgeData.relationship;

        totalCost += edgeData.weight;

        // Determine join type (INNER for FK relationships)
        const joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER';

        steps.push({
          fromTable: from,
          toTable: to,
          joinType,
          onClause: `${from}.${rel.fromColumn} = ${to}.${rel.toColumn}`,
          relationship: rel
        });

        // Check if index exists on join column
        const toTable = this.schema.tables.find(t => t.name === to);
        const hasIndex = toTable?.indexes.some(idx =>
          idx.columns.includes(rel.toColumn)
        );

        if (!hasIndex) {
          recommendedIndexes.push(`${to}.${rel.toColumn}`);
        }
      }

      joinPaths.push({
        from: fromTable,
        to: toTable,
        path: steps,
        estimatedCost: totalCost,
        recommendedIndexes
      });
    }

    // Sort by cost (lowest first)
    return joinPaths.sort((a, b) => a.estimatedCost - b.estimatedCost);
  }

  /**
   * Get all related tables within max depth
   */
  getRelatedTables(tableName: string, maxDepth: number): RelatedTable[] {
    if (!this.graph.hasNode(tableName)) {
      throw new Error(`Table '${tableName}' not found in schema`);
    }

    const related: RelatedTable[] = [];
    const visited = new Set<string>();
    const queue: { table: string; depth: number; relationship?: Relationship }[] = [
      { table: tableName, depth: 0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth > maxDepth) continue;
      if (visited.has(current.table)) continue;

      visited.add(current.table);

      // Add to results (skip the starting table)
      if (current.table !== tableName && current.relationship) {
        related.push({
          tableName: current.table,
          relationship: current.relationship,
          distance: current.depth
        });
      }

      // Get outgoing edges
      const outEdges = this.graph.outEdges(current.table);
      if (outEdges) {
        for (const edge of outEdges) {
          const edgeData = this.graph.edge(edge);
          const targetTable = edge.w; // 'w' is the target node

          if (!visited.has(targetTable)) {
            queue.push({
              table: targetTable,
              depth: current.depth + 1,
              relationship: edgeData.relationship
            });
          }
        }
      }

      // Get incoming edges (reverse relationships)
      const inEdges = this.graph.inEdges(current.table);
      if (inEdges) {
        for (const edge of inEdges) {
          const edgeData = this.graph.edge(edge);
          const sourceTable = edge.v; // 'v' is the source node

          if (!visited.has(sourceTable)) {
            queue.push({
              table: sourceTable,
              depth: current.depth + 1,
              relationship: edgeData.relationship
            });
          }
        }
      }
    }

    return related.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Export as Mermaid ER diagram
   */
  exportMermaidER(): string {
    if (!this.schema) {
      throw new Error('Graph not built. Call buildGraph() first.');
    }

    let mermaid = 'erDiagram\n';

    // Add relationships
    for (const rel of this.relationships) {
      const multiplicity = this.formatMultiplicity(rel.multiplicity);
      const label = `"${rel.type === 'explicit' ? '' : '(inferred) '}${rel.multiplicity}"`;

      mermaid += `    ${rel.fromTable} ${multiplicity.from}--${multiplicity.to} ${rel.toTable} : ${label}\n`;
    }

    // Add table definitions
    mermaid += '\n';
    for (const table of this.schema.tables) {
      mermaid += `    ${table.name} {\n`;

      // Add columns (limit to key columns for readability)
      const keyColumns = table.columns.filter(
        c => c.name === 'id' || c.name.endsWith('_id') || table.primaryKey?.columns.includes(c.name)
      ).slice(0, 5);

      for (const col of keyColumns) {
        const pk = table.primaryKey?.columns.includes(col.name) ? ' PK' : '';
        const indexed = table.indexes.some(idx => idx.columns.includes(col.name)) ? ' "indexed"' : '';
        mermaid += `        ${col.dataType} ${col.name}${pk}${indexed}\n`;
      }

      mermaid += `    }\n`;
    }

    return mermaid;
  }

  /**
   * Export as GraphViz DOT format
   */
  exportGraphViz(): string {
    let dot = 'digraph relationships {\n';
    dot += '    rankdir=LR;\n';
    dot += '    node [shape=box];\n\n';

    // Add edges
    for (const rel of this.relationships) {
      const style = rel.type === 'inferred' ? 'dashed' : 'solid';
      const color = rel.confidence >= 0.9 ? 'green' : rel.confidence >= 0.7 ? 'blue' : 'orange';

      dot += `    "${rel.fromTable}" -> "${rel.toTable}" [label="${rel.multiplicity}", style=${style}, color=${color}];\n`;
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Calculate edge weight (cost) for join
   * Lower weight = better join path
   */
  calculateEdgeWeight(_from: string, to: string, relationship: Relationship): number {
    let weight = 10; // Base weight

    // Explicit relationships are cheaper (more reliable)
    if (relationship.type === 'explicit') {
      weight -= 3;
    }

    // High confidence relationships are cheaper
    weight -= relationship.confidence * 2;

    // Check if target table has index on join column
    const toTable = this.schema?.tables.find(t => t.name === to);
    const hasIndex = toTable?.indexes.some(idx =>
      idx.columns.includes(relationship.toColumn)
    );

    if (hasIndex) {
      weight -= 5; // Significant reduction for indexed joins
    }

    // Factor in table size (larger tables = higher cost)
    const toRowCount = toTable?.rowCount || 0;
    if (toRowCount > 1000000) {
      weight += 5;
    } else if (toRowCount > 100000) {
      weight += 3;
    } else if (toRowCount > 10000) {
      weight += 1;
    }

    return Math.max(weight, 1); // Minimum weight of 1
  }

  /**
   * Find all paths between two nodes (BFS with path tracking)
   */
  private findAllPaths(start: string, end: string, maxHops: number): string[][] {
    const paths: string[][] = [];
    const queue: { node: string; path: string[] }[] = [{ node: start, path: [start] }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.path.length > maxHops + 1) {
        continue;
      }

      if (current.node === end) {
        paths.push(current.path);
        continue;
      }

      const successors = this.graph.successors(current.node);
      if (successors) {
        for (const next of successors) {
          // Avoid cycles
          if (!current.path.includes(next)) {
            queue.push({
              node: next,
              path: [...current.path, next]
            });
          }
        }
      }
    }

    return paths;
  }

  /**
   * Export graph to our Graph format
   */
  private exportGraph(): Graph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Export nodes
    for (const nodeId of this.graph.nodes()) {
      const nodeData = this.graph.node(nodeId);
      nodes.push({
        id: nodeId,
        tableName: nodeData.tableName,
        rowCount: nodeData.rowCount
      });
    }

    // Export edges
    for (const edge of this.graph.edges()) {
      const edgeData = this.graph.edge(edge);
      edges.push({
        id: `${edge.v}->${edge.w}`,
        from: edge.v,
        to: edge.w,
        relationship: edgeData.relationship,
        weight: edgeData.weight
      });
    }

    return { nodes, edges };
  }

  /**
   * Format multiplicity for Mermaid diagram
   */
  private formatMultiplicity(multiplicity: string): { from: string; to: string } {
    switch (multiplicity) {
      case '1:1':
        return { from: '||', to: '||' };
      case '1:N':
        return { from: '||', to: 'o{' };
      case 'N:1':
        return { from: '}o', to: '||' };
      case 'N:N':
        return { from: '}o', to: 'o{' };
      default:
        return { from: '--', to: '--' };
    }
  }
}
