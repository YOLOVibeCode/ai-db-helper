/**
 * Core schema type definitions for AI Database Helper
 * These types form the foundation of all schema representations
 */

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
  relationships?: any[]; // Relationship[] - avoid circular dependency
  junctionTables?: any[]; // JunctionTable[] - avoid circular dependency
  quickJoinPaths?: Map<string, any[]>; // Map<string, JoinPath[]> - avoid circular dependency
  metadata?: SchemaMetadata;
}

/**
 * Table schema definition
 */
export interface TableSchema {
  name: string;
  schema?: string;
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
  nativeType: string;
  nullable: boolean;
  defaultValue?: any;
  autoIncrement?: boolean;
  comment?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  enumValues?: string[];
  frequency?: number;
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
  partial?: boolean;
  where?: string;
}

export enum IndexType {
  BTree = 'btree',
  Hash = 'hash',
  GIN = 'gin',
  GiST = 'gist',
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
  checkExpression?: string;
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
  language?: string;
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
  azureAuth?: AzureAuthOptions;
  mongoOptions?: MongoConnectionOptions;
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
  tablePatterns?: string[];
}
