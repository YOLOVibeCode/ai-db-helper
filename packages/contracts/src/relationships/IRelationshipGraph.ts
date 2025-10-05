/**
 * Relationship graph builder and navigator
 */

import {
  Graph,
  JoinPath,
  RelatedTable,
  Relationship
} from '../types/relationship-types';
import { DatabaseSchema } from '../types/schema-types';

export interface IRelationshipGraph {
  /**
   * Build graph from schema and relationships
   */
  buildGraph(schema: DatabaseSchema, relationships: Relationship[]): Graph;

  /**
   * Find optimal join path between two tables
   */
  findJoinPath(fromTable: string, toTable: string, maxHops?: number): JoinPath[];

  /**
   * Get all related tables within max depth
   */
  getRelatedTables(tableName: string, maxDepth: number): RelatedTable[];

  /**
   * Export as Mermaid ER diagram
   */
  exportMermaidER(): string;

  /**
   * Export as GraphViz DOT format
   */
  exportGraphViz(): string;

  /**
   * Calculate edge weight (cost) for join
   */
  calculateEdgeWeight(from: string, to: string, relationship: Relationship): number;
}
