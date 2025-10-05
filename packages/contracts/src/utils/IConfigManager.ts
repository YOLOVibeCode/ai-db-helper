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
