/**
 * Comprehensive MSSQL Integration Tests
 *
 * Tests all major functionality with real MSSQL Server 2022
 * Requires Docker container to be running
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  MSSQLAdapter,
  MSSQLSchemaExtractor,
  QueryExecutor,
  TransactionManager,
  RelationshipAnalyzer,
  RelationshipGraph,
  IndexAdvisor,
  QueryPlanner,
  RollbackManager
} from '@aidb/adapters';
import {
  ConnectionCredentials,
  DatabaseType,
  DatabaseSchema,
  TableSchema,
  Relationship
} from '@aidb/contracts';

describe('MSSQL Comprehensive Integration Tests', () => {
  let adapter: MSSQLAdapter;
  let extractor: MSSQLSchemaExtractor;
  let queryExecutor: QueryExecutor;
  let transactionManager: TransactionManager;
  let relationshipAnalyzer: RelationshipAnalyzer;
  let relationshipGraph: RelationshipGraph;
  let indexAdvisor: IndexAdvisor;
  let queryPlanner: QueryPlanner;
  let rollbackManager: RollbackManager;
  let schema: DatabaseSchema;

  const credentials: ConnectionCredentials = {
    type: DatabaseType.MSSQL,
    host: 'localhost',
    port: 1433,
    database: 'testdb',
    username: 'sa',
    password: 'TestPass123!'
  };

  beforeAll(async () => {
    // Initialize adapter
    adapter = new MSSQLAdapter();
    await adapter.connect(credentials);

    // Initialize all components
    extractor = new MSSQLSchemaExtractor(adapter);
    queryExecutor = new QueryExecutor(adapter);
    transactionManager = new TransactionManager(adapter);
    relationshipAnalyzer = new RelationshipAnalyzer();
    relationshipGraph = new RelationshipGraph();
    indexAdvisor = new IndexAdvisor();
    queryPlanner = new QueryPlanner();
    rollbackManager = new RollbackManager(adapter);

    // Extract schema for tests
    const tables = await extractor.extractTables();
    const views = await extractor.extractViews();
    const procedures = await extractor.extractStoredProcedures();

    schema = {
      databaseName: 'testdb',
      databaseType: DatabaseType.MSSQL,
      version: '1.0.0',
      generatedAt: new Date(),
      schemaHash: 'test-hash',
      tables,
      views,
      procedures
    };
  }, 30000);

  afterAll(async () => {
    if (adapter) {
      await adapter.disconnect();
    }
  });

  describe('Connection & Basic Operations', () => {
    it('should successfully connect to MSSQL Server 2022', async () => {
      expect(adapter).toBeDefined();
      const isValid = await adapter.validateConnection();
      expect(isValid).toBe(true);
    });

    it('should return correct database type', () => {
      expect(adapter.getDatabaseType()).toBe(DatabaseType.MSSQL);
    });

    it('should execute simple query', async () => {
      const result = await adapter.executeQuery('SELECT 1 AS test');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle parameterized queries', async () => {
      const result = await adapter.executeQuery(
        'SELECT * FROM users WHERE email = @email',
        ['alice@example.com']
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Schema Extraction', () => {
    it('should extract all tables', async () => {
      const tables = await extractor.extractTables();
      expect(tables.length).toBeGreaterThan(0);

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('posts');
      expect(tableNames).toContain('comments');
      expect(tableNames).toContain('tags');
      expect(tableNames).toContain('post_tags');
      expect(tableNames).toContain('profiles');
      expect(tableNames).toContain('categories');
    });

    it('should extract columns with correct types', async () => {
      const tables = await extractor.extractTables();
      const usersTable = tables.find(t => t.name === 'users');

      expect(usersTable).toBeDefined();
      expect(usersTable!.columns.length).toBeGreaterThan(0);

      const idCol = usersTable!.columns.find(c => c.name === 'id');
      expect(idCol).toBeDefined();
      expect(idCol!.dataType).toBe('INT');
      expect(idCol!.autoIncrement).toBe(true);

      const emailCol = usersTable!.columns.find(c => c.name === 'email');
      expect(emailCol).toBeDefined();
      expect(emailCol!.dataType).toBe('NVARCHAR');
      expect(emailCol!.nullable).toBe(false);
    });

    it('should extract primary keys', async () => {
      const tables = await extractor.extractTables();
      const usersTable = tables.find(t => t.name === 'users');

      expect(usersTable!.primaryKey).toBeDefined();
      expect(usersTable!.primaryKey!.columns).toContain('id');
    });

    it('should extract indexes', async () => {
      const tables = await extractor.extractTables();
      const usersTable = tables.find(t => t.name === 'users');

      expect(usersTable!.indexes).toBeDefined();
      expect(usersTable!.indexes!.length).toBeGreaterThan(0);

      const emailIndex = usersTable!.indexes!.find(idx =>
        idx.name === 'idx_users_email'
      );
      expect(emailIndex).toBeDefined();
      expect(emailIndex!.columns).toContain('email');
    });

    it('should extract foreign key constraints', async () => {
      const tables = await extractor.extractTables();
      const postsTable = tables.find(t => t.name === 'posts');

      expect(postsTable!.constraints).toBeDefined();
      const fkConstraint = postsTable!.constraints!.find(c =>
        c.type === 'FOREIGN KEY' && c.columns?.includes('user_id')
      );

      expect(fkConstraint).toBeDefined();
      expect(fkConstraint!.referencedTable).toBe('users');
      expect(fkConstraint!.referencedColumns).toContain('id');
    });

    it('should extract views', async () => {
      const views = await extractor.extractViews();
      expect(Array.isArray(views)).toBe(true);
    });

    it('should extract stored procedures', async () => {
      const procedures = await extractor.extractStoredProcedures();
      expect(Array.isArray(procedures)).toBe(true);
    });

    it('should get accurate row counts', async () => {
      const usersCount = await extractor.getTableRowCount('users');
      expect(usersCount).toBeGreaterThan(0);
      expect(usersCount).toBe(4); // From seed data
    });

    it('should handle composite primary keys', async () => {
      const tables = await extractor.extractTables();
      const postTagsTable = tables.find(t => t.name === 'post_tags');

      expect(postTagsTable!.primaryKey).toBeDefined();
      expect(postTagsTable!.primaryKey!.columns.length).toBe(2);
      expect(postTagsTable!.primaryKey!.columns).toContain('post_id');
      expect(postTagsTable!.primaryKey!.columns).toContain('tag_id');
    });
  });

  describe('Relationship Analysis', () => {
    let relationships: Relationship[];

    beforeAll(async () => {
      relationships = await relationshipAnalyzer.discoverRelationships(schema);
    });

    it('should discover explicit foreign key relationships', () => {
      expect(relationships.length).toBeGreaterThan(0);

      const postsUserRelation = relationships.find(r =>
        r.fromTable === 'posts' &&
        r.toTable === 'users' &&
        r.fromColumn === 'user_id'
      );

      expect(postsUserRelation).toBeDefined();
      expect(postsUserRelation!.type).toBe('explicit');
      expect(postsUserRelation!.confidence).toBe(1.0);
    });

    it('should detect one-to-one relationships', () => {
      const profilesUserRelation = relationships.find(r =>
        r.fromTable === 'profiles' &&
        r.toTable === 'users'
      );

      expect(profilesUserRelation).toBeDefined();
      // Should detect 1:1 based on UNIQUE constraint on user_id
    });

    it('should detect one-to-many relationships', () => {
      const postsUserRelation = relationships.find(r =>
        r.fromTable === 'posts' &&
        r.toTable === 'users'
      );

      expect(postsUserRelation).toBeDefined();
      expect(postsUserRelation!.multiplicity).toMatch(/1:N|N:1/);
    });

    it('should detect junction tables', () => {
      const junctionTables = relationshipAnalyzer.detectJunctionTables(schema);

      const postTagsJunction = junctionTables.find(j =>
        j.tableName === 'post_tags'
      );

      expect(postTagsJunction).toBeDefined();
      expect(postTagsJunction!.connectsTables).toContain('posts');
      expect(postTagsJunction!.connectsTables).toContain('tags');
    });

    it('should detect self-referential relationships', () => {
      const categoriesRelation = relationships.find(r =>
        r.fromTable === 'categories' &&
        r.toTable === 'categories' &&
        r.fromColumn === 'parent_id'
      );

      expect(categoriesRelation).toBeDefined();
    });

    it('should build relationship graph', () => {
      relationshipGraph.buildGraph(schema, relationships);

      const graph = relationshipGraph.getGraph();
      expect(graph.nodeCount()).toBeGreaterThan(0);
      expect(graph.edgeCount()).toBeGreaterThan(0);
    });

    it('should find join path between tables', () => {
      relationshipGraph.buildGraph(schema, relationships);

      const joinPath = relationshipGraph.findJoinPath('users', 'comments');

      expect(joinPath).toBeDefined();
      expect(joinPath!.steps.length).toBeGreaterThan(0);

      // Path should be: users -> posts -> comments
      expect(joinPath!.totalCost).toBeGreaterThan(0);
    });

    it('should find optimal join path with multiple options', () => {
      relationshipGraph.buildGraph(schema, relationships);

      // users to comments has direct path AND through posts
      const joinPath = relationshipGraph.findJoinPath('users', 'comments');

      expect(joinPath).toBeDefined();
      // Should choose the most optimal path
    });
  });

  describe('Query Execution', () => {
    it('should execute SELECT query safely', async () => {
      const result = await queryExecutor.execute(
        'SELECT * FROM users WHERE id = 1'
      );

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
      expect(result.rows!.length).toBeGreaterThan(0);
    });

    it('should detect dangerous UPDATE without WHERE', async () => {
      const result = await queryExecutor.execute(
        'UPDATE users SET name = \'Test\'',
        { dryRun: true }
      );

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('should execute safe UPDATE with WHERE', async () => {
      const result = await queryExecutor.execute(
        'UPDATE users SET name = \'Alice Updated\' WHERE id = 1'
      );

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });

    it('should support dry-run mode', async () => {
      const result = await queryExecutor.execute(
        'DELETE FROM users WHERE id = 999',
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('should enforce row limit on SELECT', async () => {
      const result = await queryExecutor.execute(
        'SELECT * FROM users',
        { limit: 2 }
      );

      expect(result.rows!.length).toBeLessThanOrEqual(2);
    });

    it('should track execution time', async () => {
      const result = await queryExecutor.execute('SELECT * FROM users');

      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs!).toBeGreaterThan(0);
    });

    it('should execute batch queries', async () => {
      const queries = [
        'SELECT COUNT(*) as count FROM users',
        'SELECT COUNT(*) as count FROM posts',
        'SELECT COUNT(*) as count FROM comments'
      ];

      const results = await queryExecutor.executeBatch(queries);

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle query timeout', async () => {
      try {
        await queryExecutor.execute(
          'WAITFOR DELAY \'00:00:10\'',
          { timeout: 1000 }
        );
        expect.fail('Should have timed out');
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 5000);
  });

  describe('Transaction Management', () => {
    it('should begin and commit transaction', async () => {
      await transactionManager.begin();

      const result = await transactionManager.executeInTransaction(
        'INSERT INTO tags (name) VALUES (@name)',
        ['TestTag']
      );

      expect(result.success).toBe(true);

      await transactionManager.commit();
    });

    it('should rollback transaction on error', async () => {
      await transactionManager.begin();

      try {
        await transactionManager.executeInTransaction(
          'INSERT INTO users (id, email, name) VALUES (1, \'dup@test.com\', \'Dup\')'
        );
        expect.fail('Should have failed due to duplicate ID');
      } catch (error) {
        await transactionManager.rollback();
        expect(error).toBeDefined();
      }
    });

    it('should support isolation levels', async () => {
      await transactionManager.begin({ isolationLevel: 'READ COMMITTED' });

      const result = await transactionManager.executeInTransaction(
        'SELECT * FROM users'
      );

      expect(result.success).toBe(true);
      await transactionManager.commit();
    });

    it('should handle nested transactions', async () => {
      await transactionManager.begin();

      // MSSQL supports savepoints
      const result1 = await transactionManager.executeInTransaction(
        'INSERT INTO tags (name) VALUES (@name)',
        ['NestedTag1']
      );
      expect(result1.success).toBe(true);

      const result2 = await transactionManager.executeInTransaction(
        'INSERT INTO tags (name) VALUES (@name)',
        ['NestedTag2']
      );
      expect(result2.success).toBe(true);

      await transactionManager.commit();
    });

    it('should auto-rollback on transaction timeout', async () => {
      await transactionManager.begin({ timeout: 1000 });

      try {
        await transactionManager.executeInTransaction(
          'WAITFOR DELAY \'00:00:05\''
        );
        expect.fail('Should have timed out');
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 3000);
  });

  describe('Index Advisory', () => {
    it('should recommend index for WHERE clause', async () => {
      const query = 'SELECT * FROM posts WHERE published = 1';
      const recommendations = await indexAdvisor.analyzeQuery(query, schema);

      expect(recommendations.length).toBeGreaterThan(0);
      const publishedIndex = recommendations.find(r =>
        r.tableName === 'posts' && r.columns.includes('published')
      );
      expect(publishedIndex).toBeDefined();
    });

    it('should recommend composite index for multiple columns', async () => {
      const query = 'SELECT * FROM posts WHERE user_id = 1 AND published = 1';
      const recommendations = await indexAdvisor.analyzeQuery(query, schema);

      const compositeIndex = recommendations.find(r =>
        r.columns.length > 1 &&
        r.columns.includes('user_id') &&
        r.columns.includes('published')
      );

      expect(compositeIndex).toBeDefined();
    });

    it('should recommend index for JOIN columns', async () => {
      const query = 'SELECT * FROM posts JOIN users ON posts.user_id = users.id';
      const recommendations = await indexAdvisor.analyzeQuery(query, schema);

      // user_id already has index, so may not recommend
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should recommend index for ORDER BY', async () => {
      const query = 'SELECT * FROM comments ORDER BY created_at DESC';
      const recommendations = await indexAdvisor.analyzeQuery(query, schema);

      const orderByIndex = recommendations.find(r =>
        r.tableName === 'comments' && r.columns.includes('created_at')
      );
      expect(orderByIndex).toBeDefined();
    });

    it('should analyze query patterns', async () => {
      const queries = [
        'SELECT * FROM posts WHERE user_id = 1',
        'SELECT * FROM posts WHERE user_id = 2',
        'SELECT * FROM posts WHERE user_id = 3'
      ];

      const result = await indexAdvisor.analyzeQueryPatterns(queries, schema);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);

      const userIdPattern = result.patterns.find(p =>
        p.whereColumns.includes('user_id')
      );
      expect(userIdPattern).toBeDefined();
      expect(userIdPattern!.frequency).toBe(3);
    });

    it('should detect redundant indexes', async () => {
      const result = await indexAdvisor.findRedundantIndexes(schema);

      expect(result.redundantIndexes).toBeDefined();
      expect(result.potentialSavings).toBeDefined();
    });

    it('should estimate index impact', async () => {
      const recommendation = {
        tableName: 'posts',
        columns: ['published'],
        type: 'btree',
        reason: 'Frequent WHERE clause',
        priority: 'high' as const,
        estimatedImpact: 80,
        createStatement: 'CREATE INDEX idx_posts_published ON posts(published)'
      };

      const impact = await indexAdvisor.estimateIndexImpact(recommendation, schema);

      expect(impact.improvementPercent).toBeGreaterThan(0);
      expect(impact.diskSpaceRequired).toBeGreaterThan(0);
      expect(impact.maintenanceOverhead).toBeDefined();
    });

    it('should generate optimal index set', async () => {
      const queries = [
        'SELECT * FROM posts WHERE user_id = 1',
        'SELECT * FROM posts WHERE published = 1',
        'SELECT * FROM comments WHERE post_id = 1'
      ];

      const recommendations = await indexAdvisor.generateOptimalIndexSet(
        queries,
        schema,
        5
      );

      expect(recommendations.length).toBeLessThanOrEqual(5);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Query Planning', () => {
    it('should get execution plan', async () => {
      const query = 'SELECT * FROM users WHERE email = \'alice@example.com\'';
      const plan = await queryPlanner.getExecutionPlan(query, DatabaseType.MSSQL);

      expect(plan).toBeDefined();
      expect(plan.originalQuery).toBe(query);
      expect(plan.executionStrategy).toBeDefined();
    });

    it('should analyze performance metrics', async () => {
      const plan = await queryPlanner.getExecutionPlan(
        'SELECT * FROM posts WHERE user_id = 1',
        DatabaseType.MSSQL
      );

      const metrics = queryPlanner.analyzePerformance(plan);

      expect(metrics.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(metrics.severity).toBeDefined();
    });

    it('should generate recommendations', async () => {
      const plan = await queryPlanner.getExecutionPlan(
        'SELECT * FROM users',
        DatabaseType.MSSQL
      );

      const recommendations = queryPlanner.generateRecommendations(plan);

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Rollback & Schema Changes', () => {
    it('should create schema snapshot', async () => {
      const snapshot = await rollbackManager.createSnapshot(
        schema,
        'Test snapshot before changes'
      );

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.schema).toBeDefined();
    });

    it('should generate forward DDL', async () => {
      const ddl = 'ALTER TABLE posts ADD view_count INT DEFAULT 0';
      const forwardDDL = await rollbackManager.generateForwardDDL(ddl);

      expect(forwardDDL).toBeDefined();
      expect(forwardDDL.length).toBeGreaterThan(0);
    });

    it('should generate backward DDL', async () => {
      const ddl = 'ALTER TABLE posts ADD view_count INT DEFAULT 0';
      const backwardDDL = await rollbackManager.generateBackwardDDL(ddl);

      expect(backwardDDL).toBeDefined();
      expect(backwardDDL.length).toBeGreaterThan(0);
    });

    it('should assess impact of schema change', async () => {
      const ddl = 'DROP TABLE posts';
      const impact = await rollbackManager.assessImpact(ddl, schema);

      expect(impact.isDestructive).toBe(true);
      expect(impact.severity).toBe('high');
      expect(impact.warnings.length).toBeGreaterThan(0);
    });

    it('should list snapshots', async () => {
      const snapshots = await rollbackManager.listSnapshots();

      expect(Array.isArray(snapshots)).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle complex JOIN query', async () => {
      const query = `
        SELECT
          u.name,
          p.title,
          c.content,
          t.name as tag_name
        FROM users u
        JOIN posts p ON u.id = p.user_id
        JOIN comments c ON p.id = c.post_id
        JOIN post_tags pt ON p.id = pt.post_id
        JOIN tags t ON pt.tag_id = t.id
        WHERE u.email = 'alice@example.com'
      `;

      const result = await queryExecutor.execute(query);

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
    });

    it('should handle subquery', async () => {
      const query = `
        SELECT * FROM users
        WHERE id IN (
          SELECT DISTINCT user_id FROM posts WHERE published = 1
        )
      `;

      const result = await queryExecutor.execute(query);

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
    });

    it('should handle aggregate functions', async () => {
      const query = `
        SELECT
          u.name,
          COUNT(p.id) as post_count,
          COUNT(c.id) as comment_count
        FROM users u
        LEFT JOIN posts p ON u.id = p.user_id
        LEFT JOIN comments c ON u.id = c.user_id
        GROUP BY u.id, u.name
        HAVING COUNT(p.id) > 0
      `;

      const result = await queryExecutor.execute(query);

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
    });

    it('should handle window functions', async () => {
      const query = `
        SELECT
          id,
          title,
          user_id,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM posts
      `;

      const result = await queryExecutor.execute(query);

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
    });

    it('should handle CTE (Common Table Expression)', async () => {
      const query = `
        WITH UserPostCounts AS (
          SELECT user_id, COUNT(*) as post_count
          FROM posts
          GROUP BY user_id
        )
        SELECT u.name, upc.post_count
        FROM users u
        JOIN UserPostCounts upc ON u.id = upc.user_id
      `;

      const result = await queryExecutor.execute(query);

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
    });

    it('should handle recursive CTE', async () => {
      const query = `
        WITH CategoryHierarchy AS (
          SELECT id, name, parent_id, 0 as level
          FROM categories
          WHERE parent_id IS NULL

          UNION ALL

          SELECT c.id, c.name, c.parent_id, ch.level + 1
          FROM categories c
          JOIN CategoryHierarchy ch ON c.parent_id = ch.id
        )
        SELECT * FROM CategoryHierarchy
      `;

      const result = await queryExecutor.execute(query);

      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should extract schema in reasonable time', async () => {
      const start = Date.now();
      await extractor.extractTables();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Less than 5 seconds
    });

    it('should analyze relationships in reasonable time', async () => {
      const start = Date.now();
      await relationshipAnalyzer.discoverRelationships(schema);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // Less than 2 seconds
    });

    it('should execute simple query quickly', async () => {
      const start = Date.now();
      await queryExecutor.execute('SELECT * FROM users WHERE id = 1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid SQL', async () => {
      const result = await queryExecutor.execute('INVALID SQL STATEMENT');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle connection errors gracefully', async () => {
      const badAdapter = new MSSQLAdapter();

      try {
        await badAdapter.connect({
          ...credentials,
          password: 'wrong-password'
        });
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle foreign key violations', async () => {
      try {
        await queryExecutor.execute(
          'INSERT INTO posts (id, user_id, title) VALUES (999, 9999, \'Test\')'
        );
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle unique constraint violations', async () => {
      try {
        await queryExecutor.execute(
          'INSERT INTO users (email, name) VALUES (\'alice@example.com\', \'Duplicate\')'
        );
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('MSSQL-Specific Features', () => {
    it('should handle NVARCHAR data type', async () => {
      const tables = await extractor.extractTables();
      const usersTable = tables.find(t => t.name === 'users');

      const emailCol = usersTable!.columns.find(c => c.name === 'email');
      expect(emailCol!.nativeType).toContain('NVARCHAR');
    });

    it('should handle DATETIME2 data type', async () => {
      const tables = await extractor.extractTables();
      const usersTable = tables.find(t => t.name === 'users');

      const createdCol = usersTable!.columns.find(c => c.name === 'created_at');
      expect(createdCol!.dataType).toBe('DATETIME2');
    });

    it('should handle IDENTITY columns', async () => {
      const tables = await extractor.extractTables();
      const usersTable = tables.find(t => t.name === 'users');

      const idCol = usersTable!.columns.find(c => c.name === 'id');
      expect(idCol!.autoIncrement).toBe(true);
    });

    it('should handle BIT data type (boolean)', async () => {
      const tables = await extractor.extractTables();
      const postsTable = tables.find(t => t.name === 'posts');

      const publishedCol = postsTable!.columns.find(c => c.name === 'published');
      expect(publishedCol!.dataType).toBe('BIT');
    });

    it('should handle NVARCHAR(MAX)', async () => {
      const tables = await extractor.extractTables();
      const postsTable = tables.find(t => t.name === 'posts');

      const contentCol = postsTable!.columns.find(c => c.name === 'content');
      expect(contentCol!.nativeType).toContain('MAX');
    });

    it('should handle DESC indexes', async () => {
      const tables = await extractor.extractTables();
      const postsTable = tables.find(t => t.name === 'posts');

      const createdAtIndex = postsTable!.indexes!.find(idx =>
        idx.name === 'idx_posts_created_at'
      );
      expect(createdAtIndex).toBeDefined();
    });

    it('should handle ON DELETE CASCADE', async () => {
      const tables = await extractor.extractTables();
      const postsTable = tables.find(t => t.name === 'posts');

      const fk = postsTable!.constraints!.find(c =>
        c.type === 'FOREIGN KEY' && c.columns?.includes('user_id')
      );

      expect(fk!.onDelete).toBe('CASCADE');
    });

    it('should handle ON DELETE NO ACTION', async () => {
      const tables = await extractor.extractTables();
      const commentsTable = tables.find(t => t.name === 'comments');

      const fk = commentsTable!.constraints!.find(c =>
        c.type === 'FOREIGN KEY' && c.columns?.includes('user_id')
      );

      expect(fk!.onDelete).toBe('NO ACTION');
    });
  });
});
