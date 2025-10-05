/**
 * Relationship type definitions for AI Database Helper
 * Defines all relationship intelligence types
 */

/**
 * Relationship multiplicity
 */
export type Multiplicity = '1:1' | '1:N' | 'N:1' | 'N:N';

/**
 * Relationship between tables
 */
export interface Relationship {
  id: string;
  type: 'explicit' | 'inferred';
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  multiplicity: Multiplicity;
  cascadeDelete: boolean;
  cascadeUpdate: boolean;
  constraintName?: string;
  confidence: number;
}

/**
 * Junction table for many-to-many relationships
 */
export interface JunctionTable {
  tableName: string;
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  additionalColumns: string[];
  confidence: number;
}

/**
 * Join path between tables
 */
export interface JoinPath {
  from: string;
  to: string;
  path: JoinStep[];
  estimatedCost: number;
  recommendedIndexes: string[];
}

export interface JoinStep {
  fromTable: string;
  toTable: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  onClause: string;
  relationship: Relationship;
}

/**
 * Related table information
 */
export interface RelatedTable {
  tableName: string;
  relationship: Relationship;
  distance: number;
}

/**
 * Graph representation
 */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  tableName: string;
  rowCount?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationship: Relationship;
  weight: number;
}

/**
 * Relationships grouped by direction
 */
export interface RelationshipsByDirection {
  outgoing: Relationship[];
  incoming: Relationship[];
}
