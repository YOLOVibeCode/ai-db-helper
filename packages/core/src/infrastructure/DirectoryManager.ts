/**
 * DirectoryManager - Manages .aidb directory structure and file permissions
 *
 * Responsibilities:
 * - Create and validate .aidb directory structure
 * - Set proper file permissions (700 for directory, 600 for credentials)
 * - Provide utility methods for path resolution
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export class DirectoryManager {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    // Default to current working directory, but allow override for testing
    this.baseDir = baseDir || process.cwd();
  }

  /**
   * Get the .aidb directory path
   */
  getAidbPath(): string {
    return path.join(this.baseDir, '.aidb');
  }

  /**
   * Get the schemas directory path
   */
  getSchemasPath(): string {
    return path.join(this.getAidbPath(), 'schemas');
  }

  /**
   * Get the credentials file path
   */
  getCredentialsPath(): string {
    return path.join(this.getAidbPath(), 'credentials.enc');
  }

  /**
   * Get the rollbacks directory path
   */
  getRollbacksPath(databaseName?: string): string {
    const basePath = path.join(this.getAidbPath(), 'rollbacks');
    return databaseName ? path.join(basePath, databaseName) : basePath;
  }

  /**
   * Get the metadata directory path
   */
  getMetadataPath(): string {
    return path.join(this.getAidbPath(), 'metadata');
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return path.join(this.getAidbPath(), 'config.json');
  }

  /**
   * Get the logs directory path
   */
  getLogsPath(): string {
    return path.join(this.getAidbPath(), 'logs');
  }

  /**
   * Get the Azure authentication directory path
   */
  getAzureAuthPath(): string {
    return path.join(this.getAidbPath(), 'azure');
  }

  /**
   * Get the Azure token cache file path
   */
  getAzureTokenCachePath(): string {
    return path.join(this.getAzureAuthPath(), 'tokens.json');
  }

  /**
   * Initialize the .aidb directory structure
   * Creates all necessary directories with proper permissions
   */
  async initialize(): Promise<void> {
    const aidbPath = this.getAidbPath();

    // Create main .aidb directory
    await this.ensureDirectoryExists(aidbPath);

    // Set permissions: 700 (rwx------)
    await fs.chmod(aidbPath, 0o700);

    // Create subdirectories
    await this.ensureDirectoryExists(this.getSchemasPath());
    await this.ensureDirectoryExists(this.getRollbacksPath());
    await this.ensureDirectoryExists(this.getMetadataPath());
    await this.ensureDirectoryExists(this.getLogsPath());
    await this.ensureDirectoryExists(this.getAzureAuthPath());

    // Create default config if it doesn't exist
    const configPath = this.getConfigPath();
    const configExists = await this.fileExists(configPath);

    if (!configExists) {
      await this.createDefaultConfig();
    }
  }

  /**
   * Validate that the .aidb directory structure is correct
   * Used by the 'aidb doctor' command
   */
  async validate(): Promise<ValidationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check if .aidb exists
    const aidbPath = this.getAidbPath();
    if (!(await this.directoryExists(aidbPath))) {
      issues.push('.aidb directory does not exist');
      return { valid: false, issues, warnings };
    }

    // Check permissions on .aidb directory
    try {
      const stats = await fs.stat(aidbPath);
      const mode = stats.mode & 0o777;
      if (mode !== 0o700) {
        warnings.push(`.aidb directory has incorrect permissions: ${mode.toString(8)} (expected: 700)`);
      }
    } catch (error) {
      warnings.push(`Could not check .aidb permissions: ${error}`);
    }

    // Check subdirectories
    const requiredDirs = [
      this.getSchemasPath(),
      this.getRollbacksPath(),
      this.getMetadataPath(),
      this.getLogsPath(),
      this.getAzureAuthPath()
    ];

    for (const dir of requiredDirs) {
      if (!(await this.directoryExists(dir))) {
        issues.push(`Missing directory: ${path.relative(this.baseDir, dir)}`);
      }
    }

    // Check config file
    const configPath = this.getConfigPath();
    if (!(await this.fileExists(configPath))) {
      warnings.push('config.json is missing');
    } else {
      // Try to parse config
      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        JSON.parse(configContent);
      } catch (error) {
        issues.push(`config.json is invalid: ${error}`);
      }
    }

    // Check credentials file permissions if it exists
    const credPath = this.getCredentialsPath();
    if (await this.fileExists(credPath)) {
      try {
        const stats = await fs.stat(credPath);
        const mode = stats.mode & 0o777;
        if (mode !== 0o600) {
          warnings.push(`credentials.enc has incorrect permissions: ${mode.toString(8)} (expected: 600)`);
        }
      } catch (error) {
        warnings.push(`Could not check credentials.enc permissions: ${error}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Clean up old cache files and rollback snapshots
   */
  async cleanup(options: CleanupOptions = {}): Promise<CleanupReport> {
    const report: CleanupReport = {
      deletedFiles: 0,
      freedBytes: 0,
      errors: []
    };

    const maxAge = options.maxAgeDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    // Clean old rollback snapshots
    if (options.cleanRollbacks !== false) {
      try {
        const rollbacksPath = this.getRollbacksPath();
        const databases = await fs.readdir(rollbacksPath);

        for (const dbName of databases) {
          const dbRollbackPath = this.getRollbacksPath(dbName);
          const files = await fs.readdir(dbRollbackPath);

          for (const file of files) {
            const filePath = path.join(dbRollbackPath, file);
            const stats = await fs.stat(filePath);

            if (stats.mtime < cutoffDate) {
              report.freedBytes += stats.size;
              await fs.unlink(filePath);
              report.deletedFiles++;
            }
          }
        }
      } catch (error) {
        report.errors.push(`Error cleaning rollbacks: ${error}`);
      }
    }

    // Clean old log files
    if (options.cleanLogs !== false) {
      try {
        const logsPath = this.getLogsPath();
        const files = await fs.readdir(logsPath);

        for (const file of files) {
          if (!file.endsWith('.log')) continue;

          const filePath = path.join(logsPath, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            report.freedBytes += stats.size;
            await fs.unlink(filePath);
            report.deletedFiles++;
          }
        }
      } catch (error) {
        report.errors.push(`Error cleaning logs: ${error}`);
      }
    }

    return report;
  }

  /**
   * Get disk usage statistics for .aidb directory
   */
  async getStats(): Promise<DirectoryStats> {
    const stats: DirectoryStats = {
      totalSizeBytes: 0,
      schemasCount: 0,
      rollbacksCount: 0,
      configSizeBytes: 0,
      credentialsSizeBytes: 0
    };

    try {
      // Count schemas
      const schemasPath = this.getSchemasPath();
      const schemaFiles = await fs.readdir(schemasPath);
      stats.schemasCount = schemaFiles.length;

      for (const file of schemaFiles) {
        const filePath = path.join(schemasPath, file);
        const fileStat = await fs.stat(filePath);
        stats.totalSizeBytes += fileStat.size;
      }

      // Count rollbacks
      const rollbacksPath = this.getRollbacksPath();
      const rollbackDirs = await fs.readdir(rollbacksPath);

      for (const dir of rollbackDirs) {
        const dbRollbackPath = path.join(rollbacksPath, dir);
        const files = await fs.readdir(dbRollbackPath);
        stats.rollbacksCount += files.length;

        for (const file of files) {
          const filePath = path.join(dbRollbackPath, file);
          const fileStat = await fs.stat(filePath);
          stats.totalSizeBytes += fileStat.size;
        }
      }

      // Config size
      const configPath = this.getConfigPath();
      if (await this.fileExists(configPath)) {
        const configStat = await fs.stat(configPath);
        stats.configSizeBytes = configStat.size;
        stats.totalSizeBytes += configStat.size;
      }

      // Credentials size
      const credPath = this.getCredentialsPath();
      if (await this.fileExists(credPath)) {
        const credStat = await fs.stat(credPath);
        stats.credentialsSizeBytes = credStat.size;
        stats.totalSizeBytes += credStat.size;
      }
    } catch (error) {
      throw new Error(`Failed to get directory stats: ${error}`);
    }

    return stats;
  }

  /**
   * Create default configuration file
   */
  private async createDefaultConfig(): Promise<void> {
    const defaultConfig = {
      version: '1.0.0',
      databases: {},
      security: {
        encryptionAlgorithm: 'aes-256-gcm',
        credentialTimeout: 3600
      },
      cache: {
        maxAge: 86400,
        compressionEnabled: true
      }
    };

    const configPath = this.getConfigPath();
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    await fs.chmod(configPath, 0o644);
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}

// Types
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface CleanupOptions {
  maxAgeDays?: number;
  cleanRollbacks?: boolean;
  cleanLogs?: boolean;
}

export interface CleanupReport {
  deletedFiles: number;
  freedBytes: number;
  errors: string[];
}

export interface DirectoryStats {
  totalSizeBytes: number;
  schemasCount: number;
  rollbacksCount: number;
  configSizeBytes: number;
  credentialsSizeBytes: number;
}
