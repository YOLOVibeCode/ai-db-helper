/**
 * Relationship discovery and analysis interface
 */

import {
  Relationship,
  JunctionTable,
  Multiplicity,
  RelationshipsByDirection
} from '../types/relationship-types';
import { DatabaseSchema } from '../types/schema-types';

export interface IRelationshipAnalyzer {
  /**
   * Discover explicit relationships (foreign keys)
   */
  discoverExplicitRelationships(schema: DatabaseSchema): Promise<Relationship[]>;

  /**
   * Infer implicit relationships from naming conventions
   */
  inferImplicitRelationships(schema: DatabaseSchema): Promise<Relationship[]>;

  /**
   * Detect junction tables for many-to-many relationships
   */
  detectJunctionTables(
    schema: DatabaseSchema,
    relationships: Relationship[]
  ): Promise<JunctionTable[]>;

  /**
   * Calculate relationship multiplicity via data sampling
   */
  calculateMultiplicity(
    relationship: Relationship,
    sampleSize?: number
  ): Promise<Multiplicity>;

  /**
   * Get all relationships for a specific table
   */
  getTableRelationships(
    tableName: string,
    relationships: Relationship[]
  ): RelationshipsByDirection;
}
