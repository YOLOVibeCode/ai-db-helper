/**
 * RelationshipAnalyzer - Discover and analyze database relationships
 *
 * Features:
 * - Explicit FK relationship discovery
 * - Implicit relationship inference (naming conventions)
 * - Junction table detection (M:N relationships)
 * - Multiplicity calculation (1:1, 1:N, N:1, N:N)
 * - Confidence scoring for inferred relationships
 */

import pluralize from 'pluralize';
import {
  IRelationshipAnalyzer,
  IDatabaseAdapter,
  Relationship,
  JunctionTable,
  Multiplicity,
  RelationshipsByDirection,
  DatabaseSchema,
  ConstraintType,
  ReferentialAction
} from '@aidb/contracts';

export class RelationshipAnalyzer implements IRelationshipAnalyzer {
  constructor(private adapter: IDatabaseAdapter) {}

  /**
   * Discover explicit relationships from foreign key constraints
   */
  async discoverExplicitRelationships(schema: DatabaseSchema): Promise<Relationship[]> {
    const relationships: Relationship[] = [];

    for (const table of schema.tables) {
      // Find foreign key constraints
      const fkConstraints = table.constraints.filter(
        c => c.type === ConstraintType.ForeignKey
      );

      for (const fk of fkConstraints) {
        // Create relationship for each FK
        for (let i = 0; i < fk.columns.length; i++) {
          const relationship: Relationship = {
            id: `${table.name}.${fk.name}`,
            type: 'explicit',
            fromTable: table.name,
            fromColumn: fk.columns[i],
            toTable: fk.referencedTable!,
            toColumn: fk.referencedColumns![i],
            multiplicity: 'N:1', // Default for FK, will be calculated later
            cascadeDelete: fk.onDelete === ReferentialAction.Cascade,
            cascadeUpdate: fk.onUpdate === ReferentialAction.Cascade,
            constraintName: fk.name,
            confidence: 1.0 // Explicit relationships have 100% confidence
          };

          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  /**
   * Infer implicit relationships from naming conventions
   * Pattern: <table>_id → <table>.id
   */
  async inferImplicitRelationships(schema: DatabaseSchema): Promise<Relationship[]> {
    const relationships: Relationship[] = [];
    const existingRelationships = await this.discoverExplicitRelationships(schema);

    // Create a set of existing relationships for quick lookup
    const existingKeys = new Set(
      existingRelationships.map(r => `${r.fromTable}.${r.fromColumn}`)
    );

    for (const table of schema.tables) {
      for (const column of table.columns) {
        // Skip if already has explicit FK
        const key = `${table.name}.${column.name}`;
        if (existingKeys.has(key)) {
          continue;
        }

        // Pattern 1: column_id → column table
        const idMatch = column.name.match(/^(.+)_id$/i);
        if (idMatch) {
          const baseName = idMatch[1];
          const targetTable = this.findTargetTable(schema, baseName);

          if (targetTable) {
            // Check if target table has 'id' column
            const hasIdColumn = targetTable.columns.some(c => c.name === 'id');

            if (hasIdColumn) {
              relationships.push({
                id: `${table.name}.${column.name}_inferred`,
                type: 'inferred',
                fromTable: table.name,
                fromColumn: column.name,
                toTable: targetTable.name,
                toColumn: 'id',
                multiplicity: 'N:1',
                cascadeDelete: false,
                cascadeUpdate: false,
                confidence: this.calculateInferenceConfidence(column.name, targetTable.name)
              });
            }
          }
        }

        // Pattern 2: tableId (camelCase) → table
        const camelMatch = column.name.match(/^([a-z]+)Id$/);
        if (camelMatch) {
          const baseName = camelMatch[1];
          const targetTable = this.findTargetTable(schema, baseName);

          if (targetTable && targetTable.columns.some(c => c.name === 'id')) {
            relationships.push({
              id: `${table.name}.${column.name}_inferred`,
              type: 'inferred',
              fromTable: table.name,
              fromColumn: column.name,
              toTable: targetTable.name,
              toColumn: 'id',
              multiplicity: 'N:1',
              cascadeDelete: false,
              cascadeUpdate: false,
              confidence: this.calculateInferenceConfidence(column.name, targetTable.name)
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Detect junction tables for many-to-many relationships
   * Heuristic: Table with exactly 2 FKs and minimal other columns
   */
  async detectJunctionTables(
    schema: DatabaseSchema,
    relationships: Relationship[]
  ): Promise<JunctionTable[]> {
    const junctionTables: JunctionTable[] = [];

    for (const table of schema.tables) {
      // Get all FK relationships from this table
      const tableFKs = relationships.filter(
        r => r.fromTable === table.name && r.type === 'explicit'
      );

      // Must have exactly 2 foreign keys
      if (tableFKs.length !== 2) {
        continue;
      }

      // Count non-FK, non-PK columns
      const pkColumns = new Set(table.primaryKey?.columns || []);
      const fkColumns = new Set(tableFKs.map(fk => fk.fromColumn));

      const otherColumns = table.columns.filter(
        col =>
          !fkColumns.has(col.name) &&
          !pkColumns.has(col.name) &&
          !['created_at', 'updated_at', 'timestamp'].includes(col.name.toLowerCase())
      );

      // High confidence if 0 other columns, lower if 1-2
      let confidence = 0.0;
      if (otherColumns.length === 0) {
        confidence = 0.95;
      } else if (otherColumns.length === 1) {
        confidence = 0.80;
      } else if (otherColumns.length === 2) {
        confidence = 0.65;
      } else {
        continue; // Too many columns, likely not a junction table
      }

      junctionTables.push({
        tableName: table.name,
        leftTable: tableFKs[0].toTable,
        leftColumn: tableFKs[0].fromColumn,
        rightTable: tableFKs[1].toTable,
        rightColumn: tableFKs[1].fromColumn,
        additionalColumns: otherColumns.map(c => c.name),
        confidence
      });
    }

    return junctionTables;
  }

  /**
   * Calculate relationship multiplicity via data sampling
   */
  async calculateMultiplicity(
    relationship: Relationship,
    sampleSize = 10000
  ): Promise<Multiplicity> {
    try {
      // Query to analyze relationship cardinality
      const query = `
        SELECT
          COUNT(DISTINCT ${relationship.fromColumn}) as unique_from,
          COUNT(DISTINCT ${relationship.toColumn}) as unique_to,
          COUNT(*) as total_rows,
          COUNT(${relationship.fromColumn}) as non_null_from
        FROM ${relationship.fromTable}
        WHERE ${relationship.fromColumn} IS NOT NULL
        LIMIT ${sampleSize}
      `;

      const result = await this.adapter.executeQuery<any[]>(query);

      if (!result || result.length === 0) {
        return relationship.multiplicity; // Return existing if query fails
      }

      const stats = result[0];

      // Calculate ratios
      const uniqueFrom = parseInt(stats.unique_from);
      const uniqueTo = parseInt(stats.unique_to);
      const totalRows = parseInt(stats.total_rows);

      if (totalRows === 0) {
        return relationship.multiplicity;
      }

      const fromRatio = totalRows / uniqueFrom;
      const toRatio = totalRows / uniqueTo;

      // Determine multiplicity based on ratios
      // 1:1 - both ratios close to 1
      if (fromRatio <= 1.1 && toRatio <= 1.1) {
        return '1:1';
      }

      // N:1 - many from values point to same to value
      if (fromRatio > 1.1 && toRatio <= 1.1) {
        return 'N:1';
      }

      // 1:N - one from value points to many to values
      if (fromRatio <= 1.1 && toRatio > 1.1) {
        return '1:N';
      }

      // N:N - both have many-to-many pattern (shouldn't happen without junction)
      return 'N:N';
    } catch (error) {
      // If query fails, return existing multiplicity
      return relationship.multiplicity;
    }
  }

  /**
   * Get all relationships for a specific table
   */
  getTableRelationships(
    tableName: string,
    relationships: Relationship[]
  ): RelationshipsByDirection {
    const outgoing = relationships.filter(r => r.fromTable === tableName);
    const incoming = relationships.filter(r => r.toTable === tableName);

    return { outgoing, incoming };
  }

  /**
   * Find target table by name (handles singular/plural)
   */
  private findTargetTable(schema: DatabaseSchema, baseName: string) {
    const lowerBaseName = baseName.toLowerCase();

    // Try exact match
    let target = schema.tables.find(t => t.name.toLowerCase() === lowerBaseName);
    if (target) return target;

    // Try plural
    const plural = pluralize(lowerBaseName);
    target = schema.tables.find(t => t.name.toLowerCase() === plural);
    if (target) return target;

    // Try singular
    const singular = pluralize.singular(lowerBaseName);
    target = schema.tables.find(t => t.name.toLowerCase() === singular);
    if (target) return target;

    return undefined;
  }

  /**
   * Calculate confidence score for inferred relationship
   */
  private calculateInferenceConfidence(columnName: string, targetTable: string): number {
    let confidence = 0.7; // Base confidence

    const lowerColumn = columnName.toLowerCase();
    const lowerTable = targetTable.toLowerCase();

    // Exact name match (user_id → users)
    if (lowerColumn.replace('_id', '') === lowerTable) {
      confidence = 0.95;
    }
    // Singular/plural match
    else if (
      pluralize.singular(lowerColumn.replace('_id', '')) === pluralize.singular(lowerTable) ||
      pluralize(lowerColumn.replace('_id', '')) === lowerTable
    ) {
      confidence = 0.90;
    }
    // Partial match
    else if (lowerColumn.includes(lowerTable) || lowerTable.includes(lowerColumn.replace('_id', ''))) {
      confidence = 0.75;
    }

    return confidence;
  }

  /**
   * Analyze all relationships and update multiplicities
   */
  async analyzeMultiplicities(relationships: Relationship[]): Promise<Relationship[]> {
    const analyzed: Relationship[] = [];

    for (const rel of relationships) {
      const multiplicity = await this.calculateMultiplicity(rel);
      analyzed.push({
        ...rel,
        multiplicity
      });
    }

    return analyzed;
  }

  /**
   * Get relationship summary statistics
   */
  getRelationshipStats(relationships: Relationship[]) {
    return {
      total: relationships.length,
      explicit: relationships.filter(r => r.type === 'explicit').length,
      inferred: relationships.filter(r => r.type === 'inferred').length,
      oneToOne: relationships.filter(r => r.multiplicity === '1:1').length,
      oneToMany: relationships.filter(r => r.multiplicity === '1:N').length,
      manyToOne: relationships.filter(r => r.multiplicity === 'N:1').length,
      manyToMany: relationships.filter(r => r.multiplicity === 'N:N').length,
      highConfidence: relationships.filter(r => r.confidence >= 0.9).length,
      mediumConfidence: relationships.filter(r => r.confidence >= 0.7 && r.confidence < 0.9).length,
      lowConfidence: relationships.filter(r => r.confidence < 0.7).length
    };
  }
}
