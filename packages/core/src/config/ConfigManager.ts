/**
 * ConfigManager - Configuration file management
 *
 * Features:
 * - Load/save config.json
 * - Default configuration generation
 * - Typed configuration access
 * - Configuration validation
 */

import * as fs from 'fs/promises';
import { IConfigManager, Config } from '@aidb/contracts';
import { DirectoryManager } from '../infrastructure/DirectoryManager';

export class ConfigManager implements IConfigManager {
  private readonly directoryManager: DirectoryManager;
  private config?: Config;

  constructor(directoryManager: DirectoryManager) {
    this.directoryManager = directoryManager;
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<Config> {
    const configPath = this.directoryManager.getConfigPath();

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(content);

      // Validate and migrate if needed
      this.config = this.validateAndMigrate(this.config!);

      return this.config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config doesn't exist, create default
        this.config = this.createDefaultConfig();
        await this.save(this.config);
        return this.config;
      }
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  /**
   * Save configuration to file
   */
  async save(config: Config): Promise<void> {
    const configPath = this.directoryManager.getConfigPath();

    // Validate before saving
    this.validateConfig(config);

    // Save
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath, content, 'utf-8');

    // Update in-memory config
    this.config = config;

    // Set permissions
    await fs.chmod(configPath, 0o644);
  }

  /**
   * Get configuration value by key
   */
  get<T>(key: string): T | undefined {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }

    // Support dot notation (e.g., 'security.encryptionAlgorithm')
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * Set configuration value by key
   */
  async set(key: string, value: any): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    // Support dot notation
    const keys = key.split('.');
    let target: any = this.config!;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = value;

    // Save updated config
    await this.save(this.config!);
  }

  /**
   * Check if config file exists
   */
  async exists(): Promise<boolean> {
    const configPath = this.directoryManager.getConfigPath();

    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get database configuration
   */
  async getDatabaseConfig(databaseName: string) {
    if (!this.config) {
      await this.load();
    }

    return this.config!.databases[databaseName];
  }

  /**
   * Set database configuration
   */
  async setDatabaseConfig(databaseName: string, dbConfig: any): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    this.config!.databases[databaseName] = dbConfig;
    await this.save(this.config!);
  }

  /**
   * Delete database configuration
   */
  async deleteDatabaseConfig(databaseName: string): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    delete this.config!.databases[databaseName];
    await this.save(this.config!);
  }

  /**
   * List all configured databases
   */
  async listDatabases(): Promise<string[]> {
    if (!this.config) {
      await this.load();
    }

    return Object.keys(this.config!.databases);
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = this.createDefaultConfig();
    await this.save(this.config);
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): Config {
    return {
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
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: Config): void {
    if (!config.version) {
      throw new Error('Config missing version');
    }

    if (!config.databases || typeof config.databases !== 'object') {
      throw new Error('Config missing databases object');
    }

    if (!config.security || typeof config.security !== 'object') {
      throw new Error('Config missing security object');
    }

    if (!config.cache || typeof config.cache !== 'object') {
      throw new Error('Config missing cache object');
    }
  }

  /**
   * Validate and migrate configuration if needed
   */
  private validateAndMigrate(config: Config): Config {
    // Ensure all required fields exist
    if (!config.version) {
      config.version = '1.0.0';
    }

    if (!config.databases) {
      config.databases = {};
    }

    if (!config.security) {
      config.security = {
        encryptionAlgorithm: 'aes-256-gcm',
        credentialTimeout: 3600
      };
    }

    if (!config.cache) {
      config.cache = {
        maxAge: 86400,
        compressionEnabled: true
      };
    }

    // Migrate each database config
    for (const dbConfig of Object.values(config.databases)) {
      // Ensure default format
      if (!dbConfig.defaultFormat) {
        dbConfig.defaultFormat = 'json';
      }

      // Ensure autoRefresh is set
      if (typeof dbConfig.autoRefresh !== 'boolean') {
        dbConfig.autoRefresh = false;
      }

      // Convert date strings to Date objects
      if (dbConfig.lastRefresh && typeof dbConfig.lastRefresh === 'string') {
        dbConfig.lastRefresh = new Date(dbConfig.lastRefresh);
      }

      // Ensure schemaSubset exists
      if (!dbConfig.schemaSubset) {
        dbConfig.schemaSubset = {
          enabled: false
        };
      }

      // Ensure relationships config exists
      if (!dbConfig.relationships) {
        dbConfig.relationships = {
          includeInferred: true,
          inferenceConfidenceThreshold: 0.7,
          autoDetectJunctions: true
        };
      }

      // Ensure queryPlanning config exists
      if (!dbConfig.queryPlanning) {
        dbConfig.queryPlanning = {
          enabled: true,
          trackQueryLog: false,
          indexSuggestions: true
        };
      }
    }

    return config;
  }

  /**
   * Export configuration (for backup)
   */
  async export(): Promise<string> {
    if (!this.config) {
      await this.load();
    }

    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration (from backup)
   */
  async import(configJson: string): Promise<void> {
    const config: Config = JSON.parse(configJson);
    this.validateConfig(config);
    await this.save(config);
  }
}
