# AI Database Helper (aidb)

> **AI-optimized database schema utility for intelligent database interaction**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

AI Database Helper (aidb) is a command-line utility that creates AI-optimized representations of database schemas, enabling AI assistants to interact with databases intelligently and efficiently.

## Features

- **Multi-Database Support**: MySQL, PostgreSQL, MSSQL, SQLite, MongoDB, DB2, Oracle, Azure SQL
- **Relationship Intelligence**: Automatic discovery of explicit and inferred relationships with multiplicity detection (1:1, 1:N, N:N)
- **Query Planning**: AI-assisted query optimization with index recommendations
- **Schema Caching**: Lightning-fast schema retrieval (<100ms) from local cache
- **Safe Schema Modifications**: Snapshot and rollback system for safe database changes
- **AI-Optimized Formats**: Export schemas in JSON, Markdown, DDL, Mermaid ER diagrams, and TypeScript interfaces
- **Secure Credential Storage**: AES-256-GCM encrypted credential management
- **CLI-First Design**: Built for automation and integration with AI workflows

## Quick Start

### Installation

```bash
npm install -g aidb
```

### Connect to a Database

```bash
# Connect to PostgreSQL
aidb connect mydb --type postgres --host localhost --database myapp

# Connect to MySQL
aidb connect proddb --type mysql --host db.example.com --database production

# Connect to Azure SQL with managed identity
aidb connect azure-prod --type azure-sql --auth managed-identity
```

### View Schema

```bash
# View schema as compact JSON (AI-optimized)
aidb schema mydb --format json

# View as human-readable Markdown
aidb schema mydb --format markdown

# View as Mermaid ER diagram
aidb schema mydb --format mermaid > schema.mmd

# View specific table
aidb schema mydb --table users
```

### Discover Relationships

```bash
# Show all relationships
aidb relationships mydb

# Find join path between tables
aidb join-path mydb --from users --to comments
# Output: users → posts → comments (cost: 25, indexes: posts.user_id, comments.post_id)

# Detect junction tables (many-to-many)
aidb junctions mydb
# Output: post_tags (connects posts ↔ tags, confidence: 95%)
```

### Query Planning & Index Recommendations

```bash
# Analyze a query
aidb explain mydb "SELECT * FROM posts WHERE user_id = 123"

# Get index recommendations
aidb indexes mydb --recommend
# Output:
#   HIGH PRIORITY:
#   - CREATE INDEX idx_comments_user_id ON comments(user_id);
#     Reason: Frequent WHERE/JOIN usage (15 queries), est. 70% speedup

# Apply recommended indexes (interactive)
aidb indexes mydb --apply
```

### Safe Schema Changes

```bash
# Create snapshot before changes
aidb snapshot create mydb --message "Before adding new column"

# Apply schema change (dry-run first)
aidb apply mydb --sql "ALTER TABLE posts ADD COLUMN view_count INT DEFAULT 0" --dry-run

# Apply for real
aidb apply mydb --sql "ALTER TABLE posts ADD COLUMN view_count INT DEFAULT 0"

# Rollback if needed
aidb rollback snapshot_20251003_103000 --execute
```

## Architecture

AI Database Helper follows a strict **Interface Segregation Principle** (ISP) with clear separation of concerns:

```
ai-db-helper/
├── packages/
│   ├── contracts/      # Interface definitions (ZERO dependencies)
│   ├── core/          # Business logic implementations
│   ├── adapters/      # Database-specific implementations
│   ├── cli/           # Command-line interface
│   └── test-harnesses/ # Integration tests with real databases
└── .aidb/             # Runtime cache directory (gitignored)
    ├── schemas/       # Cached schema JSON files
    ├── credentials.enc # Encrypted credentials
    ├── rollbacks/     # Rollback snapshots
    └── config.json    # Configuration
```

### Key Design Principles

1. **Interface-First Development**: All business logic implements well-defined contracts
2. **Real Implementations in Tests**: NO MOCKS - all tests use Docker-based real databases
3. **AI-Optimized Output**: Token-efficient schema representations for AI context windows
4. **Relationship Intelligence**: First-class support for FK discovery and inference
5. **Query Planning Integration**: Built-in EXPLAIN analysis and index recommendations
6. **Security by Default**: AES-256-GCM encrypted credentials, proper file permissions

## Configuration

Configuration is stored in `.aidb/config.json`:

```json
{
  "version": "1.0.0",
  "databases": {
    "mydb": {
      "type": "postgres",
      "lastRefresh": "2025-10-03T10:30:00Z",
      "schemaHash": "abc123...",
      "schemaSubset": {
        "enabled": true,
        "includeSchemas": ["public", "analytics"],
        "excludeTables": ["audit_log", "sessions"]
      },
      "relationships": {
        "includeInferred": true,
        "inferenceConfidenceThreshold": 0.7
      }
    }
  }
}
```

### Schema Subset Selection

For large databases (10,000+ tables), use schema subset filtering:

```bash
# Include only specific schemas
aidb connect largedb --type postgres --schemas public,analytics

# Include only specific tables
aidb connect largedb --tables users,posts,comments

# Exclude tables by pattern
aidb schema largedb --exclude-tables *_audit,sessions
```

## Command Reference

### Connection Management
- `aidb connect <db-name> --type <type>` - Connect to database
- `aidb disconnect <db-name>` - Disconnect from database
- `aidb list` - List all configured databases

### Schema Operations
- `aidb schema <db-name> [--format json|markdown|ddl|mermaid|typescript]` - View schema
- `aidb refresh <db-name>` - Refresh schema from database
- `aidb diff <db-name>` - Show schema changes since last cache

### Relationships
- `aidb relationships <db-name>` - Show all relationships
- `aidb join-path <db-name> --from <table> --to <table>` - Find join path
- `aidb junctions <db-name>` - Detect junction tables

### Query Planning
- `aidb explain <db-name> "<sql>"` - Analyze query execution plan
- `aidb indexes <db-name> --recommend` - Get index recommendations
- `aidb indexes <db-name> --apply` - Apply index suggestions interactively

### Rollback & Snapshots
- `aidb snapshot create <db-name> [--message <msg>]` - Create snapshot
- `aidb rollback <snapshot-id> [--dry-run]` - Rollback to snapshot
- `aidb apply <db-name> --sql "<ddl>" [--dry-run]` - Apply schema change

### Credentials
- `aidb credentials list` - List stored credentials
- `aidb credentials delete <db-name>` - Delete credentials
- `aidb credentials rotate <db-name>` - Rotate credentials

### Utilities
- `aidb export <db-name> --output <file>` - Export schema to file
- `aidb import <db-name> --input <file>` - Import schema from file
- `aidb doctor` - Validate .aidb directory integrity

## Supported Databases

| Database       | Version      | Schema Extraction | Relationships | Query Planning |
|---------------|--------------|-------------------|---------------|----------------|
| MySQL         | 5.7+         | ✓                 | ✓             | ✓              |
| PostgreSQL    | 12+          | ✓                 | ✓             | ✓              |
| MSSQL         | 2017+        | ✓                 | ✓             | ✓              |
| SQLite        | 3.x          | ✓                 | ✓             | Partial        |
| MongoDB       | 4.0+         | ✓ (inferred)      | ✓ (embedded)  | N/A            |
| IBM DB2       | 11.5+        | ✓                 | ✓             | ✓              |
| Oracle        | 12c+         | ✓                 | ✓             | ✓              |
| Azure SQL     | Latest       | ✓                 | ✓             | ✓              |

## Development

### Prerequisites

- Node.js 20+
- Docker (for integration tests)
- TypeScript 5.3+

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/ai-db-helper.git
cd ai-db-helper

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run integration tests (requires Docker)
npm run test:integration
```

### Project Structure

See [architecture-checklist.md](architecture-checklist.md) for complete implementation roadmap.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

### Development Workflow

1. Create feature branch from `main`
2. Write tests first (TDD approach)
3. Implement feature following interface contracts
4. Ensure all tests pass with real database instances (NO MOCKS)
5. Run linter and formatter
6. Submit pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

### v1.0 (Current)
- ✓ Multi-database support (7+ databases)
- ✓ Relationship intelligence
- ✓ Query planning & index advisory
- ✓ Safe schema modifications with rollback
- ✓ AI-optimized output formats

### v1.1 (Planned)
- Interactive schema browser (TUI)
- Query history tracking
- Schema comparison between databases
- Performance monitoring integration

### v1.2 (Future)
- Schema migration generator
- Natural language query builder
- Real-time schema change detection
- Cloud sync (.aidb to S3/Azure Blob)

### v2.0 (Vision)
- Web UI dashboard
- API server mode
- GraphQL schema export
- Team collaboration features

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/yourusername/ai-db-helper/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/ai-db-helper/discussions)

## Acknowledgments

Built with:
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts
- [mysql2](https://github.com/sidorares/node-mysql2) - MySQL driver
- [pg](https://github.com/brianc/node-postgres) - PostgreSQL driver
- [graphlib](https://github.com/dagrejs/graphlib) - Graph algorithms

---

**Built for AI, by humans** 🤖
