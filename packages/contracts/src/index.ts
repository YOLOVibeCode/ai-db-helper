/**
 * AI Database Helper - Contracts Package
 *
 * This package contains all interface definitions for the AI Database Helper system.
 * These contracts are immutable and form the foundation for all implementations.
 *
 * @packageDocumentation
 */

// Type definitions
export * from './types/schema-types';
export * from './types/relationship-types';
export * from './types/query-types';

// Database interfaces
export * from './database/IDatabaseAdapter';
export * from './database/ISchemaExtractor';
export * from './database/INoSQLSchemaExtractor';

// Schema interfaces
export * from './schema/ISchemaCache';
export * from './schema/ISchemaFormatter';

// Relationship interfaces
export * from './relationships/IRelationshipAnalyzer';
export * from './relationships/IRelationshipGraph';

// Query interfaces
export * from './query/IQueryPlanner';
export * from './query/IIndexAdvisor';
export * from './query/IQueryExecutor';
export * from './query/ITransactionManager';

// Security interfaces
export * from './security/ICredentialVault';

// Rollback interfaces
export * from './rollback/IRollbackManager';

// Utility interfaces
export * from './utils/ILogger';
export * from './utils/IConfigManager';
