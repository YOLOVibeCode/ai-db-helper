# Interface Definitions - Complete Reference

> **Purpose**: This document contains all TypeScript interface definitions that will be implemented in the `contracts/` project. These interfaces form the immutable contracts for the AI Database Helper system.

---

## Table of Contents

1. [Core Type Definitions](#core-type-definitions)
2. [Database Adapter Interfaces](#database-adapter-interfaces)
3. [Schema Management Interfaces](#schema-management-interfaces)
4. [Relationship Intelligence Interfaces](#relationship-intelligence-interfaces)
5. [Query Planning Interfaces](#query-planning-interfaces)
6. [Security Interfaces](#security-interfaces)
7. [Rollback Interfaces](#rollback-interfaces)

---

## Core Type Definitions

### schema-types.ts

```typescript
/**
 * Supported database types
 */
export enum DatabaseType {
  MySQL = 'mysql',
  PostgreSQL = 'postgres',
  MSSQL = 'mssql',
  SQLite = 'sqlite',
  MongoDB = 'mongodb',
  DB2 = 'db2',
  Oracle = 'oracle',
  AzureSQL = 'azure-sql'
}

/**
 * Complete database schema representation
 */
export interface DatabaseSchema {
  databaseName: string;
  databaseType: DatabaseType;
  version: string;
  generatedAt: Date;
  schemaHash: string;
  tables: TableSchema[];
  views: ViewSchema[];
  procedures: ProcedureSchema[];
  relationships?: Relationship[];
  junctionTables?: JunctionTable[];
  quickJoinPaths?: Map<string, JoinPath[]>;
  metadata?: SchemaMetadata;
}

/**
 * Table schema definition
 */
export interface TableSchema {
  name: string;
  schema?: string; // For databases that support schemas (e.g., PostgreSQL)
  columns: ColumnSchema[];
  primaryKey?: PrimaryKeySchema;
  indexes: IndexSchema[];
  constraints: ConstraintSchema[];
  rowCount?: number;
  sizeBytes?: number;
  comment?: string;
}

/**
 * Column schema definition
 */
export interface ColumnSchema {
  name: string;
  dataType: string;
  nativeType: string; // Database-specific type
  nullable: boolean;
  defaultValue?: any;
  autoIncrement?: boolean;
  comment?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  enumValues?: string[]; // For ENUM types
  frequency?: number; // For MongoDB: % of documents with this field
}

/**
 * Primary key definition
 */
export interface PrimaryKeySchema {
  name?: string;
  columns: string[];
}

/**
 * Index schema definition
 */
export interface IndexSchema {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  type: IndexType;
  partial?: boolean; // Partial index (PostgreSQL)
  where?: string; // WHERE clause for partial index
}

export enum IndexType {
  BTree = 'btree',
  Hash = 'hash',
  GIN = 'gin',       // PostgreSQL generalized inverted index
  GiST = 'gist',     // PostgreSQL generalized search tree
  FullText = 'fulltext',
  Spatial = 'spatial',
  Clustered = 'clustered',
  NonClustered = 'nonclustered'
}

/**
 * Constraint schema definition
 */
export interface ConstraintSchema {
  name: string;
  type: ConstraintType;
  tableName: string;
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  checkExpression?: string; // For CHECK constraints
}

export enum ConstraintType {
  PrimaryKey = 'PRIMARY KEY',
  ForeignKey = 'FOREIGN KEY',
  Unique = 'UNIQUE',
  Check = 'CHECK',
  NotNull = 'NOT NULL'
}

export enum ReferentialAction {
  NoAction = 'NO ACTION',
  Cascade = 'CASCADE',
  SetNull = 'SET NULL',
  SetDefault = 'SET DEFAULT',
  Restrict = 'RESTRICT'
}

/**
 * Stored procedure schema
 */
export interface ProcedureSchema {
  name: string;
  schema?: string;
  parameters: ParameterSchema[];
  returnType?: string;
  language?: string; // SQL, PLPGSQL, etc.
  definition?: string;
}

export interface ParameterSchema {
  name: string;
  dataType: string;
  mode: 'IN' | 'OUT' | 'INOUT';
  defaultValue?: any;
}

/**
 * View schema definition
 */
export interface ViewSchema {
  name: string;
  schema?: string;
  definition: string;
  columns: ColumnSchema[];
}

/**
 * Schema metadata
 */
export interface SchemaMetadata {
  extractedAt: Date;
  extractionDurationMs: number;
  tableCount: number;
  relationshipCount: number;
  totalRowCount?: number;
  totalSizeBytes?: number;
}

/**
 * Connection credentials
 */
export interface ConnectionCredentials {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
  sslOptions?: SSLOptions;
  azureAuth?: AzureAuthOptions; // For Azure SQL
  mongoOptions?: MongoConnectionOptions; // For MongoDB
}

export interface SSLOptions {
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export interface AzureAuthOptions {
  method: 'managed-identity' | 'service-principal' | 'sql-auth';
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface MongoConnectionOptions {
  replicaSet?: string;
  authSource?: string;
  authMechanism?: string;
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  databaseName: string;
  schemaHash: string;
  lastRefresh: Date;
  version: string;
  compressed: boolean;
  sizeBytes: number;
}

/**
 * Table filter for schema extraction
 */
export interface TableFilter {
  includeSchemas?: string[];
  includeTables?: string[];
  excludeTables?: string[];
  tablePatterns?: string[]; // Wildcard patterns
}
```

---

## Database Adapter Interfaces

### IDatabaseAdapter.ts

```typescript
import { ConnectionCredentials, DatabaseType } from '../types/schema-types';

/**
 * Core database connection interface
 * All database adapters must implement this interface
 */
export interface IDatabaseAdapter {
  /**
   * Establish connection to database
   */
  connect(credentials: ConnectionCredentials): Promise<void>;

  /**
   * Close database connection
   */
  disconnect(): Promise<void>;

  /**
   * Validate that connection is active
   */
  validateConnection(): Promise<boolean>;

  /**
   * Execute a raw SQL query
   * @param sql - SQL query string
   * @param params - Query parameters (for parameterized queries)
   */
  executeQuery<T = any>(sql: string, params?: any[]): Promise<T>;

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType;

  /**
   * Get current database name
   */
  getDatabaseName(): string;

  /**
   * Test connection with timeout
   */
  ping(timeoutMs?: number): Promise<boolean>;
}

/**
 * Connection pool management
 */
export interface IConnectionPool {
  /**
   * Get connection from pool
   */
  getConnection(): Promise<IDatabaseAdapter>;

  /**
   * Release connection back to pool
   */
  releaseConnection(connection: IDatabaseAdapter): Promise<void>;

  /**
   * Close all connections in pool
   */
  closeAll(): Promise<void>;

  /**
   * Get pool statistics
   */
  getStats(): PoolStats;
}

export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
}
```

### ISchemaExtractor.ts

```typescript
import {
  TableSchema,
  ViewSchema,
  ProcedureSchema,
  IndexSchema,
  ConstraintSchema,
  TableFilter
} from '../types/schema-types';

/**
 * Schema extraction interface
 * Database-specific implementations extract schema information
 */
export interface ISchemaExtractor {
  /**
   * Extract all tables from database
   * @param filter - Optional filter for table selection
   */
  extractTables(filter?: TableFilter): Promise<TableSchema[]>;

  /**
   * Extract all views
   */
  extractViews(): Promise<ViewSchema[]>;

  /**
   * Extract stored procedures
   */
  extractStoredProcedures(): Promise<ProcedureSchema[]>;

  /**
   * Extract indexes for a specific table or all tables
   */
  extractIndexes(tableName?: string): Promise<IndexSchema[]>;

  /**
   * Extract constraints for a specific table or all tables
   */
  extractConstraints(tableName?: string): Promise<ConstraintSchema[]>;

  /**
   * Get row count for a table
   */
  getTableRowCount(tableName: string): Promise<number>;

  /**
   * Get table size in bytes
   */
  getTableSize(tableName: string): Promise<number>;

  /**
   * Get list of all schemas (for databases that support schemas)
   */
  getSchemas(): Promise<string[]>;
}
```

---

## Schema Management Interfaces

### ISchemaCache.ts

```typescript
import { DatabaseSchema, CacheMetadata } from '../types/schema-types';

/**
 * Schema caching interface
 */
export interface ISchemaCache {
  /**
   * Save schema to cache
   */
  save(databaseName: string, schema: DatabaseSchema): Promise<void>;

  /**
   * Load schema from cache
   * @returns null if cache doesn't exist
   */
  load(databaseName: string): Promise<DatabaseSchema | null>;

  /**
   * Invalidate (delete) cached schema
   */
  invalidate(databaseName: string): Promise<void>;

  /**
   * Get cache metadata without loading full schema
   */
  getMetadata(databaseName: string): Promise<CacheMetadata | null>;

  /**
   * Check if cache exists for database
   */
  exists(databaseName: string): Promise<boolean>;

  /**
   * List all cached databases
   */
  list(): Promise<string[]>;

  /**
   * Get cache directory path
   */
  getCachePath(databaseName: string): string;
}
```

### ISchemaFormatter.ts

```typescript
import { DatabaseSchema } from '../types/schema-types';

/**
 * Schema formatting interface for different output formats
 */
export interface ISchemaFormatter {
  /**
   * Format schema as compact JSON (token-efficient for AI)
   */
  toCompactJSON(schema: DatabaseSchema): string;

  /**
   * Format schema as human-readable Markdown
   */
  toMarkdown(schema: DatabaseSchema, options?: MarkdownOptions): string;

  /**
   * Format schema as DDL (CREATE statements)
   */
  toDDL(schema: DatabaseSchema, options?: DDLOptions): string;

  /**
   * Format schema as Mermaid ER diagram
   */
  toMermaidER(schema: DatabaseSchema, options?: MermaidOptions): string;

  /**
   * Format schema as TypeScript interfaces
   */
  toTypeScript(schema: DatabaseSchema, options?: TypeScriptOptions): string;

  /**
   * Format schema as GraphViz DOT
   */
  toGraphViz(schema: DatabaseSchema): string;
}

export interface MarkdownOptions {
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  includeRelationships?: boolean;
  includeStats?: boolean;
  tableOfContents?: boolean;
}

export interface DDLOptions {
  includeDropStatements?: boolean;
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  databaseType?: string; // Target SQL dialect
}

export interface MermaidOptions {
  includeMultiplicity?: boolean;
  includeAttributes?: boolean;
  maxTablesPerDiagram?: number;
}

export interface TypeScriptOptions {
  includeComments?: boolean;
  includeValidation?: boolean;
  exportTypes?: boolean;
  interfacePrefix?: string;
}
```

---

## Relationship Intelligence Interfaces

### relationship-types.ts

```typescript
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
  confidence: number; // 0.0 to 1.0
}

/**
 * Junction table (for many-to-many relationships)
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
  distance: number; // Hops from source table
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
  weight: number; // For pathfinding
}
```

### IRelationshipAnalyzer.ts

```typescript
import { Relationship, JunctionTable, Multiplicity } from '../types/relationship-types';
import { DatabaseSchema } from '../types/schema-types';

/**
 * Relationship discovery and analysis interface
 */
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

export interface RelationshipsByDirection {
  outgoing: Relationship[]; // Foreign keys in this table
  incoming: Relationship[]; // Foreign keys pointing to this table
}
```

### IRelationshipGraph.ts

```typescript
import {
  Graph,
  JoinPath,
  RelatedTable,
  Relationship,
  JunctionTable
} from '../types/relationship-types';
import { DatabaseSchema } from '../types/schema-types';

/**
 * Relationship graph builder and navigator
 */
export interface IRelationshipGraph {
  /**
   * Build graph from schema and relationships
   */
  buildGraph(
    schema: DatabaseSchema,
    relationships: Relationship[]
  ): Graph;

  /**
   * Find optimal join path between two tables
   */
  findJoinPath(
    fromTable: string,
    toTable: string,
    maxHops?: number
  ): JoinPath[];

  /**
   * Get all related tables within max depth
   */
  getRelatedTables(
    tableName: string,
    maxDepth: number
  ): RelatedTable[];

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
  calculateEdgeWeight(
    from: string,
    to: string,
    relationship: Relationship
  ): number;
}
```

---

## Query Planning Interfaces

### query-types.ts

```typescript
/**
 * Query execution plan
 */
export interface QueryPlan {
  originalQuery: string;
  optimizedQuery?: string;
  estimatedCost: number;
  usedIndexes: string[];
  suggestedIndexes: IndexSuggestion[];
  warnings: QueryWarning[];
  joinOrder: JoinStep[];
  executionStrategy: ExecutionStrategy;
  explainOutput: any; // Raw EXPLAIN output
}

export type ExecutionStrategy =
  | 'nested-loop'
  | 'hash-join'
  | 'merge-join'
  | 'index-scan'
  | 'table-scan';

/**
 * Index suggestion
 */
export interface IndexSuggestion {
  tableName: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'fulltext';
  reason: string;
  estimatedImprovement: number; // Percentage
  priority: 'low' | 'medium' | 'high';
  createStatement: string;
}

/**
 * Query warning
 */
export interface QueryWarning {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion: string;
  affectedTable?: string;
}

/**
 * Query cost estimate
 */
export interface QueryCostEstimate {
  totalCost: number;
  startupCost: number;
  estimatedRows: number;
  estimatedWidth?: number;
  executionTimeMs?: number;
}

/**
 * Index recommendation
 */
export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  type: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: number;
  usageCount?: number; // How many queries would benefit
  createStatement: string;
}

/**
 * Join clause
 */
export interface JoinClause {
  table: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  onCondition: string;
  estimatedRows?: number;
}
```

### IQueryPlanner.ts

```typescript
import {
  QueryPlan,
  IndexSuggestion,
  QueryCostEstimate,
  JoinClause
} from '../types/query-types';

/**
 * Query planning and optimization interface
 */
export interface IQueryPlanner {
  /**
   * Analyze query and generate execution plan
   */
  analyzeQuery(sql: string): Promise<QueryPlan>;

  /**
   * Suggest indexes for a query
   */
  suggestIndexes(sql: string): Promise<IndexSuggestion[]>;

  /**
   * Estimate query cost
   */
  estimateCost(sql: string): Promise<QueryCostEstimate>;

  /**
   * Optimize join order
   */
  optimizeJoinOrder(joins: JoinClause[]): JoinClause[];

  /**
   * Rewrite query for optimization
   */
  rewriteQuery(sql: string): Promise<string>;

  /**
   * Execute EXPLAIN command
   */
  explainQuery(sql: string, analyze?: boolean): Promise<any>;
}
```

### IIndexAdvisor.ts

```typescript
import { IndexRecommendation, IndexSuggestion } from '../types/query-types';

/**
 * Index recommendation and analysis interface
 */
export interface IIndexAdvisor {
  /**
   * Analyze table usage and recommend indexes
   */
  analyzeTableUsage(tableName: string): Promise<IndexRecommendation[]>;

  /**
   * Detect missing indexes from query log
   */
  detectMissingIndexes(queryLog: Query[]): Promise<IndexRecommendation[]>;

  /**
   * Score index effectiveness
   */
  scoreIndexEffectiveness(indexDef: IndexDefinition): Promise<number>;

  /**
   * Get existing indexes for table
   */
  getExistingIndexes(tableName: string): Promise<IndexDefinition[]>;

  /**
   * Check if index exists
   */
  hasIndexOn(tableName: string, columns: string[]): Promise<boolean>;
}

export interface Query {
  sql: string;
  executionCount: number;
  averageTimeMs: number;
  lastExecuted: Date;
}

export interface IndexDefinition {
  name: string;
  tableName: string;
  columns: string[];
  type: string;
  unique: boolean;
  sizeBytes?: number;
  usageCount?: number;
}
```

---

## Security Interfaces

### ICredentialVault.ts

```typescript
import { ConnectionCredentials } from '../types/schema-types';

/**
 * Credential storage and encryption interface
 */
export interface ICredentialVault {
  /**
   * Store encrypted credentials
   */
  store(databaseName: string, credentials: ConnectionCredentials): Promise<void>;

  /**
   * Retrieve and decrypt credentials
   */
  retrieve(databaseName: string): Promise<ConnectionCredentials | null>;

  /**
   * Delete stored credentials
   */
  delete(databaseName: string): Promise<void>;

  /**
   * List all stored database names
   */
  list(): Promise<string[]>;

  /**
   * Check if credentials exist for database
   */
  exists(databaseName: string): Promise<boolean>;

  /**
   * Rotate credentials (update existing)
   */
  rotate(databaseName: string, newCredentials: ConnectionCredentials): Promise<void>;

  /**
   * Validate encryption integrity
   */
  validateIntegrity(): Promise<boolean>;
}

/**
 * Encryption service interface
 */
export interface IEncryptionService {
  /**
   * Encrypt data
   */
  encrypt(plaintext: string, key: Buffer): EncryptedData;

  /**
   * Decrypt data
   */
  decrypt(encrypted: EncryptedData, key: Buffer): string;

  /**
   * Derive key from password
   */
  deriveKey(password: string, salt: Buffer): Promise<Buffer>;

  /**
   * Generate random salt
   */
  generateSalt(): Buffer;

  /**
   * Generate random IV
   */
  generateIV(): Buffer;
}

export interface EncryptedData {
  encrypted: string; // Base64 encoded
  iv: string; // Base64 encoded
  salt: string; // Base64 encoded
  authTag: string; // Base64 encoded (for GCM)
  algorithm: string;
}
```

---

## Rollback Interfaces

### IRollbackManager.ts

```typescript
import { DatabaseSchema } from '../types/schema-types';

/**
 * Rollback and snapshot management interface
 */
export interface IRollbackManager {
  /**
   * Create schema snapshot before changes
   */
  createSnapshot(
    databaseName: string,
    preChangeSchema: DatabaseSchema,
    message?: string
  ): Promise<string>; // Returns snapshot ID

  /**
   * Generate rollback script by comparing schemas
   */
  generateRollbackScript(
    before: DatabaseSchema,
    after: DatabaseSchema
  ): string;

  /**
   * Execute rollback to specific snapshot
   */
  executeRollback(snapshotId: string): Promise<void>;

  /**
   * List available snapshots for database
   */
  listSnapshots(databaseName: string): Promise<SnapshotMetadata[]>;

  /**
   * Get snapshot details
   */
  getSnapshot(snapshotId: string): Promise<Snapshot | null>;

  /**
   * Delete snapshot
   */
  deleteSnapshot(snapshotId: string): Promise<void>;
}

export interface Snapshot {
  id: string;
  databaseName: string;
  schema: DatabaseSchema;
  message: string;
  createdAt: Date;
  rollbackScript: string;
}

export interface SnapshotMetadata {
  id: string;
  databaseName: string;
  message: string;
  createdAt: Date;
  schemaHash: string;
  sizeBytes: number;
}

/**
 * Schema change guard interface
 */
export interface ISchemaChangeGuard {
  /**
   * Validate schema change SQL
   */
  validateChange(sql: string): ValidationResult;

  /**
   * Assess risk level of change
   */
  assessRisk(change: SchemaChange): RiskLevel;

  /**
   * Parse DDL statement
   */
  parseDDL(sql: string): SchemaChange;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type RiskLevel = 'safe' | 'moderate' | 'dangerous';

export interface SchemaChange {
  type: 'ADD_COLUMN' | 'DROP_COLUMN' | 'RENAME_TABLE' | 'DROP_TABLE' |
        'ADD_INDEX' | 'DROP_INDEX' | 'ALTER_COLUMN' | 'ADD_CONSTRAINT' |
        'DROP_CONSTRAINT';
  tableName: string;
  details: any;
  sql: string;
}
```

---

## Utility Interfaces

### ILogger.ts

```typescript
/**
 * Logging interface
 */
export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
  setLevel(level: LogLevel): void;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
```

### IConfigManager.ts

```typescript
/**
 * Configuration management interface
 */
export interface IConfigManager {
  load(): Promise<Config>;
  save(config: Config): Promise<void>;
  get<T>(key: string): T | undefined;
  set(key: string, value: any): Promise<void>;
  exists(): Promise<boolean>;
}

export interface Config {
  version: string;
  databases: Record<string, DatabaseConfig>;
  security: SecurityConfig;
  cache: CacheConfig;
}

export interface DatabaseConfig {
  type: string;
  connectionString?: string;
  lastRefresh?: Date;
  autoRefresh: boolean;
  schemaHash?: string;
  defaultFormat: string;
  schemaSubset?: SchemaSubsetConfig;
  relationships?: RelationshipConfig;
  queryPlanning?: QueryPlanningConfig;
}

export interface SchemaSubsetConfig {
  enabled: boolean;
  includeSchemas?: string[];
  includeTables?: string[];
  excludeTables?: string[];
}

export interface RelationshipConfig {
  includeInferred: boolean;
  inferenceConfidenceThreshold: number;
  autoDetectJunctions: boolean;
}

export interface QueryPlanningConfig {
  enabled: boolean;
  trackQueryLog: boolean;
  indexSuggestions: boolean;
}

export interface SecurityConfig {
  encryptionAlgorithm: string;
  credentialTimeout: number;
}

export interface CacheConfig {
  maxAge: number;
  compressionEnabled: boolean;
}
```

---

## Index Export

**File: `contracts/index.ts`**

```typescript
// Type definitions
export * from './types/schema-types';
export * from './types/relationship-types';
export * from './types/query-types';

// Database interfaces
export * from './database/IDatabaseAdapter';
export * from './database/ISchemaExtractor';

// Schema interfaces
export * from './schema/ISchemaCache';
export * from './schema/ISchemaFormatter';

// Relationship interfaces
export * from './relationships/IRelationshipAnalyzer';
export * from './relationships/IRelationshipGraph';

// Query interfaces
export * from './query/IQueryPlanner';
export * from './query/IIndexAdvisor';

// Security interfaces
export * from './security/ICredentialVault';

// Rollback interfaces
export * from './rollback/IRollbackManager';

// Utility interfaces
export * from './utils/ILogger';
export * from './utils/IConfigManager';
```

---

**END OF INTERFACE DEFINITIONS**

These interfaces form the complete contract system for AI Database Helper. All implementations must conform to these interfaces exactly.
